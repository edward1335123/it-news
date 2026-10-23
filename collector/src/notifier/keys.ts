import webpush from 'web-push';

/**
 * VAPID 鍵を作って表示する（最初に一度だけ実行する）。
 * 公開鍵は Variable `VAPID_PUBLIC_KEY`、秘密鍵は Secret `VAPID_PRIVATE_KEY` に登録する。
 * 秘密鍵はファイルに保存せず、コミットもしない。
 */
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
