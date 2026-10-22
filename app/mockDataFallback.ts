import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * 開発サーバー（`npm run dev`）で、まだ収集していない `data/*.json` の代わりに
 * `app/mock/` のモックを返す。`npm run collect:news`・`collect:events` で実データを作ると、そちらを優先する。
 * ビルドには影響しない（本番でモックを配信しない）。
 */
export function mockDataFallback(mockDir: string): Plugin {
  return {
    name: 'itnews:mock-data-fallback',
    apply: 'serve',
    configureServer(server) {
      const { base, publicDir } = server.config;
      const pattern = new RegExp(
        `^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}data/([a-z]+\\.json)(?:\\?|$)`,
      );
      server.middlewares.use((req, res, next) => {
        const fileName = pattern.exec(req.url ?? '')?.[1];
        if (fileName === undefined || existsSync(join(publicDir, 'data', fileName))) return next();
        const mockPath = join(mockDir, fileName);
        if (!existsSync(mockPath)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(mockPath).pipe(res);
      });
    },
  };
}
