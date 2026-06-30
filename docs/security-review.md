# セキュリティレビュー報告書

**対象**: `src/` 以下の TypeScript ソースコード全体  
**レビュー日**: 2026-06-30  
**観点**: セキュリティ、パフォーマンス、エラーハンドリング、Discord API 権限、入力検証  
**参考**: `docs/code-review.md`

---

## 総合判定

**PASS WITH FINDINGS（重大な即時侵害経路は未確認。ただし、認証・永続化・権限境界に改善余地あり）**

Bot トークンや Gmail 認証情報のハードコード、SQL Injection、外部入力による任意パス読み書き、OS コマンド実行のような高リスクな問題は確認されませんでした。一方で、認証コードの試行回数制限がないこと、JSON ファイルの読み書きが排他制御・破損検知なしで行われること、Discord の管理系コマンドがアプリケーションコマンド権限で制限されていないことは、運用上のセキュリティ・可用性リスクです。

---

## レビュー範囲

読み込み対象:

- `src/index.ts`
- `src/commands/verify.ts`
- `src/commands/unverify.ts`
- `src/commands/profile.ts`
- `src/handlers/guildMemberAdd.ts`
- `src/handlers/interactionCreate.ts`
- `src/handlers/messageCreate.ts`
- `src/handlers/voiceStateUpdate.ts`
- `src/utils/activity.ts`
- `src/utils/email.ts`
- `src/utils/format-date.ts`
- `src/utils/leaderboard.ts`
- `src/utils/notification.ts`
- `src/utils/profile.ts`
- `src/types/VerifiedUser.ts`
- `src/types/UserProfile.ts`

補助的に確認した資料:

- `docs/code-review.md`
- `docs/setup.md`
- `docs/commands.md`
- `.env.example`
- `package.json`
- `tsconfig.json`

---

## 重点確認結果

| 項目 | 判定 | 要点 |
|------|------|------|
| 認証フロー | 要改善 | メール認証自体は成立しているが、OTP が `Math.random()` 生成かつ試行回数制限なし |
| ファイル I/O | 要改善 | 固定パスで任意パス書き込みはないが、JSON 破損時に空データ扱いとなり次回保存で全消失し得る |
| Discord API 権限 | 要改善 | 実行時チェックはあるが、スラッシュコマンド定義側の権限制限がない |
| メモリリーク・リソース管理 | 要改善 | 認証セッション、VC セッション、Leaderboard interval がメモリのみで管理される |
| 入力検証 | 概ね良好 | 学籍番号は 6 桁検証あり。Leaderboard button の `period/type` は列挙値検証が不足 |

---

## Findings

| 重要度 | タイトル | CWE候補 | 影響 | 推奨対応 |
|--------|----------|---------|------|----------|
| Medium | 認証コードに試行回数制限がなく、乱数も暗号学的に安全ではない | CWE-307 / CWE-338 | 認証コード総当たり成功時に他人の学籍番号で認証され得る | `crypto.randomInt`、試行回数制限、再送クールダウンを導入 |
| Medium | JSON 永続化が破損・競合に弱く、認証データを失う可能性がある | CWE-362 / CWE-404 | 認証済み状態の消失、認証解除・保存の取りこぼし | atomic write、排他制御、スキーマ検証、バックアップを導入 |
| Low-Medium | 管理系スラッシュコマンドが Discord 側で権限制限されていない | CWE-266 | `/unverify` や `/profile user` が全員に表示・呼び出し可能で、実行時チェックに依存 | `setDefaultMemberPermissions` と guild 側権限設定を追加 |
| Low-Medium | ロール存在チェック前にロール操作を行い、部分適用が起き得る | CWE-670 | ロール片方だけ変更された状態で認証失敗扱いになる | 操作前にロール存在・Bot 権限・ロール階層を検証 |
| Low | Message Content Intent が有効だが、現状のメッセージ数集計には不要 | CWE-200 | 不要なメッセージ本文アクセス権限を Bot に付与 | `GatewayIntentBits.MessageContent` を削除可能か検証 |
| Low | Leaderboard button の `period/type` 検証が不足 | CWE-20 | 想定外 customId で表示種別が暗黙に voice 扱いになる | `monthly/yearly`、`messages/voice` の明示チェックを追加 |

---

## 詳細

### 1. 認証フローの脆弱性

#### 現状

`src/commands/verify.ts` では、6桁の学籍番号入力後に `tk{学籍番号}@tks.iput.ac.jp` 宛へ 6 桁コードを送信し、5 分以内に一致すれば `認証済み` ロールを付与します。

