# コードレビュー報告書

**対象リポジトリ**: IPUT-Esports-Discord-Bot  
**レビュー日**: 2026-06-30  
**実施者**: Sisyphus (AI Code Review)

---

## 評価サマリー

| 項目 | 評価 | 備考 |
|------|------|------|
| 型安全性 | ⭐⭐⭐⭐⭐ | `strict: true`, `noUncheckedIndexedAccess` 有効。型定義が明確 |
| コード構造 | ⭐⭐⭐⭐☆ | 責任の分離が合理的。一部モジュールが大きめ |
| エラーハンドリング | ⭐⭐⭐⭐☆ | 基本的な try-catch は網羅的。一部非同期エラーが未捕捉 |
| 保守性 | ⭐⭐⭐⭐☆ | コメント・命名規則は良好。データ永続化に改善余地 |
| セキュリティ | ⭐⭐⭐☆☆ | 認証フローは適切。メモリセッションとファイルベースDBに注意 |

---

## 詳細レビュー

### ✅ 優れている点

#### 1. TypeScript の厳格な設定

`tsconfig.json` で `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` を有効化しており、ランタイムエラーをコンパイル時に防ぐ設計がされています。

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

#### 2. 環境設定の外部化

`.env` ファイルを使用し、環境依存の設定（トークン、チャンネルID等）をコードから分離しています。これにより、開発/ステージング/本番環境の切り替えが容易です。

#### 3. モジュール分割の合理性

| ディレクトリ | 責任 |
|-------------|------|
| `commands/` | スラッシュコマンドの定義と実行ロジック |
| `handlers/` | Discord イベントハンドラ |
| `utils/` | ビジネスロジック（プロフィール、メール、ランキング等） |
| `types/` | インターフェース定義 |

責任の分離が明確で、新機能追加時の配置先が直感的です。

#### 4. 適切なエラーハンドリング

`interactionCreate.ts` では、コマンド・ボタン・モーダルそれぞれで try-catch を実装し、ユーザーに対しては汎用エラーメッセージを返しつつ、コンソールには詳細を出力しています。

#### 5. ベストエフォート設計

`notifyVerification` / `notifyUnverification` では、通知失敗時に例外を伝播させず、ログ出力のみに留めています。これにより、認証フローの成功を妨げません。

#### 6. クリーンシャットダウン

`SIGINT` を捕捉して、アクティビティデータのフラッシュを確実に行っています。これにより、強制終了時のデータ欠損を最小化しています。

---

### ⚠️ 改善推奨事項

#### 1. 【重要】メモリ上のセッションが揮発性

**該当ファイル**: `src/commands/verify.ts`

```typescript
const sessions = new Map<string, VerificationSession>();
```

認証セッションがメモリ上の `Map` に保持されており、Bot プロセスの再起動で全て失われます。ユーザーがメールを受信している最中に Bot が再起動すると、認証コードが無効化され UX が損なわれます。

**推奨対策**:
- `src/data/sessions.json` などに永続化する
- または Redis などの外部ストアの導入を検討

#### 2. 【重要】ランキングメッセージIDがメモリ上

**該当ファイル**: `src/utils/leaderboard.ts`

```typescript
const messageIds: Record<string, string> = {};
const lastPostDates: Record<string, string> = {};
```

リーダーボードの投稿メッセージIDがメモリに保持されているため、Bot 再起動後に新規投稿が作成され、過去のメッセージが残り続けます。

**推奨対策**:
- `messageIds` と `lastPostDates` をファイルまたはデータベースに永続化
- 起動時にチャンネルの最新メッセージを検索して既存投稿を再利用する

#### 3. 【重要】データファイルパスがビルド後と異なる可能性

**該当ファイル**: `src/utils/profile.ts`, `src/utils/activity.ts`

```typescript
const DATA_PATH = resolve(process.cwd(), 'src/data/verified.json');
```

`npm run build` 後に `npm start` で `dist/index.js` を実行すると、`process.cwd()` はプロジェクトルートのままですが、`src/data/` ディレクトリへの書き込みは開発時と同じパスになります。Docker コンテナ等で実行する場合、`src/` ディレクトリが存在しない構成になる可能性があります。

**推奨対策**:
- データファイルのパスを環境変数 `DATA_DIR` などで設定可能にする
- または、ビルド後も `src/data/` を含めるようにする

#### 4. 未使用の import

**該当ファイル**: `src/commands/verify.ts`（L14）

```typescript
import { PermissionFlagsBits } from 'discord.js';
```

`PermissionFlagsBits` は使用されていません。

#### 5. ロールチェックの順序が不自然

**該当ファイル**: `src/commands/verify.ts`（L161-L179）

```typescript
const unverifiedRole = member.guild.roles.cache.find((r) => r.name === '未認証');
const verifiedRole = member.guild.roles.cache.find((r) => r.name === '認証済み');

try {
  if (unverifiedRole) await member.roles.remove(unverifiedRole);
  if (verifiedRole) await member.roles.add(verifiedRole);
} catch {
  // ...
}

if (!unverifiedRole || !verifiedRole) {
  // ここでチェックしているが、すでに roles.add/remove を実行済み
}
```

ロールの存在チェックを権限操作の**前**に行うべきです。存在しないロールに対して操作を試行してからエラーにするのは非効率です。

**推奨コード**:

```typescript
if (!unverifiedRole || !verifiedRole) {
  await interaction.reply({ content: 'サーバー設定に問題があります。', ephemeral: true });
  return;
}

try {
  await member.roles.remove(unverifiedRole);
  await member.roles.add(verifiedRole);
} catch {
  // ...
}
```

