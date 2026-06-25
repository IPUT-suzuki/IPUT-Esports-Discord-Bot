# IPUT Esports Discord Bot - Documentation

IPUT Esports サークル向け Discord Bot のドキュメントです。

## Quick Links

| セクション | 内容 |
|-----------|------|
| [Setup Guide](./guides/setup.md) | 初回セットアップ手順 |
| [Handover Guide](./guides/handover.md) | 次期管理者向け引き継ぎガイド |
| [Student Verification](./features/student-verification.md) | 学籍番号認証機能の仕様 |
| [Admin Notification](./features/admin-notification.md) | 認証完了時の運営通知機能の仕様 |
| [Directory Structure](./architecture/directory-structure.md) | プロジェクト構成と命名規則 |
| [Data Flow](./architecture/data-flow.md) | 認証フローの全体図 |
| [Environment & Operations](./operations/environment.md) | 環境変数とデータ管理方針 |

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| **Name** | IPUT-Esports-Discord-Bot |
| **Language** | TypeScript (ES2023) |
| **Runtime** | Node.js |
| **Framework** | discord.js v14 |
| **Module System** | ES Modules (`"type": "module"`) |
| **Package Manager** | npm |
| **運用環境** | 自宅サーバー |
