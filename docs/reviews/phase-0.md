# フェーズ0 レビュー結果

- 対象コミット: `6e7ded2 feat(phase0): npm workspaces のモノレポ土台を構築`
- 判定: **合格**（必須の指摘なし）

## 検証結果

| 項目 | 結果 |
|---|---|
| `npm run check` | 成功（ESLint、Prettier、tsc でルートと3ワークスペース、Vitest 3件） |
| `npm run build` | 成功（`app/dist/` に出力） |
| `npm run dev` | 起動し、`http://localhost:5173/` が 200 を返す。`@itnews/shared` の import も解決できる |
| `npm start -w collector` | tsx で実行でき、shared を参照できる |
| `npm audit` | 脆弱性 0 件 |
| ESLint のルール | `any` は全ワークスペースで、`dangerouslySetInnerHTML` は app でエラーになる |
| 375px での表示 | 画面を含まないフェーズのため対象外 |

## 指摘一覧

| # | 重要度 | 内容 | 対応 |
|---|---|---|---|
| 1 | 推奨 | `lint` に `--max-warnings 0` がなく、警告では `check` が失敗しない | **対応済**（`package.json`） |
| 2 | 推奨 | `app/tsconfig.json` で `vite.config.ts` と `src` が同じ設定を使っており、ブラウザ側のコードでも Node の型（`process` など）が使えてしまう | **対応済**（`tsconfig.app.json` と `tsconfig.node.json` に分け、`tsc -b` で両方を検査する。`src` で `process` が型エラーになることを確認） |
| 3 | 任意 | Vitest の環境が `node` のまま | 持ち越し（フェーズ2で表示テストを足すときに jsdom または happy-dom へ切り替える） |
| 4 | 任意 | `tsx`、`@types/node`、`vitest` がルートにしかない。ワークスペース単位でインストールすると動かない | 持ち越し（フェーズ7で、CI はルートで `npm ci` すると決めて明記する） |
| 5 | 任意 | `.gitignore` に `.dev.vars`、`.wrangler/`、鍵ファイル（`*.pem`）がない | 持ち越し（フェーズ7・8で追加する） |
| 6 | 任意 | `.nvmrc` がない（`import.meta.main` には Node 24.2 以上が必要） | 持ち越し（フェーズ7で Actions の `node-version-file` と合わせて追加する） |
| 7 | 任意 | `exactOptionalPropertyTypes` が zod の推論型とぶつかりやすい | 持ち越し（フェーズ1で `z.infer` を型の正とするかどうか決める） |

## ユーザーが確認すべきこと

- `npm run dev` を実行し、ブラウザで「IT News」と表示されることを確認してください（レビューでは HTTP 応答と import の解決までを確認しました）。
- Node.js 24.2 以上を使っていることを確認してください。
