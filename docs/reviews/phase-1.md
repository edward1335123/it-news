# フェーズ1 レビュー: データ形式とモック

対象: `981947e..13e5d69`（feat(phase1): データ形式の zod スキーマとモックJSONを追加）

## 検証結果

| 項目 | 結果 |
|---|---|
| `npm run check` | 成功（lint・prettier・typecheck・テスト 34件。修正後は 41件） |
| `npm run build` | 成功 |
| 画面の確認 | 対象外（このフェーズに画面なし） |

完了条件:

- モックJSONがスキーマ検証に通るテストがある: 満たす（`app/src/data/mockData.test.ts`）
- `npm run check` が成功する: 満たす
- news.json 64件。15サブカテゴリすべてに4〜7件あり、どのタグにも日英の記事がある
- events.json 22件。種別3×形式3の9通りと、取得元4種をすべて含む
- sources.json 27件。日英・3カテゴリを網羅する
- 秘密情報の混入なし。新しい依存パッケージなし（zod を shared の dependencies に移しただけ）

## 指摘一覧

必須の指摘はなし。

| # | 重要度 | 内容 | 対応 |
|---|---|---|---|
| 1 | 推奨 | SPEC 5章が「正は `shared/src/schemas.ts`」となっており、CLAUDE.md の「SPEC を正とする」と食い違う | 対応済: SPEC を正とし、スキーマがこれを実装すると書き換えた |
| 2 | 推奨 | SPEC の TS ブロックが確定内容と矛盾する（summary「200字程度」、tags が `string[]`）。余分な空行 | 対応済: 200字以内、`TagId[]`、endAt・capacity の制約を追記し、空行を削除 |
| 3 | 推奨 | `z.object` は未知のキーを黙って取り除くので、モックJSONでキー名を打ち間違えても検出できない | 対応済: アプリ用スキーマは未知のキーを無視したままにし、mockData.test.ts でだけ strict に検証する（collector が先に項目を足してもアプリは壊れない） |
| 4 | 推奨 | 境界値・異常系のテスト不足 | 対応済: タイムゾーンなしの日時、`data:` URL、`http://`、summary ちょうど200字、endAt = startAt、負の capacity/accepted、events/sources の ID 重複のテストを追加 |
| 5 | 推奨 | 型名 `Event` が DOM の `Event` と同名で、React コードで紛らわしい | 対応済: ユーザーの了承を得て `TechEvent` に改名（SPEC・shared） |
| 6 | 任意 | `connpass-1010` が `capacity: 80, accepted: 96` で定員超過 | 対応不要: connpass では実際に起こる。フェーズ2で100%超の表示を扱う |
| 7 | 任意 | `z.httpUrl()` は認証情報つき URL（`https://user:pw@...`）を受け付ける | 持ち越し: フェーズ5の URL 正規化で扱う |
| 8 | 任意 | summary の長さは UTF-16 単位で数える。空の summary や空白だけの title も通る | 持ち越し: フェーズ5で collector の切り詰め処理と数え方を揃える |
| 9 | 任意 | mockData.test.ts が describe の本体で `parse` しており、失敗時にどのテストか分かりにくい | 持ち越し: 現状でも失敗は検出できる |
| 10 | 任意 | `CATEGORY_TAGS.ai` が TAG_IDS と二重管理 | 対応不要: チップの表示順を明示するため。整合性はテストで保証済み |
| 11 | 任意 | events.json の開催日が 2026-10〜2027-01 に固定されている | 持ち越し: フェーズ2以降で日付で絞り込むとき、テストの基準日を固定する |

## ユーザーが確認すべきこと

なし（指摘3・5 はユーザーと相談のうえ対応済）
