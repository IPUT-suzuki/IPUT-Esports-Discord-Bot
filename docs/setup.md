# セットアップガイド

IPUT Esports Discord Bot のローカル開発環境および本番環境のセットアップ手順です。

---

## 要件

| 項目 | バージョン |
|------|-----------|
| Node.js | 20.x 以上 |
| npm | 10.x 以上 |
| Git | 任意 |

---

## 1. リポジトリのクローン

```bash
git clone https://github.com/IPUT-suzuki/IPUT-Esports-Discord-Bot.git
cd IPUT-Esports-Discord-Bot
```

---

## 2. 依存パッケージのインストール

```bash
npm install
```

---

## 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、各値を設定します。

```bash
cp .env.example .env
```

### 必要な環境変数

| 変数名 | 説明 | 取得方法 |
|--------|------|----------|
| `DISCORD_TOKEN` | Bot のトークン | [Discord Developer Portal](https://discord.com/developers/applications) で作成 |
| `CLIENT_ID` | Bot の Application ID | Developer Portal の General Information から |
| `GUILD_ID` | 対象サーバーの ID | Discord 上で右クリック →「サーバーIDをコピー」|
| `GMAIL_ADDRESS` | 認証メール送信元の Gmail | 専用アカウントを推奨 |
| `GMAIL_APP_PASSWORD` | Gmail のアプリパスワード | Google アカウント設定で生成（2段階認証必須）|
| `NOTIFICATION_CHANNEL_ID` | 運営通知用チャンネルID | Discord 上で右クリック →「チャンネルIDをコピー」|
| `LEADERBOARD_MONTHLY_CHANNEL_ID` | 月間ランキング表示チャンネルID | 同上 |
| `LEADERBOARD_YEARLY_CHANNEL_ID` | 年度間ランキング表示チャンネルID | 同上 |

### Discord Bot の作成手順

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」→ 名前を入力して作成
3. 左メニュー「Bot」→「Add Bot」
4. `DISCORD_TOKEN` をコピー（**一度しか表示されません**）
5. 「Privileged Gateway Intents」で以下を有効化：
   - Server Members Intent
   - Message Content Intent
6. 左メニュー「OAuth2」→「URL Generator」
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Manage Roles`, `Send Messages`, `Embed Links`, `Read Message History`, `View Channels`, `Connect`, `Speak`
   - 生成されたURLをブラウザで開いてサーバーに招待

### Gmail アプリパスワードの取得

1. [Google アカウント](https://myaccount.google.com/) にアクセス
2. 「セキュリティ」→「2段階認証プロセス」を有効化（必須）
3. 「アプリ パスワード」→ アプリを選択 →「その他」→ 名前を入力 → 生成
4. 表示された16文字のパスワードを `GMAIL_APP_PASSWORD` に設定

---

## 4. サーバー設定（Discord上）

Bot を動作させるサーバーで以下のロールを事前に作成してください。

| ロール名 | 用途 | 備考 |
|----------|------|------|
| `未認証` | 新規参加メンバーに付与 | 参加時に自動付与 |
| `認証済み` | 認証完了メンバーに付与 | `/verify` 完了時に付与 |
| `運営` | 管理者用 | `/profile user`, `/unverify` の実行に必要 |
| `Game:*` | ゲームロール（任意） | `profile` コマンドで表示されます |

**重要**: Bot のロールは、付与・削除対象のロールよりも上位に配置してください。そうでないと権限エラーが発生します。

---

## 5. 開発モードでの起動

TypeScript を直接実行します（ホットリロードなし）。

```bash
npm run dev
```

---

## 6. 本番ビルド・起動

```bash
npm run build      # TypeScript を dist/ にコンパイル
npm start          # dist/index.js を実行
```

---

## 7. 型チェック

ビルドなしで型エラーを確認できます。

```bash
npm run typecheck
```

---

## 8. トラブルシューティング

### スラッシュコマンドが表示されない

- Bot がサーバーに正しく招待されているか確認
- `CLIENT_ID` と `GUILD_ID` が正しいか確認
- グローバルコマンドの反映には最大1時間かかる場合があります（開発時は `GUILD_ID` を使ったギルドコマンドに変更を推奨）

### メールが送信されない

- `GMAIL_ADDRESS` と `GMAIL_APP_PASSWORD` が正しいか確認
- Gmail の「安全性の低いアプリのアクセス」は無効化されています。**アプリパスワードを使用してください**
- 大学のメールサーバー（`@tks.iput.ac.jp`）側で迷惑メールフィルタに引っかかっている可能性があります

### ロール付与に失敗する

- Bot のロールが対象ロールより上位にあるか確認
- Bot に「ロールの管理」権限があるか確認

### データファイルが見つからない

- 初回起動時は `src/data/verified.json` と `src/data/activity.json` が自動作成されます
- `src/data/` ディレクトリが存在しない場合は手動で作成してください

---

## 9. PM2 などでの永続化（推奨）

本番環境では [PM2](https://pm2.keymetrics.io/) などのプロセスマネージャでの運用を推奨します。

```bash
npm install -g pm2
pm2 start dist/index.js --name "iput-esports-bot"
pm2 save
pm2 startup
```
