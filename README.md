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
| `app/public/data/events.json` | イベント（フェーズ6で収集に置き換えるまではモック） |
| `app/mock/` | 開発・テスト用のモック（news.json・sources.json） |

`npm run dev` では、`app/public/data/` にないファイル（収集前の news.json）の代わりに `app/mock/` のモックを返す。`npm run collect:news` を実行すると実データが表示される。収集は前回の news.json を読み込んで追記し、30日より古い記事を削除する。

## アイコン

`app/public/icon.svg` を元に、PWA のアイコン（`pwa-*.png`、`maskable-icon-512x512.png`、`apple-touch-icon-180x180.png`、`favicon.ico`）を生成してコミットしている。元画像を変えたら次で作り直す。

```sh
npm run icons -w app
```
