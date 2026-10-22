import { APP_NAME } from '@itnews/shared';

/** 収集処理の入口。実際の収集はフェーズ5・6で実装する。 */
export function describeCollector(): string {
  return `${APP_NAME} collector`;
}

if (import.meta.main) {
  console.log(describeCollector());
}
