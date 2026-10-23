import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// YAML の解析ライブラリは入れず、文字列で要点だけを確かめる
const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/deploy.yml'),
  'utf8',
);

/** ステップの名前（`- name:`）・`- run:`・`- uses:` を上から順に並べる */
const steps = [...workflow.matchAll(/^ {6}- (?:name|run|uses): (.+)$/gm)].map((m) => m[1]);
const indexOf = (label: string) => {
  const i = steps.findIndex((s) => s?.includes(label));
  expect(i, label).toBeGreaterThanOrEqual(0);
  return i;
};

describe('deploy.yml', () => {
  it('main への push と毎時の cron の両方で動く', () => {
    expect(workflow).toMatch(/^ {2}push:\n {4}branches: \[main\]$/m);
    expect(workflow).toMatch(/^ {4}- cron: '\d{1,2} \* \* \* \*'$/m);
  });

  it('前回のデータを戻す → 収集 → 保存 → ビルド → デプロイの順に動く', () => {
    const order = [
      indexOf('前回のデータを戻す'),
      indexOf('ニュースとイベントを収集'),
      indexOf('データがあるか確かめる'),
      indexOf('データを次回のために保存する'),
      indexOf('npm run build'),
      indexOf('Cloudflare Pages にデプロイ'),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('push でも cron でも、デプロイの前に lint・型・テストを通す', () => {
    expect(indexOf('lint・型・テスト')).toBeLessThan(indexOf('Cloudflare Pages にデプロイ'));
    expect(workflow).toMatch(/- name: lint・型・テスト\n {8}run: npm run check$/m);
  });

  it('wrangler は版を固定して実行する', () => {
    expect(workflow).toMatch(/wrangler@\d+\.\d+\.\d+ pages deploy/);
  });

  it('秘密情報は Secrets から渡し、ファイルに直接書かない', () => {
    for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CONNPASS_API_KEY']) {
      expect(workflow).toContain(`${name}: \${{ secrets.${name} }}`);
    }
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m);
  });
});
