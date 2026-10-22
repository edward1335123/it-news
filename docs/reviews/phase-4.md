# フェーズ4 レビュー: PWA化

対象: `e86c425..74bd6bd`（feat(phase4): manifest・アイコン・Service Worker とオフライン表示を追加）

## 検証結果

| 項目 | 結果 |
|---|---|
| `npm run check` | 成功（lint・prettier・typecheck・テスト 156件。修正後は 163件） |
| `npm run build` | 成功（precache 16件。修正後は重複がなくなり 12件） |
| 画面の確認 | `vite preview` をヘッドレス Chrome で開き、CDP で幅 375px（mobile エミュレーション）のライト・ダークを確認した |

Lighthouse 12 以降は PWA カテゴリが廃止されているので、Lighthouse の PWA 要件は Chrome の判定で確かめた。

- `Page.getInstallabilityErrors` はエラーなし。`Page.getAppManifest` でも manifest のエラーはない
- SW が有効になり、事前キャッシュ（12件）と `itnews-data`（data/*.json 3件）ができる
- AI・セキュリティ・イベント・保存の4タブで `scrollWidth = 375` になり、横スクロールは発生しない。記事とイベントに「最終更新 …（…前）」が出る
- オフラインにして再読み込みすると、帯「オフラインです。前回取得したデータを表示しています」と記事40件が出る
- 修正後: 初回訪問で再読み込みせずにオフラインにしても、データが表示される（修正前は2回目の訪問で初めてキャッシュされていた）

完了条件:

- `npm run build && npm run preview` で Lighthouse の PWA 要件を満たす: 満たす（Chrome のインストール判定でエラーなし。上記のとおり）
- iPhone で「ホーム画面に追加」して起動できる: ユーザーの確認待ち。apple-touch-icon（180px）、`apple-mobile-web-app-capable`・`title`・`status-bar-style`、`viewport-fit=cover` とセーフエリア対応はそろっている
- 範囲外の実装（プッシュ通知など）は混ざっていない。追加した依存（`vite-plugin-pwa`、`@vite-pwa/assets-generator`、`workbox-window`）はすべて devDependencies。`dangerouslySetInnerHTML` なし、秘密情報なし

## 指摘一覧

| # | 重要度 | 内容 | 対応 |
|---|---|---|---|
| 1 | 必須 | `registerType: 'autoUpdate'` だけでは、生成した SW に `skipWaiting()`・`clientsClaim()` が入らない。初回訪問のページを SW が制御しないので data/*.json がキャッシュされず、次にオフラインで開くとデータが出ない（SPEC 9章「2回目以降はオフラインでも前回のデータを表示」を満たさない）。新しい SW も、画面をすべて閉じるまで待ち状態のまま残る | 対応済: `skipWaiting`・`clientsClaim` を有効にした。SW が初めて制御したときに data/*.json を取り直す `warmDataCacheOnFirstControl` を追加（テストあり）。実際のブラウザで確認した |
| 2 | 推奨 | オフラインでデータを取得できずエラーが出ているのに、帯が「前回取得したデータを表示しています」と表示する | 対応済: 表示中の画面のデータを取得できているかで文言を変える。テストを追加 |
| 3 | 推奨 | Cloudflare Access の配下では、manifest が Cookie なしで取得され、ログイン画面へのリダイレクトになる | 対応済: `useCredentials: true`（`crossorigin="use-credentials"`） |
| 4 | 推奨 | `navigateFallback` が `/cdn-cgi/access/logout` などの Access の URL まで index.html で返す | 対応済: `navigateFallbackDenylist: [/^\/cdn-cgi\//]`。テストを追加 |
| 5 | 推奨 | Access の Cookie が切れると、data の取得はリダイレクトで失敗し、NetworkFirst が黙ってキャッシュを返し続ける。再ログインの画面へ進めない | 持ち越し: フェーズ7で、実際の Access の挙動を見て決める |
| 6 | 推奨 | オンラインに戻ったときや、アプリが前面に戻ったときにデータを取り直さない | 持ち越し: SPEC 3章の「プルして更新」と合わせて扱う（作業項目にないため） |
| 7 | 任意 | 事前キャッシュで png が2回ずつ登録されている | 対応済: `includeManifestIcons: false` |
| 8 | 任意 | `workbox-window` を使っていない | 対応不要: vite-plugin-pwa の peerDependency |
| 9 | 任意 | `status-bar-style="default"` で、ダークモードのときステータスバーの色が画面と合うか分からない | 持ち越し: 実機で確認する（下記） |
| 10 | 任意 | manifest の `background_color` がライトの色で固定されており、ダークモードでも起動画面が明るい。`orientation: 'portrait'` は SPEC にない指定 | 持ち越し: manifest は1つの色しか指定できない。iOS は orientation を無視するので実害はない |
| 11 | 任意 | オフラインの帯は main の先頭にあり、スクロールすると見えなくなる。375px では2行になり、末尾の「す」だけが折り返す | 持ち越し: `role="status"` で読み上げられるので、今は十分とする |
| 12 | 任意 | manifest に `id` がない | 持ち越し: 今は start_url から導出されるので問題ない |
| 13 | 任意 | `navigator.onLine` が true でもサーバーに届かず、NetworkFirst がタイムアウト（5秒）してキャッシュを返したときは、帯が出ない | 持ち越し: 最終更新時刻が出るので、データの古さには気づける |

フェーズ3から持ち越した指摘の状態:

- .ics を iPhone のホーム画面版でカレンダーに追加できるか: 未確認。下記の確認項目に含める
- 保存した記事の検証が厳密すぎる問題: 引き続きフェーズ5で扱う

## ユーザーが確認すべきこと

- iPhone の Safari で「ホーム画面に追加」し、アイコンと名前（IT News）が正しく出て、全画面（standalone）で起動するか
- 一度開いたあと機内モードにし、ホーム画面から開き直したとき、記事と最終更新時刻が表示されるか
- ダークモードのとき、ステータスバーの色が画面と合っているか（指摘9）
- ホーム画面版で「カレンダーに追加」を押したとき、カレンダーへの追加画面が開くか（フェーズ3の持ち越し）
- 「プルして更新」と、前面に戻ったときの自動更新をどのフェーズで入れるか（指摘6）
