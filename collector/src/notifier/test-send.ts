import { consoleLogger as log } from '../io';
import type { PushPayload } from './plan';
import { createSender, isSubscriptionGone, readNotifierEnv, sendErrorMessage } from './send';

/** テスト送信。購読と VAPID 鍵の組み合わせが正しいかを、実際に1件送って確かめる */

export const TEST_PAYLOAD: PushPayload = {
  title: 'IT News テスト通知',
  body: 'この通知が見えていれば、プッシュ通知の設定は完了です',
  tag: 'test',
};

async function main(): Promise<void> {
  const env = readNotifierEnv(process.env);
  if (env.kind !== 'ok') {
    const message = env.kind === 'skip' ? `${env.missing.join('・')} が未設定` : env.message;
    log.error(`[notify:test] ${message}`);
    process.exitCode = 1;
    return;
  }
  try {
    await createSender(env.vapid)(env.config.subscription, TEST_PAYLOAD);
  } catch (error) {
    log.error(`[notify:test] 送信に失敗した: ${sendErrorMessage(error)}`);
    if (isSubscriptionGone(error)) {
      log.error('[notify:test] 購読が解除されている。アプリの設定で通知を ON にし直す');
    }
    process.exitCode = 1;
    return;
  }
  log.info('[notify:test] テスト通知を送った。iPhone に届いたか確かめる');
}

await main();
