# IT News PWA

AI・セキュリティのニュースと、東京・オンラインのITイベントを iPhone で確認するための個人用 PWA。
仕様は [docs/SPEC.md](docs/SPEC.md)、開発計画は [docs/PLAN.md](docs/PLAN.md) を参照。

## 必要なもの

- Node.js 24 以上
- npm 11 以上

## 構成

| ディレクトリ | 内容 |
|---|---|
| `app/` | 画面（Vite + React + TypeScript） |
| `collector/` | ニュース・イベントの収集（Node.js + TypeScript） |
| `shared/` | `app` と `collector` で共有する型・定数 |

## 起動方法

```sh
npm install
npm run dev      # 開発サーバを起動（http://localhost:5173）
```

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバを起動する |
| `npm run build` | `app/dist/` に本番ビルドを出力する |
| `npm run preview` | ビルド結果をローカルで配信する |
| `npm run lint` | ESLint と Prettier のチェック |
| `npm run format` | Prettier で整形する |
| `npm run typecheck` | 全ワークスペースの型チェック |
| `npm run test` | Vitest でテストを実行する |
| `npm run check` | lint・typecheck・test をまとめて実行する |
