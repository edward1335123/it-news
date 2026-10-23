import type { Article, NotifyConfig } from '@itnews/shared';
import type { Logger } from '../io';
import { planNotifications, pruneState, recordDelivery } from './plan';
import type { NotifyState } from './plan';
import { isSubscriptionGone, sendErrorMessage } from './send';
import type { Sender } from './send';

export type NotifyResult = {
  state: NotifyState;
  sent: number;
  /** 送信に失敗した（購読の解除を含む） */
  failed: boolean;
};

/**
 * 新着記事から通知を決めて送り、送信済みの記録を更新する。
 * 送信に失敗したら残りは送らず、送れた分だけを記録する（失敗した分は次回また送る）。
 */
export async function runNotifier(input: {
  articles: readonly Article[];
  state: NotifyState;
  config: NotifyConfig;
  send: Sender;
  now: number;
  log: Logger;
}): Promise<NotifyResult> {
  const { config, now, log } = input;
  let state = pruneState(input.state, now);
  const plan = planNotifications({
    articles: input.articles,
    state,
    keywords: config.keywords,
    quietHours: config.quietHours,
    now,
  });

  switch (plan.kind) {
    case 'none':
      log.info('[notify] 通知する新着はない');
      return { state, sent: 0, failed: false };
    case 'quiet':
      log.info(`[notify] 静かな時間帯のため ${plan.pending}件を次回以降に送る`);
      return { state, sent: 0, failed: false };
    case 'limited':
      log.info(`[notify] 1時間あたりの上限に達したため ${plan.pending}件を次回以降に送る`);
      return { state, sent: 0, failed: false };
    case 'send':
      break;
  }

  let sent = 0;
  for (const { payload, articleIds } of plan.messages) {
    try {
      await input.send(config.subscription, payload);
    } catch (error) {
      log.error(`[notify] 送信に失敗した: ${sendErrorMessage(error)}`);
      if (isSubscriptionGone(error)) {
        log.error(
          '[notify] 購読が解除されている。アプリの設定で通知を ON にし直し、Secret の PUSH_CONFIG を登録し直す',
        );
      }
      return { state, sent, failed: true };
    }
    state = recordDelivery(state, articleIds, now);
    sent += 1;
  }
  log.info(`[notify] ${sent}件の通知を送った`);
  return { state, sent, failed: false };
}
