import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** アプリが配信するデータの置き場所（app/public/data） */
export const DATA_DIR = resolve(import.meta.dirname, '../../app/public/data');

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export const consoleLogger: Logger = {
  info: (message) => console.info(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
};

/** JSON ファイルを読む。ファイルがなければ undefined */
export async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/**
 * 書き込み途中のファイルを配信しないよう、一時ファイルに書いてから置き換える。
 * Windows では置き換え先を他のプロセス（開発サーバーなど）が開いていると rename が
 * EPERM・EACCES・EBUSY になるので、そのときは上書きコピーする。
 */
export async function writeAtomically(path: string, content: string): Promise<void> {
  const temp = `${path}.tmp`;
  await writeFile(temp, content, 'utf8');
  try {
    await rename(temp, path);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') throw error;
    await copyFile(temp, path);
    await rm(temp, { force: true });
  }
}

/** 例外の内容をログ用の文字列にする。fetch の失敗は cause に原因（DNS・TLS など）が入る */
export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error
    ? `${error.message}（${error.cause.message}）`
    : error.message;
}
