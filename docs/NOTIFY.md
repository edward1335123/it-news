# プッシュ通知の設定

収集のたび（3時間ごと）に、条件に当てはまる新着を iPhone に Web Push で通知する（SPEC 8章）。
通知を送る仕組み（notifier）は GitHub Actions で動く。サーバーは持たないので、iPhone の購読情報はアプリの設定画面に表示し、利用者が GitHub の Secret に登録する。

```
iPhone（ホーム画面の PWA）
  設定 → 通知を受け取る ON → 表示された内容（PUSH_CONFIG）をコピー
        ↓ 手で登録
GitHub Secrets（PUSH_CONFIG・VAPID_PRIVATE_KEY・VAPID_SUBJECT）
        ↓
GitHub Actions（deploy の「新着を通知する」）→ Apple のプッシュサービス → iPhone
```

- iOS 16.4 以降で、ホーム画面に追加した PWA でだけ使える（Safari のタブでは使えない）
- 設定の手順は 2〜5章。最初に一度だけ行う

## 1. 通知の動き

| 項目 | 内容 |
|---|---|
| 通知する記事 | CISA KEV への追加、JPCERT の注意喚起、CVSS 9.0 以上（タイトル・抜粋の「CVSS 9.8」などの表記から読む）、注目キーワードを含む記事 |
| 新着とみなす期間 | 公開から48時間以内。それより古い記事は通知しない（初回や長く止まった後に大量に届かないように） |
| 同じ記事 | 一度送った記事は送らない。送信済みの記録（`collector/.state/`）は Actions のキャッシュで引き継ぐ |
| 静かな時間帯 | 設定画面で決める（既定は日本時間 23時〜7時）。この間は送らず、明けた後の実行でまとめて送る |
| 1時間あたりの上限 | 5件。超える分は最後の1件を「ほかに◯件の新着」にまとめる |
| 通知をタップ | 記事を開く（まとめの通知はアプリを開く） |

注目キーワードは、ミュート語と同じく全角・半角や大文字・小文字の違いを区別しない。

## 2. VAPID 鍵を作る

通知の送り主を示す鍵の組。手元で一度だけ作る。

```sh
npm run notify:keys
```

表示された2つの値を、GitHub の **Settings → Secrets and variables → Actions** に登録する。

| 種類 | 名前 | 内容 |
|---|---|---|
| Variable | `VAPID_PUBLIC_KEY` | 表示された `VAPID_PUBLIC_KEY=` の値（公開してよい。ビルドでアプリに埋め込む） |
| Secret | `VAPID_PRIVATE_KEY` | 表示された `VAPID_PRIVATE_KEY=` の値（秘密。ファイルに保存しない） |
| Secret | `VAPID_SUBJECT` | `mailto:自分のメールアドレス`（プッシュサービスが問題のあるときに連絡する先） |

鍵を作り直すと、それまでの購読は使えなくなる。作り直したときは4章からやり直す。

## 3. アプリを更新する

公開鍵をアプリに埋め込むため、デプロイし直す。Actions タブで `deploy` を選び、「Run workflow」で実行する（main への push でもよい）。

## 4. iPhone で購読する

1. ホーム画面のアイコンからアプリを開く（Safari のタブでは使えない）
2. ヘッダーの設定 → 「通知」の **通知を受け取る** を ON にし、通知を許可する
3. 必要なら **注目キーワード** と **静かな時間帯** を変える
4. 「Secret に登録する内容（PUSH_CONFIG）」の **コピー** を押す
5. GitHub の Secret `PUSH_CONFIG` に貼り付けて登録する（iPhone の Safari で GitHub を開いて登録するか、メモ・AirDrop などで PC に送る）

`PUSH_CONFIG` には、購読情報（この端末に通知を送るための URL と鍵）・注目キーワード・静かな時間帯が入る。購読情報を知っていると誰でもこの端末に通知を送れるので、他の人に見せない。

注目キーワードや静かな時間帯を変えたときは、もう一度コピーして `PUSH_CONFIG` を更新する（notifier は Secret の内容だけを見る）。

## 5. テスト送信

Actions タブで `notify-test` を選び、「Run workflow」で実行する。数秒〜数十秒で「IT News テスト通知」が届けば完了。

手元から送るときは、2章・4章の値を環境変数に入れて実行する（値はコミットしない）。

```powershell
# PowerShell
$env:VAPID_PUBLIC_KEY = '...'
$env:VAPID_PRIVATE_KEY = '...'
$env:VAPID_SUBJECT = 'mailto:me@example.com'
$env:PUSH_CONFIG = '{"subscription":{...},"keywords":[],"quietHours":{"start":23,"end":7}}'
npm run notify:test
```

## 6. うまくいかないとき

| 症状 | 確認すること |
|---|---|
| 設定画面に「ホーム画面に追加し…」と出る | Safari のタブで開いている。ホーム画面のアイコンから開く |
| 「VAPID 公開鍵が設定されていない」と出る | Variable `VAPID_PUBLIC_KEY` を登録してから、デプロイし直したか（3章） |
| 「通知が許可されていません」と出る | iPhone の **設定 → 通知 → IT News** で通知を許可する |
| ON にしても切り替わらない | 開発サーバー（`npm run dev`）では Service Worker が動かないので使えない。デプロイしたアプリで試す |
| ログに `プッシュサービスが 410 を返した`（または 404） | 購読が解除された（アプリの削除・再追加、通知の許可の取り消しなど）。4章をやり直す |
| ログに `プッシュサービスが 403 を返した` | 購読したときと鍵が違う。`VAPID_PUBLIC_KEY` と `VAPID_PRIVATE_KEY` が同じ組か確かめ、4章をやり直す |
| ログに `PUSH_CONFIG の形式が正しくない` | コピーした内容を途中で切らずに貼り付けたか |
| テスト通知は届くが、新着の通知が来ない | 静かな時間帯ではないか、条件に当てはまる新着があるか（ログの `[notify]`）。集中モードで通知が止められていないか |
| ログに「未設定のため通知しない」 | 名前の出ている Secret・Variable を登録する（2章・4章） |

notifier が失敗してもデプロイは失敗にしない（Actions の実行には警告が出る）。送れた分だけを送信済みに記録し、残りは次の実行で送る。
