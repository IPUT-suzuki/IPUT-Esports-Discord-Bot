# IPUT-Esports-Discord-Bot

IPUT Esports サークル向けの Discord Bot。
学籍番号によるメンバー認証を中心とし、プロフィール表示・運営通知等の機能を持つ。

## 技術スタック

| 項目 | 内容 |
|------|------|
| **Language** | TypeScript (ES2023) |
| **Runtime** | Node.js |
| **Framework** | discord.js v14 |
| **Module System** | ES Modules (`"type": "module"`) |
| **Package Manager** | npm |
| **運用環境** | 自宅サーバー |

## Development

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev`: Run the TypeScript entrypoint directly.
- `npm run build`: Compile TypeScript into `dist/`.
- `npm start`: Run the compiled JavaScript from `dist/`.
- `npm run typecheck`: Check TypeScript types without emitting files.

## Documentation

詳細なドキュメントは [`docs/README.md`](./docs/README.md) を参照してください。
