# 仕様書: IT News PWA

ITエンジニア（東京在住）が、AI・セキュリティのニュースと、東京・オンラインのITイベントを iPhone ですぐに確認するための個人用 PWA。

## 1. 基本方針

| 項目 | 決定事項 |
|---|---|
| 形式 | PWA（iPhone Safari で「ホーム画面に追加」） |
| 利用者 | 本人のみ（Cloudflare Access で認証） |
| AI要約・翻訳 | なし。英語記事は原題のまま表示 |
| 情報源の言語 | 日本語＋英語 |
| 更新頻度 | 1時間ごと |
| 費用 | 無料枠のみで運用 |

## 2. アーキテクチャ

```
GitHub Actions（cron: 毎時）
  ├─ collector: RSS/API を取得 → 正規化 → 重複除去 → 分類・タグ付け → data/news.json
  ├─ collector: イベントを取得 → 東京＋オンラインで絞り込み → data/events.json
  └─ notifier: 通知条件に一致した新着を Web Push で送信
        ↓ デプロイ
Cloudflare Pages（静的ホスティング）＋ Cloudflare Access（メールOTP認証）
        ↓
iPhone（PWA）: JSON を取得して表示。既読・お気に入り・設定は端末内（IndexedDB/localStorage）に保存
```

- 技術: Vite + React + TypeScript（`app/`）、Node.js + TypeScript（`collector/`）
- 秘密情報（connpass APIキー、VAPID鍵、Push購読情報）は GitHub Actions Secrets に保存し、フロントエンドには含めない

## 3. 画面

下部のタブバーで切り替える。

| タブ | 内容 |
|---|---|
| AI | サブカテゴリのチップで絞り込み（下記 4.1） |
| セキュリティ | サブカテゴリのチップで絞り込み（下記 4.2） |
| イベント | 開催日が近い順。種別・開催形式で絞り込み。.ics でカレンダーに追加 |
| 保存 | お気に入り・後で読む |
| 設定（ヘッダーから開く） | ミュート語、情報源ごとの ON/OFF、通知設定、表示設定 |

共通機能:
- 記事カード: タイトル、情報源、公開日時（相対表示）、タグ、注目度バッジ、「他◯件の報道」
- 未読のみ表示、既読管理（開いたら既読）、キーワード検索、プルして更新
- ダークモード（OS設定に追従）、セーフエリア対応、片手で操作しやすいレイアウト

## 4. カテゴリ・タグ

1つの記事に複数のタグを付けられる。情報源の既定カテゴリとキーワード辞書で自動判定する。

### 4.1 AI サブカテゴリ
| ID | 名称 | 主な対象 |
|---|---|---|
| `ai-dev` | AI駆動開発 | Claude Code, Cursor, Copilot, Codex, Devin, Kiro, Vibe Coding, 仕様駆動開発, AIテスト/レビュー |
| `ai-agent` | AIエージェント | エージェントFW, MCP, A2A, ブラウザ/PC操作, ワークフロー自動化 |
| `ai-model` | モデル・LLM | 新モデル, ベンチマーク, API/料金変更 |
| `ai-oss` | ローカルLLM/OSS | Hugging Face, Ollama, llama.cpp, オープンウェイト |
| `ai-multimodal` | マルチモーダル | 画像/動画/音声生成, 音声対話 |
| `ai-research` | 研究・論文 | arXiv, リサーチブログ |
| `ai-business` | ビジネス・事例 | 導入事例, 資金調達, M&A |
| `ai-policy` | 規制・政策 | AI法, 著作権, ガイドライン |
| `ai-security` | AIセキュリティ | プロンプトインジェクション, モデル攻撃, AI悪用（セキュリティタブにも表示） |
| `ai-infra` | インフラ・GPU | NVIDIA, データセンター, 推論基盤 |

### 4.2 セキュリティ サブカテゴリ
| ID | 名称 |
|---|---|
| `sec-vuln` | 脆弱性・CVE |
| `sec-incident` | インシデント・侵害 |
| `sec-malware` | マルウェア・ランサムウェア |
| `sec-advisory` | 注意喚起（JPCERT/IPA/CISA等） |
| `sec-cloud` | クラウド・ID |
| `ai-security` | AIセキュリティ（AIタブと共有） |

### 4.3 イベント種別
`expo`（大型展示会） / `conference`（企業カンファレンス） / `meetup`（勉強会・ミートアップ）
開催形式: `offline`（東京） / `online` / `hybrid`

## 5. データ形式