良い点:

- 学籍番号入力は `/^\d{6}$/` で検証されている。
- 認証コード入力ボタンとモーダルは `customId` に userId を含め、別ユーザー利用を拒否している。
- 認証セッションは 5 分で期限切れになる。
- メール送信失敗時はセッションを削除している。

懸念点:

- `generateCode()` が `Math.random()` を使用している。
- 認証コードの不一致時に試行回数を増やしておらず、セッション期限内なら何度でも入力できる。
- `/verify` の連続実行・メール連続送信に対する per-user cooldown がない。
- セッションがプロセス内 `Map` のみで、再起動時に消える。これは直接の侵害ではないが、認証 UX と可用性を下げる。

攻撃経路:

1. 攻撃者が自分の Discord アカウントで `/verify` を実行し、任意の 6 桁学籍番号を入力する。
2. 5 分以内にモーダルへ多数の 6 桁コードを試行する。
3. コードが一致すると、その学籍番号の所有者でなくても `認証済み` ロールと `verified.json` 登録を得る。

Discord 側のレート制限があるため実用的な成功率は高くありませんが、アプリ側に試行制限がないため Medium と評価します。

推奨対応:

- `crypto.randomInt(100000, 1000000)` でコードを生成する。
- `VerificationSession` に `attempts` を追加し、5 回程度でセッション失効させる。
- `/verify` とコード再送に cooldown を設ける。
- 既に認証済みの userId / studentNumber の再認証ポリシーを明文化し、必要なら重複登録を拒否する。

---

### 2. ファイル I/O の安全性

#### 現状

- `src/utils/profile.ts` は `src/data/verified.json` を読み書きする。
- `src/utils/activity.ts` は `src/data/activity.json` を読み書きする。
- パスは `resolve(process.cwd(), 'src/data/...')` の固定値であり、ユーザー入力による path traversal は確認されない。

懸念点:

- `loadVerifiedUsers()` と `loadActivityData()` は JSON parse 失敗時に `{}` を返す。破損・途中書き込み・手動編集ミスが発生すると、次回保存で既存データが全消失する可能性がある。
- `saveVerifiedUser()` / `removeVerifiedUser()` は read-modify-write で排他制御がない。同時に認証完了や認証解除が走ると、後勝ちで片方の更新が失われ得る。
- `writeFile()` は atomic write ではない。プロセス終了やディスク障害が書き込み中に発生するとファイル破損につながる。
- `src/data` が存在しない場合、`writeFile()` が失敗する。現状 `src/data/*` は確認できず、初回保存失敗の可能性がある。

推奨対応:

- `DATA_DIR` を環境変数化し、起動時に `mkdir({ recursive: true })` を行う。
- `*.tmp` へ書いて `rename()` する atomic write に変更する。
- 書き込み前にバックアップを残す。
- JSON 読み込み失敗時は `{}` で継続せず、エラーを明示して保存を止める。
- `zod` 等でファイル内容をスキーマ検証する。
- 将来的には SQLite などの単一プロセスでも堅牢な永続化へ移行する。

---

### 3. Discord API の権限チェック

#### 良い点

- `/unverify` と `/profile user` は `Administrator` または `運営` ロールで実行時チェックをしている。
- `/verify` は guild 内のみで利用可能としている。
- 他ユーザーが認証コード入力ボタン・モーダルを使うことは拒否されている。

#### 懸念点

- `SlashCommandBuilder` 側で `setDefaultMemberPermissions()` が設定されていないため、管理系コマンドが一般ユーザーにも表示・呼び出し可能になる。実行時に拒否されるとはいえ、権限境界がアプリコードだけに集中している。
- `運営` の判定がロール名一致で、ロール ID 固定ではない。ロール名は重複可能で、運用ミスやロール設計変更の影響を受けやすい。
- `verify.ts` では `未認証` / `認証済み` ロールの存在確認がロール操作後に行われている。片方だけ存在する場合、片方のロール操作だけ成功してから「サーバー設定に問題」と応答し、永続データは保存されない不整合が起き得る。
- `guildMemberAdd.ts` で `未認証` ロール付与に失敗したユーザーは、未認証隔離に入らない可能性がある。Discord 側のチャンネル権限設計で `@everyone` を厳しくしていない場合、未認証ユーザーが想定以上に閲覧できる。

推奨対応:

