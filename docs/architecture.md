# アーキテクチャ設計書

IPUT Esports Discord Bot のシステムアーキテクチャ、コンポーネント構成、データフローについて説明します。

---

## 1. システム概要

本 Bot は IPUT Esports サークルの Discord サーバー運営を支援するための認証・管理システムです。学籍番号によるメンバー認証を中核に、プロフィール管理、ボイスチャット活動時間の追跡・ランキング表示、運営通知などの機能を提供します。

### 1.1 技術スタック

| 層 | 技術 |
|----|------|
| 言語 | TypeScript (ES2023, strict mode) |
| ランタイム | Node.js 20.x+ |
| フレームワーク | discord.js v14 |
| モジュールシステム | ES Modules |
| データ永続化 | JSON ファイル（ファイルシステム） |
| 外部サービス | Gmail SMTP（認証メール送信） |

### 1.2 主要機能

- **メンバー認証**: 学籍番号 + メール認証コードによる本人確認
- **ロール管理**: 認証完了時の自動ロール付与/削除
- **プロフィール表示**: 認証情報のカード形式での表示
- **VC 活動追跡**: ボイスチャット参加時間の記録・集計
- **ランキング表示**: 月間/年度のメッセージ数・VC時間ランキング
- **運営通知**: 認証イベントの運営チャンネルへの通知

---

## 2. ディレクトリ構造と責任分担

```
src/
├── index.ts              # エントリーポイント（クライアント初期化、イベント登録）
├── commands/             # スラッシュコマンドの定義と実行ロジック
│   ├── verify.ts         # 学籍番号認証コマンド
│   ├── unverify.ts       # 認証解除コマンド（管理者用）
│   └── profile.ts        # プロフィール表示コマンド
├── handlers/             # Discord イベントハンドラ
│   ├── guildMemberAdd.ts # 新規メンバー参加時の処理
│   ├── interactionCreate.ts # スラッシュコマンド・ボタン・モーダルの振り分け
│   ├── messageCreate.ts  # メッセージ送信時のアクティビティ記録
│   └── voiceStateUpdate.ts # VC 入退室の検出と滞在時間計測
├── utils/                # ビジネスロジック・ユーティリティ
│   ├── activity.ts       # アクティビティデータの管理（バッファ・フラッシュ）
│   ├── leaderboard.ts    # ランキング表示の更新・ボタン処理
│   ├── profile.ts        # 認証ユーザーの読み書き
│   ├── notification.ts   # 運営チャンネルへの通知送信
│   ├── email.ts          # Gmail SMTP を使った認証メール送信
│   └── format-date.ts    # 日付フォーマットユーティリティ
└── types/                # TypeScript 型定義
    ├── VerifiedUser.ts   # 認証ユーザー情報の型
    └── UserProfile.ts    # プロフィール情報の型
```

### 2.1 各層の責任

| ディレクトリ | 責任 | 設計原則 |
|-------------|------|---------|
| `commands/` | ユーザー入力の受付と初期バリデーション | 1コマンド1ファイル。UI（モーダル・ボタン）とロジックの分離 |
| `handlers/` | Discord イベントの受信と適切なハンドラへの振り分け | イベント種別ごとに分離。try-catch でのエラーハンドリング必須 |
| `utils/` | 純粋なビジネスロジックと外部サービス連携 | 副作用を持つ処理（ファイルI/O、API呼び出し）を集約 |
| `types/` | ドメインモデルの型定義 | 厳格な型安全性の担保 |

---

## 3. データフロー

### 3.1 メンバー認証フロー

```
[ユーザー] ─/verify──> [verify.ts]
                         │
                         ├─ モーダル表示 ──> [ユーザー: 学籍番号入力]
                         │
                         <── モーダル送信 ── [interactionCreate.ts]
                         │
                         ├─ 学籍番号バリデーション (/^\d{6}$/)
                         ├─ 認証コード生成 (Math.random())
                         ├─ sessions Map に一時保存
                         │
                         ├─ [email.ts] ──> Gmail SMTP ──> [大学メール]
                         │
                         ├─ 認証コード入力ボタンを表示
                         │
                         <── ボタンクリック ── [interactionCreate.ts]
                         │
                         ├─ 認証コードモーダル表示
                         │
                         <── コード入力 ── [interactionCreate.ts]
                         │
                         ├─ sessions から検証
                         ├─ ロール付与（未認証→認証済み）
                         ├─ [profile.ts] ──> verified.json に永続化
                         │
                         ├─ [notification.ts] ──> 運営チャンネルに通知
                         │
                         └─ 認証完了メッセージ
```