#### 6. `SIGTERM` シグナルの未処理

**該当ファイル**: `src/index.ts`

`SIGINT` のみ捕捉しており、`SIGTERM`（systemd, Docker, PM2 のデフォルト終了シグナル）に対応していません。

**推奨対策**:

```typescript
async function shutdown(): Promise<void> {
  console.log('[Shutdown] Flushing activity data...');
  stopAutoFlush();
  await flushActivityData();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

#### 7. `unhandledRejection` でのプロセス継続

**該当ファイル**: `src/index.ts`（L60-L62）

```typescript
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});
```

未処理の Promise 拒否が発生してもプロセスが継続します。これにより、内部状態が不整合になったまま動作し続けるリスクがあります。Node.js v15 以降では `unhandledRejection` がデフォルトでプロセス終了となりました。

**推奨対策**:
- クリティカルなエラー時は `process.exit(1)` する
- または、[uncaughtException](https://nodejs.org/api/process.html#event-uncaughtexception) も併せて監視

#### 8. VC セッションのメモリリーク可能性

**該当ファイル**: `src/handlers/voiceStateUpdate.ts`

```typescript
const voiceSessions = new Map<string, { joinedAt: number }>();
```

ユーザーが VC に参加したまま Bot が再起動すると、`voiceSessions` がリセットされ、退出時に `joinedAt` が存在せず滞在時間が計測されません。また、異常な状況（Discord API の一時切断等）で退出イベントが発火しないと、セッションが残り続ける可能性があります。

**推奨対策**:
- セッションをファイルに永続化
- 一定時間以上のセッションを自動クリーンアップするタイマーを設定

#### 9. ランキング更新間隔がハードコード

**該当ファイル**: `src/utils/leaderboard.ts`（L204）

```typescript
setInterval(() => {
  updateLeaderboardChannels(client).catch(/* ... */);
}, 600000); // 10分固定
```

更新間隔が 10 分で固定されています。サーバー負荷やニーズに応じて調整したい場合に不便です。

**推奨対策**:
- 環境変数 `LEADERBOARD_UPDATE_INTERVAL_MS` などで設定可能にする

#### 10. 認証コードのランダム生成に `Math.random()` を使用

**該当ファイル**: `src/commands/verify.ts`（L30-L32）

```typescript
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
```

`Math.random()` は暗号学的に安全ではありません。ただし、6桁の数値コードであり有効期限が5分と短いため、実用上のリスクは低いです。

**推奨対策**:
- `crypto.randomInt(100000, 1000000)` への置き換えを検討（Node.js v14.10+ で利用可能）

#### 11. `node:process` の import が重複

**該当ファイル**: `src/index.ts`, `src/utils/email.ts`, `src/utils/leaderboard.ts`

`import process from 'node:process';` を明示的に行っていますが、Node.js のグローバル `process` を使用しても同じです。ESM 環境での明示的 import はスタイルの問題であり、必須ではありませんが、一貫性のため良いプラクティスです。

---

## セキュリティチェック

| 項目 | 結果 | 備考 |
|------|------|------|
| Bot トークンのハードコード | ✅ なし | `.env` で管理 |
| SQL Injection | ✅ 該当なし | JSON ファイルベースで SQL 未使用 |
| 認証コードのブルートフォース | ⚠️ 要注意 | 5分間の有効期限あり。試行回数制限なし |
| 権限チェック | ✅ 実装済み | `/profile user`, `/unverify` で管理者チェック |
| 入力検証 | ✅ 実装済み | 学籍番号の正規表現チェックあり |

### 認証コードのブルートフォース対策

現状、認証コードの入力試行回数に制限がありません。6桁の数字（100万通り）を5分間で総当たりされるリスクは極めて低いですが、セキュリティ要件が高い場合は以下を検討してください：

- 同一ユーザーあたりの試行回数を5回までに制限
- 連続ミス時に待ち時間を設ける（exponential backoff）

---

## パフォーマンスチェック

| 項目 | 結果 | 備考 |
|------|------|------|
| JSON ファイルの毎回読み書き | ⚠️ 要注意 | `saveVerifiedUser` で毎回全ファイル読み書き。ユーザー数増加時に遅延 |
| アクティビティバッファ | ✅ 良好 | メモリバッファ + 定期フラッシュで I/O を効率化 |
| リーダーボードの集計 | ✅ 良好 | 30日分/年度分のデータをメモリ上で集計 |

### JSON ファイル I/O のボトルネック

`src/utils/profile.ts` の `saveVerifiedUser` は、1ユーザーの更新のために全 `verified.json` を読み込み→更新→書き出ししています。ユーザー数が数百人以上になると、ファイルロックと I/O 遅延が顕著になります。

**推奨対策**:
- 将来的なスケーリングを見据え、SQLite や Redis の導入を検討
- または、ファイルの排他ロック（`fs-ext` 等）を実装

---

## 推奨する優先順位

| 優先度 | 項目 |
|--------|------|
| 🔴 高 | セッション・メッセージIDの永続化（再起動対応） |
| 🔴 高 | `SIGTERM` シグナルハンドラの追加 |
| 🟡 中 | ロール存在チェックの順序修正 |
| 🟡 中 | `unhandledRejection` での適切な終了処理 |
| 🟡 中 | データファイルパスの環境変数化 |
| 🟢 低 | 未使用 import の削除 |
| 🟢 低 | `Math.random()` → `crypto.randomInt()` の置き換え |
| 🟢 低 | ランキング更新間隔の設定可能化 |