- `/unverify` と `/profile user` に `setDefaultMemberPermissions(PermissionFlagsBits.Administrator)` を設定し、必要なら Discord の Integration 設定で `運営` ロールに限定許可する。
- `運営`、`未認証`、`認証済み` はロール ID を環境変数で管理する。
- ロール操作前に、対象ロール存在・Bot の `ManageRoles` 権限・Bot ロール階層が対象ロールより上であることを検査する。
- 未認証ユーザーの権限制御は Bot のロール付与成功だけに依存せず、`@everyone` のデフォルト権限を最小化する。

---

### 4. メモリリーク・リソース管理

#### 認証セッション

`sessions` は userId ごとに 1 件で、5 分後に削除されるため無制限増加はしにくい設計です。ただし、`/verify` を繰り返すたびに `setTimeout()` が追加され、古い timeout はキャンセルされません。大量実行時には短時間だけ timeout が積み上がります。

推奨対応:

- セッションに timeout handle を持たせ、再発行時に古い timeout を `clearTimeout()` する。
- per-user cooldown を導入する。

#### VC セッション

`voiceSessions` は退出イベントで削除されますが、Discord Gateway の切断やイベント欠落時に残り続ける可能性があります。また Bot 再起動中に入室していたユーザーは退出時に計測されません。

推奨対応:

- 一定時間以上古いセッションを掃除する periodic cleanup を追加する。
- 起動時に現在の voice state を走査し、必要ならセッションを復元する。

#### Leaderboard interval

`startLeaderboardUpdater()` は `setInterval()` の handle を保持せず停止手段もありません。現状 `ClientReady` は `once` なので重複起動は起きにくいですが、テストや将来の再初期化で interval が残る可能性があります。

推奨対応:

- interval handle を保持し、二重起動防止と停止関数を用意する。
- `SIGTERM` でも activity flush と interval 停止を行う。

---

### 5. 入力検証の網羅性

良い点:

- 学籍番号は 6 桁数字・長さ制限あり。
- 認証コード入力欄も UI 上は 6 桁に制限されている。
- userId を含む customId で他ユーザー操作を拒否している。

改善点:

- `verification-code` は `inputCode !== session.code` のみで、`/^\d{6}$/` の明示検証がない。セキュリティ影響は小さいが、ログや監査上は不正形式を分けて扱うとよい。
- `leaderboard:${period}:${type}` は `parts.length` のみ確認し、`period` と `type` の列挙値検証がない。`leaderboard:monthly:anything` は `type === 'messages'` でないため voice 側の処理に流れる。
- `interactionCreate.ts` の button handler は `verifyCommand.handleButton()` と `handleLeaderboardButton()` を常に連続実行する。現在は customId prefix で return するため実害は小さいが、今後ボタン種別が増える場合は dispatch を明確化した方が安全。

---

## `docs/code-review.md` への更新提案

既存の `docs/code-review.md` はコード品質・保守性の観点が中心で、今回のセキュリティレビューと矛盾しません。追記するなら以下を推奨します。

1. `Math.random()` の指摘を「低」ではなく「試行回数制限なし」とセットで Medium 相当に上げる。
2. JSON parse 失敗時に `{}` を返す挙動を、データ消失リスクとして明記する。
3. `/unverify` と `/profile user` は実行時チェックだけでなく、Discord アプリケーションコマンド権限でも制限する方針を追加する。
4. `MessageContent` intent が不要であれば削除し、最小権限に近づける。
5. `SIGTERM` 対応に加えて、Leaderboard interval の停止・二重起動防止も記載する。

---

## 優先対応順

| 優先度 | 対応 |
|--------|------|
| 高 | OTP を `crypto.randomInt` に変更し、試行回数制限・cooldown を追加 |
| 高 | JSON 永続化を atomic write + parse failure fail-fast + `DATA_DIR` 化へ改善 |
| 中 | 管理系コマンドに `setDefaultMemberPermissions` を設定し、ロール ID ベースに変更 |
| 中 | ロール操作前の存在・権限・階層チェックを追加 |
| 中 | `SIGTERM` 対応、Leaderboard interval 停止、VC セッション cleanup を追加 |
| 低 | Leaderboard customId と verification-code の列挙値・形式検証を追加 |
| 低 | 不要なら `MessageContent` intent を削除 |

---

## 残余リスク

- 実 Discord サーバー上のロール階層、チャンネル権限、Integration 権限はコードだけでは確認できません。
- Gmail アカウントの保護状態、送信制限、アプリパスワード管理は環境依存です。
- 実行時の rate limit は Discord API 側にも依存するため、総当たり耐性は本番環境での挙動確認が必要です。
- 依存パッケージの既知脆弱性は `npm audit` 等の別レビュー対象です。