**主要データストア**:
- `sessions` (Map<string, VerificationSession>): メモリ上の認証セッション（揮発性）
- `src/data/verified.json`: 認証済みユーザー情報の永続化

### 3.2 VC 活動追跡フロー

```
[Discord Gateway]
    │
    ├─ voiceStateUpdate (入室) ──> [voiceStateUpdate.ts]
    │                              └─ voiceSessions.set(userId, { joinedAt })
    │
    ├─ voiceStateUpdate (退出) ──> [voiceStateUpdate.ts]
    │                              ├─ voiceSessions.get(userId)
    │                              ├─ 滞在時間計算 (Date.now() - joinedAt)
    │                              ├─ [activity.ts: trackVoiceTime()] ──> buffer に加算
    │                              └─ voiceSessions.delete(userId)
    │
    └─ voiceStateUpdate (チャンネル移動) ──> [voiceStateUpdate.ts]
                                   ├─ 旧チャンネルの滞在時間を確定
                                   ├─ trackVoiceTime()
                                   └─ 新チャンネルの joinedAt を設定
```

**主要データストア**:
- `voiceSessions` (Map<string, { joinedAt }>): メモリ上のVCセッション（揮発性）
- `buffer` (Record<string, DailyActivity>): メモリ上のアクティビティバッファ
- `src/data/activity.json`: 定期フラッシュによる永続化

### 3.3 ランキング更新フロー

```
[index.ts: startLeaderboardUpdater()]
    │
    ├─ 初回即時実行
    │   └─ [leaderboard.ts: updateLeaderboardChannels()]
    │       ├─ 各チャンネル設定をループ
    │       ├─ [activity.ts: getLeaderboard()] ──> buffer から集計
    │       ├─ EmbedBuilder でランキングカードを構築
    │       ├─ ボタン（メッセージ数 / VC時間）を配置
    │       ├─ 月/年度切り替え時は新規メッセージ投稿
    │       └─ 通常時は既存メッセージを編集
    │
    └─ setInterval(10分ごと)
        └─ 同上

[ユーザー: ボタンクリック]
    │
    └──> [interactionCreate.ts]
         └──> [leaderboard.ts: handleButton()]
              ├─ 表示タイプ切り替え（messages ↔ voice）
              ├─ getLeaderboard() で再集計
              └─ メッセージを edit()
```

**主要データストア**:
- `messageIds` (Record<string, string>): メモリ上の投稿メッセージID（揮発性）
- `lastPostDates` (Record<string, string>): 最終投稿日（揮発性）
- `currentTypes` (Record<string, 'messages' | 'voice'>): 現在の表示タイプ

### 3.4 メッセージアクティビティ記録フロー

```
[Discord Gateway]
    │
    └──> [messageCreate.ts]
         ├─ Bot メッセージを除外
         ├─ [activity.ts: trackMessage()] ──> buffer.messages[userId] += 1
         └─ isDirty = true
```

---

## 4. 主要コンポーネント詳細

### 4.1 エントリーポイント (`src/index.ts`)

| 項目 | 内容 |
|------|------|
| **責任** | Discord クライアントの初期化、イベントハンドラ登録、スラッシュコマンド登録、各種サービス起動 |
| **重要処理** | `ClientReady` 時にアクティビティバッファ初期化、自動フラッシュ開始、リーダーボード更新開始 |
| **シグナル処理** | `SIGINT` 捕捉時にアクティビティデータのフラッシュとクリーンシャットダウン |

### 4.2 インタラクションルータ (`src/handlers/interactionCreate.ts`)

| 項目 | 内容 |
|------|------|
| **責任** | 全インタラクション（コマンド/ボタン/モーダル）の受信と適切なハンドラへの振り分け |
| **設計** | 種別ごとに `handleCommand` / `handleButton` / `handleModalSubmit` に分離。各種別内でコマンド名や customId でさらに振り分け |
| **エラーハンドリング** | 各ハンドラを try-catch で囲み、ユーザーには汎用メッセージ、コンソールには詳細を出力 |

### 4.3 認証システム (`src/commands/verify.ts`)

