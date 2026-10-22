# ニュースの情報源

SPEC 6章の初期リストのフィード URL を検証した結果。登録した情報源は `app/public/data/sources.json`、collector だけが使う設定（一次情報かどうか、代わりのタグ、取り込む件数など）は `collector/src/news/profiles.ts` にある。

検証日: 2026-10-23（User-Agent `itnews-pwa-collector/0.1` で取得し、robots.txt を確認した）

## 登録した情報源（48件）

| 分類 | 情報源（sources.json の id） |
|---|---|
| AI一次情報 | OpenAI（openai）, Google AI（google-ai）, Google DeepMind（google-deepmind）, Google Research（google-research）, Microsoft AI Blog（microsoft-ai）, Microsoft Research（microsoft-research）, AWS ML（aws-ml）, NVIDIA Blog（nvidia-blog）, NVIDIA Technical Blog（nvidia-developer）, Mistral AI（mistral）, Hugging Face（hugging-face）, GitHub Blog（github-blog） |
| AIメディア | ITmedia AI+（itmedia-aiplus）, AINOW（ainow）, TechCrunch AI（techcrunch-ai）, MIT Technology Review の AI（mit-technology-review）, Simon Willison（simon-willison）, Latent Space（latent-space） |
| 開発者コミュニティ | Zenn（zenn）, Qiita（qiita）, はてなブックマーク テクノロジー（hatena-it）, Hacker News（hacker-news。hnrss.org 経由） |
| IT全般（国内） | Publickey（publickey）, @IT（atmarkit）, ITmedia NEWS（itmedia-news）, 日経クロステック（nikkei-xtech）, INTERNET Watch（impress-watch）, gihyo.jp（gihyo）, CodeZine（codezine）, GIGAZINE（gigazine） |
| セキュリティ（国内） | JPCERT/CC（jpcert）, IPA（ipa）, Security NEXT（security-next）, ScanNetSecurity（scannetsecurity）, piyolog（piyolog）, トレンドマイクロ（trendmicro。FeedBurner 経由）, LAC WATCH（lac） |
| セキュリティ（海外） | The Hacker News（the-hacker-news）, BleepingComputer（bleepingcomputer）, Krebs on Security（krebs-on-security）, SecurityWeek（securityweek）, Dark Reading（dark-reading）, CISA KEV（cisa-kev。公式の JSON）, Google Project Zero（project-zero）, Unit 42（unit42） |
| 論文 | arXiv cs.AI（arxiv-cs-ai）, cs.CL（arxiv-cs-cl）, cs.CR（arxiv-cs-cr） |

補足:

- Google AI/DeepMind は Google AI・DeepMind・Research の3つ、Microsoft は AI Blog・Research の2つに分けて登録した
- CISA KEV は RSS がないので、公式の JSON カタログを読む
- arXiv は1日に数百件あるので、1回の取得で30件まで取り込む。cs.CR はキーワードでタグが付く論文だけを残す

## 除外した情報源

| 情報源 | 理由 |
|---|---|
| Anthropic | 公式の RSS がない（`/rss.xml`・`/news/rss.xml` は 404。ページにもフィードの告知がない） |
| Meta AI | 公式の RSS がない（`ai.meta.com/blog/rss/` は 404） |
| Ledge.ai | RSS が見つからない（`/feed/`・`/rss` などはすべて 404） |
| The Decoder | robots.txt が `*/feed/` を禁止している |
| VentureBeat AI | サイトのフィードは HTTP 429 で拒否される。FeedBurner 版は 2026-09-03 で更新が止まっている |
| Reddit（r/LocalLLaMA 等） | robots.txt が全体を禁止している（`User-agent: *` / `Disallow: /`） |
| GitHub Trending | RSS がなく、取得するには HTML のスクレイピングが必要 |
| ZDNET Japan | RSS の URL が HTML を返す。ページにもフィードの告知がない |
| NISC | RSS が見つからない（候補の URL はすべて HTML を返す） |
| NTTセキュリティ | RSS が見つからない（候補の URL はすべて HTML を返す） |
| Microsoft MSRC | ブログに RSS がない。Update Guide の RSS は CVE ごとの更新情報で、件数が多すぎる |
| Hugging Face Daily Papers | 公式の RSS がない（`/papers/rss` は 401） |

## 取得のルール（SPEC 7章）

- robots.txt で禁止されたフィードは取得しない（`itnews-pwa-collector` のグループ、なければ `*` のグループに従う）。robots.txt が 5xx のときは取得しない
- 同じホストへの連続アクセスは2秒あける。1回の取得は20秒で打ち切る
- 失敗した情報源はログに残して飛ばし、他の情報源の処理は続ける。すべて失敗したときは news.json を更新しない

フィードが取得できなくなったら、`npm run collect:news` のログ（`[news] <id>: 取得に失敗`）で分かる。URL を直すか、この表に移して sources.json から外す。
