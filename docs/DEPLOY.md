# デプロイ手順

GitHub Actions で毎時ニュースとイベントを収集し、ビルドして Cloudflare Pages に置く。
サイトは Cloudflare Access で守り、登録したメールアドレスにワンタイムPIN（メールOTP）を送ってログインする。

```
GitHub Actions（.github/workflows/deploy.yml）
  push（main）・毎時17分・手動 → 収集 → ビルド → wrangler pages deploy
        ↓
Cloudflare Pages（<project>.pages.dev）← Cloudflare Access（メールOTP）
```

## 1. ワークフローの動き

| きっかけ | 内容 |
|---|---|
| `main` への push | `npm run check` → 収集 → ビルド → デプロイ |
| 毎時17分（cron） | 収集 → ビルド → デプロイ（コードは変わらないので `npm run check` は省く） |
| 手動（Actions 画面の「Run workflow」） | push と同じ |

- `news.json`・`events.json` は git に含めない。前回の実行で保存したものを Actions のキャッシュから戻し、収集で追記してから、次回のために保存し直す
- キャッシュが消えたとき（7日使われない、手動で削除した、など）は空から集め直す。記事は30日分がそろうまで少なくなる
- 一部の情報源が失敗してもデプロイは続ける。すべて失敗したときは前回のファイルをそのまま使う。前回のファイルもない（初回で全滅した）ときはデプロイしない
- 同時に2つは走らせない。前の実行が終わるまで次は待つ
- GitHub の cron は混雑すると数分〜数十分遅れることがある。また、60日間 push がないリポジトリでは定時実行が自動で止まるので、そのときは Actions 画面で有効に戻す

## 2. Secrets と Variables

GitHub のリポジトリの **Settings → Secrets and variables → Actions** で登録する。値はコミットしない。

| 種類 | 名前 | 必須 | 内容 |
|---|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | 必須 | Cloudflare Pages へデプロイするための API トークン（3.2） |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | 必須 | Cloudflare のアカウント ID（3.3） |
| Secret | `CONNPASS_API_KEY` | 任意 | connpass API v2 のキー。未登録なら connpass だけ取得しない |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | 必須 | Cloudflare Pages のプロジェクト名（3.1） |

フェーズ8（プッシュ通知）で VAPID 鍵と購読情報の Secrets を追加する予定。

## 3. Cloudflare Pages の準備

### 3.1 プロジェクトを作る

手元で一度だけ実行する（ブラウザで Cloudflare へのログインを求められる）。`<project>` は好きな名前にする。これが `https://<project>.pages.dev` の URL になり、Variable `CLOUDFLARE_PAGES_PROJECT` に登録する名前になる。

```sh
npx wrangler@4 login
npx wrangler@4 pages project create <project> --production-branch=main
```

ダッシュボードの **Workers & Pages → Create → Pages → Direct Upload** から作ってもよい。Git 連携（Connect to Git）では作らない（ビルドは GitHub Actions で行う）。

### 3.2 API トークンを作る

1. Cloudflare ダッシュボード右上のアイコン → **My Profile → API Tokens → Create Token**
2. **Custom token** の「Get started」を選ぶ
3. Permissions: **Account / Cloudflare Pages / Edit**
4. Account Resources: **Include / 自分のアカウント**
5. 作成して表示された値を Secret `CLOUDFLARE_API_TOKEN` に登録する（値は一度しか表示されない）

### 3.3 アカウント ID を調べる

ダッシュボードの **Workers & Pages** を開き、右側の「Account ID」をコピーして Secret `CLOUDFLARE_ACCOUNT_ID` に登録する。

## 4. GitHub の準備

1. GitHub にリポジトリを作り、このリポジトリを push する

   ```sh
   git remote add origin git@github.com:<user>/<repo>.git
   git push -u origin main
   ```

2. 2章の Secrets と Variables を登録する
3. **Actions** タブで `deploy` を選び、「Run workflow」で一度手動実行して成功を確かめる

### Actions の利用時間について

- 公開（public）リポジトリなら、Actions の利用時間は無料で制限がない
- 非公開（private）リポジトリは、無料プランで月2,000分まで。毎時の実行は月に約720回で、1回あたりの時間は分単位に切り上げて数える。1回3分かかると月2,160分になり、上限を超える
- 非公開にしたいときは、Actions 画面で1回の時間を確かめ、2分を超えるなら cron の間隔を広げる（例: `'17 */2 * * *'` で2時間ごと）
- リポジトリには秘密情報を含めていない（すべて Secrets に置く）ので、公開しても中身から漏れるものはない。収集したデータ（news.json・events.json）もリポジトリには入らない