| 項目 | 内容 |
|------|------|
| **責任** | 学籍番号認証の全フロー管理 |
| **状態管理** | メモリ上の `sessions` Map で認証セッションを管理（有効期限5分） |
| **セキュリティ** | 学籍番号の正規表現バリデーション (`/^\d{6}$/`)。認証コードは6桁の数値 |
| **注意点** | `sessions` がメモリ上のため、Bot 再起動で失われる |

### 4.4 アクティビティ管理 (`src/utils/activity.ts`)

| 項目 | 内容 |
|------|------|
| **責任** | メッセージ数・VC時間の日次集計と永続化 |
| **パフォーマンス最適化** | メモリバッファ + 定期フラッシュ（デフォルト10秒）でファイルI/Oを効率化 |
| **データ構造** | `Record<日付, { messages: Record<userId, count>, voiceMinutes: Record<userId, minutes> }>` |
| **注意点** | `getLeaderboard` は対象期間の全日付をループ。年度集計時は約365日分のデータを走査 |

### 4.5 リーダーボード (`src/utils/leaderboard.ts`)

| 項目 | 内容 |
|------|------|
| **責任** | ランキングメッセージの生成・投稿・更新・ボタン処理 |
| **更新間隔** | 10分固定（`setInterval(600000)`） |
| **切り替え機能** | メッセージ数/VC時間の表示切り替えボタンを提供 |
| **注意点** | `messageIds` と `lastPostDates` がメモリ上のため、再起動後に新規投稿が作成される |

---

## 5. 依存関係

### 5.1 外部依存

```
discord.js   # Discord API クライアント（コアフレームワーク）
dotenv       # 環境変数の読み込み
nodemailer   # Gmail SMTP によるメール送信
```

### 5.2 内部依存関係図（テキストベース）

```
index.ts
├── discord.js (Client, REST, Routes)
├── dotenv
├── handlers/
│   ├── guildMemberAdd.ts
│   ├── interactionCreate.ts
│   │   ├── commands/verify.ts
│   │   ├── commands/profile.ts
│   │   ├── commands/unverify.ts
│   │   └── utils/leaderboard.ts (handleButton)
│   ├── messageCreate.ts
│   │   └── utils/activity.ts (trackMessage)
│   └── voiceStateUpdate.ts
│       └── utils/activity.ts (trackVoiceTime)
├── commands/*.ts
│   └── utils/
│       ├── profile.ts
│       ├── notification.ts
│       └── email.ts
└── utils/
    ├── leaderboard.ts
    │   ├── discord.js (EmbedBuilder, ButtonBuilder...)
    │   └── utils/activity.ts (getLeaderboard)
    ├── activity.ts
    │   └── node:fs/promises (readFile, writeFile)
    ├── profile.ts
    │   └── node:fs/promises
    ├── notification.ts
    │   └── discord.js
    ├── email.ts
    │   ├── nodemailer
    │   └── node:process
    └── format-date.ts
        └── （純粋関数、外部依存なし）
```

### 5.3 データフローと依存の方向

- **トップダウン**: `index.ts` → `handlers/` → `commands/` / `utils/`
- **横断**: `handlers/interactionCreate.ts` が `commands/` と `utils/leaderboard.ts` を橋渡し
- **永続化層**: `utils/activity.ts`, `utils/profile.ts` がファイルシステムに直接アクセス
- **外部サービス**: `utils/email.ts` → Gmail SMTP, `utils/notification.ts` → Discord API

---

## 6. 既知の制約と設計上の注意点

| 制約 | 影響 | 対応策（現状） |
|------|------|-------------|
| メモリ上のセッション (`sessions`, `voiceSessions`) | Bot 再起動で認証中/VC参加中の状態が失われる | クリーンシャットダウン（SIGINT）でのフラッシュのみ対応 |
| メモリ上のメッセージID (`messageIds`) | 再起動後にランキングメッセージが重複投稿される | なし（設計上の制約） |
| JSON ファイルの毎回全件書き込み | ユーザー数増加時に I/O 遅延が発生する可能性 | メモリバッファで緩和 |
| `SIGTERM` 未対応 | systemd/Docker/PM2 環境でクリーンシャットダウンが実行されない | なし |
| `unhandledRejection` でのプロセス継続 | 内部状態が不整合になったまま動作し続けるリスク | なし |