フェーズ1で確定。この章を正とし、`shared/src/schemas.ts`（zod スキーマ。型は `z.infer` で導出する）がこれを実装する。

- `news.json`: `{ generatedAt: string; articles: Article[] }`
- `events.json`: `{ generatedAt: string; events: Event[] }`
- `sources.json`: `{ sources: Source[] }`
- URL は http/https のみ、日時はタイムゾーン付きの ISO 8601、`summary` は200字以内、`tags` は 4.1/4.2 の ID（重複不可）、ID は各ファイル内で一意
- `Event.endAt` は `startAt` 以降、`capacity`・`accepted` は0以上の整数

```ts
type Article = {
  id: string;              // 正規化URLのハッシュ
  title: string;
  url: string;
  source: string;          // Source.id
  lang: "ja" | "en";
  publishedAt: string;     // ISO 8601
  summary?: string;        // RSSの抜粋（200字以内に切り詰め）
  category: "ai" | "security" | "general";
  tags: TagId[];           // 4.1/4.2 の ID（重複不可）
  score: number;           // 注目度
  related: { source: string; url: string }[]; // 重複としてまとめた他の報道
};

type Event = {
  id: string;
  title: string;
  url: string;
  source: "connpass" | "doorkeeper" | "techplay" | "manual";
  type: "expo" | "conference" | "meetup";
  format: "offline" | "online" | "hybrid";
  startAt: string; endAt?: string; // endAt >= startAt
  venue?: string; address?: string;
  organizer?: string;
  capacity?: number; accepted?: number; // 0以上の整数
  tags: TagId[];
};

type Source = { id: string; name: string; url: string; feed: string; lang: "ja" | "en"; defaultCategory: Article["category"]; };
```

## 6. 情報源（初期リスト。フィード URL は収集フェーズで検証）

- AI一次情報: OpenAI, Anthropic, Google AI/DeepMind, Meta AI, Microsoft, AWS ML, NVIDIA, Mistral, Hugging Face, GitHub Blog
- AIメディア: ITmedia AI+, AINOW, Ledge.ai, The Decoder, VentureBeat AI, TechCrunch AI, MIT Technology Review, Simon Willison, Latent Space
- 開発者コミュニティ: Zenn, Qiita, はてなブックマーク（テクノロジー）, Hacker News, Reddit（r/LocalLLaMA 等）, GitHub Trending
- IT全般（国内）: Publickey, @IT, ITmedia NEWS, ZDNET Japan, 日経クロステック, Impress Watch, gihyo.jp, CodeZine, Gigazine
- セキュリティ（国内）: JPCERT/CC, IPA, NISC, Security NEXT, ScanNetSecurity, piyolog, トレンドマイクロ, LAC, NTTセキュリティ
- セキュリティ（海外）: The Hacker News, BleepingComputer, Krebs on Security, SecurityWeek, Dark Reading, CISA KEV, Google Project Zero, Unit 42, Microsoft MSRC
- 論文: arXiv（cs.AI, cs.CL, cs.CR）, Hugging Face Daily Papers
- イベント: connpass API v2（個人申請・無料・要審査）, Doorkeeper API, TECH PLAY, 展示会/カンファレンス（手動管理の `data/manual-events.json` ＋ 主要公式サイト）

## 7. 収集ルール

- 各サイトの利用規約と robots.txt を守る。正規の RSS/API を優先し、スクレイピングは最小限にする
- User-Agent を明示し、1回の実行で同じホストへの連続アクセスは間隔をあける
- 保持期間: 記事30日、イベントは終了まで
- 重複除去: 正規化URLが一致するもの、またはタイトルの類似度がしきい値以上のものを1件にまとめる
- 注目度: 報道したメディア数、Hacker News のポイント、一次情報かどうか、新しさから算出

## 8. 通知

- Web Push（iOS 16.4以降、ホーム画面に追加したPWAのみ）
- 通知条件: CISA KEV への追加、JPCERT の注意喚起、CVSS 9.0以上、ユーザーが登録した注目キーワード
- 静かな時間帯（設定可）は通知しない。1時間あたりの上限を設ける

## 9. 非機能要件

- 初回表示 2秒以内（4G想定）、2回目以降はオフラインでも前回のデータを表示
- アクセシビリティ: タップ領域 44pt 以上、コントラスト比 AA
- 外部リンクは新しいタブで開き、`rel="noopener noreferrer"` を付ける
- 外部由来の文字列は必ずエスケープして表示する（`dangerouslySetInnerHTML` は禁止）
