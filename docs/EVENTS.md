# イベントの情報源

`npm run collect:events` が取得するイベントの情報源と、絞り込みのルール。コードは `collector/src/events/` にある。

検証日: 2026-10-23（User-Agent `itnews-pwa-collector/0.1` で取得した）

## 情報源

| 情報源 | 取得方法 | 備考 |
|---|---|---|
| connpass | API v2（`https://connpass.com/api/v2/events/`） | 環境変数 `CONNPASS_API_KEY` が必要。未設定ならスキップする（エラーにしない）。東京と「オンライン」の都道府県を、今月から3か月分検索する |
| Doorkeeper | API（`https://api.doorkeeper.jp/events`） | 認証なしで取得できる。全国の注目イベントを今日から90日分取得し、collector で絞り込む |
| TECH PLAY | RSS（`https://rss.techplay.jp/event/w3c-rss-format/rss.xml`） | 新着50件のみ。過去に取得したイベントは終了まで events.json に残す |
| 公式サイト | ページに埋め込まれた schema.org の Event（JSON-LD） | `collector/src/events/sources/official.ts` の `OFFICIAL_SITES` に登録する。HTML の本文は解析しない |
| 手動管理 | `data/manual-events.json` | 下記の書き方を参照 |

### 公式サイト

| サイト | ページ |
|---|---|
| Japan IT Week 春・秋 | `https://www.japan-it.jp/spring/ja-jp.html`・`/autumn/ja-jp.html` |
| NexTech Week 春・秋（AI・人工知能EXPO などを含む） | `https://www.nextech-week.jp/spring/ja-jp.html`・`/autumn/ja-jp.html` |

- 会場が幕張メッセの回（Japan IT Week 秋など）は、東京ではないので取り込まれない
- Interop Tokyo・CEATEC などは JSON-LD がないため登録していない。必要なら手動管理のファイルに書く
- JSON-LD に Event がなくなったサイトは、ログに `official:<id>: 取得に失敗（ページに Event の JSON-LD がない）` と出る

### robots.txt と API

- RSS と公式サイトは、ニュースと同じく robots.txt を確認し、同じホストへの連続アクセスは2秒あける
- connpass と Doorkeeper の robots.txt は、API の URL を含めてサイト全体を禁止している（`User-agent: *` / `Disallow: /`）。これはクローラー向けの指定で、API は各サービスが案内している正規の利用方法なので、robots.txt は確認しない。代わりに API の利用規約と制限（connpass は1秒に1リクエスト、Doorkeeper は5分に300リクエスト）を守り、API は1.1秒の間隔で呼ぶ
- connpass は、API 以外の方法（ページのスクレイピングなど）でのアクセスを利用規約で禁止している

## 絞り込みと推定

| 項目 | ルール |
|---|---|
| 東京＋オンライン | 会場・住所が空か「オンライン」などだけなら `online`。東京の会場で、オンラインでも参加できれば `hybrid`、そうでなければ `offline`。東京以外の会場は除く（オンラインでも参加できれば `online`）。会場が未定なら、タイトルの地名（「【神戸開催】」など）に従う |
| IT・AI・セキュリティ関連 | タイトル・説明文の先頭200字・情報源のカテゴリに、ニュースの AI・セキュリティの語か、IT の語（エンジニア・クラウド・Python など）があるもの |
| 種別 | タイトルに展示会の語（展示会・EXPO など）があれば `expo`、カンファレンスの語（カンファレンス・Summit・Days・Kaigi・PyCon など）があるか定員500人以上なら `conference`、それ以外は `meetup` |
| タグ | ニュースと同じキーワード辞書（SPEC 4章）で付ける |
| 重複 | タイトルと開始日時が同じイベントは1件にまとめる（手動管理 > connpass > Doorkeeper > TECH PLAY の順に残す） |
| 保持 | 終了したイベントを消す。終了日時がなければ開始日の終わりまで残す。connpass で中止になったイベントは消す |

日時にタイムゾーンがなければ日本時間とみなし、events.json には日本時間（`+09:00`）で出力する。

## 手動管理のファイル（`data/manual-events.json`）

展示会・カンファレンスのうち、公式サイトから取得できないものを書く。events.json の TechEvent（SPEC 5章）から `source` を除いた形で書く。

```json
{
  "events": [
    {
      "id": "manual-example-2027",
      "title": "Example Conference 2027",
      "url": "https://example.com/",
      "type": "conference",
      "format": "hybrid",
      "startAt": "2027-06-09T10:00:00+09:00",
      "endAt": "2027-06-10T18:00:00+09:00",
      "venue": "東京国際フォーラム",
      "address": "東京都千代田区丸の内3-5-1",
      "organizer": "Example 実行委員会",
      "tags": ["ai-business"]
    }
  ]
}
```

- `id` は `manual-` で始め、ファイルの中で重ならないようにする（`manual-official-` は公式サイトの取得に使うので使えない）
- `type` は `expo` / `conference` / `meetup`、`format` は `offline` / `online` / `hybrid`、`tags` は SPEC 4.1/4.2 の ID
- 日時はタイムゾーン付きで書く。終わったイベントは自動で表示されなくなるので、消さなくてよい
- 形式が正しくないイベントは、ログ（`[events] manual-events.json: ...`）に理由を出して読み飛ばす
- ファイルから消したイベントは、次の収集で events.json からも消える
