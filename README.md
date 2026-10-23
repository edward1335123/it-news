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
| `npm run collect:news` | ニュースを収集して `app/public/data/news.json` を作る |
| `npm run collect:events` | イベントを収集して `app/public/data/events.json` を作る |
| `npm run lint` | ESLint と Prettier のチェック |
| `npm run format` | Prettier で整形する |
| `npm run typecheck` | 全ワークスペースの型チェック |
| `npm run test` | Vitest でテストを実行する |
| `npm run check` | lint・typecheck・test をまとめて実行する |

## データ

| ファイル | 内容 |
|---|---|
| `app/public/data/news.json` | `npm run collect:news` で作る実データ（git には含めない） |
| `app/public/data/sources.json` | ニュースの情報源（検証結果は [docs/SOURCES.md](docs/SOURCES.md)） |
| `app/public/data/events.json` | `npm run collect:events` で作る実データ（git には含めない）。手動管理分は `data/manual-events.json`（[docs/EVENTS.md](docs/EVENTS.md)） |
| `app/mock/` | 開発・テスト用のモック（news.json・events.json・sources.json） |

`npm run dev` では、`app/public/data/` にないファイル（収集前の news.json・events.json）の代わりに `app/mock/` のモックを返す。`npm run collect:news`・`npm run collect:events` を実行すると実データが表示される。収集は前回のファイルを読み込んで追記し、記事は30日、イベントは終了したものを削除する。

connpass も取得するときは、API キーを環境変数に入れて実行する（キーはコミットしない）。

```sh
CONNPASS_API_KEY=xxxx npm run collect:events
```

## アイコン

`app/public/icon.svg` を元に、PWA のアイコン（`pwa-*.png`、`maskable-icon-512x512.png`、`apple-touch-icon-180x180.png`、`favicon.ico`）を生成してコミットしている。元画像を変えたら次で作り直す。

```sh
npm run icons -w app
```

## デプロイ

GitHub Actions（`.github/workflows/deploy.yml`）が、`main` への push と3時間ごとの定時実行で、収集 → ビルド → Cloudflare Pages へのデプロイを行う。サイトは Cloudflare Access（メールOTP）で守る。準備の手順と Secrets の一覧は [docs/DEPLOY.md](docs/DEPLOY.md) を参照。