## 5. Cloudflare Access（メールOTP認証）

`*.pages.dev` は誰でも開けるので、Access で本番の URL とプレビューの URL の両方を守る。
Access は50ユーザーまで無料。

### 5.1 Zero Trust を有効にする（初回のみ）

1. Cloudflare ダッシュボードの左メニューから **Zero Trust** を開く
2. チーム名（`<team>.cloudflareaccess.com` になる）を決め、**Free** プランを選ぶ。支払い方法の登録を求められることがあるが、Free プランなら請求されない

### 5.2 ログイン方法を確認する

**Zero Trust → Settings → Authentication → Login methods** に **One-time PIN** があることを確認する（初めから有効になっている）。

### 5.3 アプリケーションを作る

1. **Zero Trust → Access → Applications → Add an application → Self-hosted**
2. Application name: `IT News`（任意）
3. Session Duration: **1 month**（ホーム画面のアプリで頻繁にログインし直さなくて済むように）
4. 守る URL（Public hostname / Application domain）を2つ登録する
   - Subdomain なし、Domain `<project>.pages.dev`（本番）
   - Subdomain `*`、Domain `<project>.pages.dev`（デプロイごとの URL `xxxx.<project>.pages.dev` とプレビュー）
5. Policy を追加する
   - Policy name: `本人のみ`
   - Action: **Allow**
   - Include: **Emails** → 自分のメールアドレス
6. Login methods で **One-time PIN** が選ばれていることを確認して保存する

画面の項目名は Cloudflare の更新で変わることがある。迷ったら「Self-hosted application」「One-time PIN」の公式ドキュメントを参照する。

なお、Pages プロジェクトの **Settings → General → Access policy** を有効にすると、プレビューの URL だけを守るアプリケーションが自動で作られる。本番の URL は守られないので、5.3 のアプリケーションは必ず作る。

### 5.4 認証なしでは開けないことを確かめる

1. ブラウザのプライベートウィンドウで `https://<project>.pages.dev/` を開く → Cloudflare Access のログイン画面が出る
2. データの URL も守られていることを確かめる。302 で `cloudflareaccess.com` に転送されれば守られている

   ```sh
   curl -sI https://<project>.pages.dev/data/news.json | grep -iE '^(HTTP|location)'
   ```

3. Actions のログに出るデプロイごとの URL（`https://xxxx.<project>.pages.dev`）も同じように確かめる
4. ログイン画面で自分のメールアドレスを入れ、届いたコードを入力すると開ける。ほかのアドレスではコードが届かない（登録していないアドレスには送られない）

### 5.5 iPhone で使う

1. Safari で `https://<project>.pages.dev/` を開き、メールのコードでログインする
2. 共有メニュー → **ホーム画面に追加**
3. ホーム画面のアイコンから開く。セッションが切れたときは、ログイン画面が出るのでもう一度コードを入れる。オフラインのときは前回のデータを表示する

manifest は Access の Cookie を付けて取得する設定にしている（`app/pwa.config.ts` の `useCredentials`）。Service Worker は `/cdn-cgi/` 以下（Access のログイン・ログアウト）をアプリの画面で置き換えない。

## 6. うまくいかないとき

| 症状 | 確認すること |
|---|---|
| デプロイで `Authentication error` | `CLOUDFLARE_API_TOKEN` の権限（Cloudflare Pages / Edit）と、`CLOUDFLARE_ACCOUNT_ID` |
| デプロイで `Project not found` | Variable `CLOUDFLARE_PAGES_PROJECT` が 3.1 で作った名前と一致しているか |
| `app/public/data/news.json がない` で止まる | 初回の収集がすべて失敗した。ログの `[news]`・`[events]` を見て、時間をおいて再実行する |
| connpass のイベントが出ない | `CONNPASS_API_KEY` を登録したか。ログに「CONNPASS_API_KEY が未設定」と出ていないか |
| 定時実行が止まった | 60日間 push がないと止まる。Actions 画面で `deploy` を有効に戻す |
