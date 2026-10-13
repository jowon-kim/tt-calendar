/**
 * 휴대폰 알림. 기기마다 받는 길이 둘입니다.
 *
 * - 웹푸시(platform 'web'): 브라우저가 만들어 준 구독(endpoint)에 VAPID 키로 서명해서
 *   보내고, 서비스워커(public/sw.js)가 받아서 띄웁니다. 아이폰은 홈 화면에 추가한
 *   앱에서만 켤 수 있습니다 (iOS 16.4+)
 * - 스토어 앱: 안드로이드는 FCM 토큰으로(lib/fcm.js), iOS는 APNs 토큰으로 애플에 바로(lib/apns.js)
 */
import { listPushSubs, removePushSub, getSettings } from './store.js';
import { describe } from './message.js';
import { keys } from './setup.js';
import { canNative, sendNative } from './fcm.js';
import { canApns, sendApns } from './apns.js';

const BODY_LIMIT = 300; // 4KB까지 되지만, 알림에 소설을 띄울 일은 없습니다

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** 브라우저가 구독을 만들 때 쓰는 공개키. 앱이 처음 켜질 때 만들어 DB에 둡니다 (lib/setup.js). */
export const publicKey = async () => (await keys()).vapidPublic;

/**
 * 푸시 서비스가 문제 생겼을 때 연락할 곳. mailto: 나 https: 주소면 되고,
 * 실제로 닿는지는 아무도 확인하지 않습니다.
 *
 * 예전엔 DIARY_URL만 봤는데, 그 변수가 없으면 알림이 통째로 안 갔습니다.
 * Vercel은 VERCEL_URL을 늘 넣어주니 이제 설정 없이도 여기서 막히지 않습니다.
 */
export function subject() {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const url = process.env.DIARY_URL;
  if (url) return url.endsWith('/') ? url.slice(0, -1) : url;
  return `https://${env('VERCEL_URL')}`;
}

/* web-push는 실제로 보낼 때만 필요해서 그때 불러옵니다.
   테스트에서는 useSender로 갈아끼웁니다 (lib/db.js의 useClient와 같은 방식). */
let sender = null;

export function useSender(fn) {
  sender = fn;
}

async function send(subscription, payload) {
  if (!sender) {
    const { default: webpush } = await import('web-push');
    const { vapidPublic, vapidPrivate } = await keys();
    webpush.setVapidDetails(subject(), vapidPublic, vapidPrivate);
    sender = (s, p) => webpush.sendNotification(s, p);
  }
  return sender(subscription, payload);
}

/* 네이티브 앱 쪽. 테스트에서는 useNativeSender로 갈아끼웁니다. */
let nativeSender = null;

export function useNativeSender(fn) {
  nativeSender = fn;
}

/* 안드로이드는 FCM, iOS는 애플에 바로 (lib/apns.js 맨 위에 이유가 있습니다) */
function sendToApp(platform, token, payload) {
  if (nativeSender) return nativeSender(token, payload, platform);
  if (platform === 'ios') {
    if (!canApns()) throw new Error('APNS_* is not set, so iPhone app notifications cannot go out');
    return sendApns(token, JSON.parse(payload));
  }
  if (!canNative()) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set, so Android app notifications cannot go out');
  return sendNative(token, JSON.parse(payload));
}

async function deliver(coupleId, row, payload) {
  try {
    if (row.platform && row.platform !== 'web') {
      await sendToApp(row.platform, row.endpoint, payload);
    } else {
      await send(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
      );
    }
  } catch (e) {
    // 404 / 410 은 그 기기가 앱을 지웠거나 구독이 만료된 것 — 줄을 치웁니다
    if (e.statusCode === 404 || e.statusCode === 410) {
      await removePushSub(coupleId, row.endpoint).catch(() => {});
      return;
    }
    console.error(`push to ${row.owner} failed`, e.message);
  }
}

/**
 * 그 달력에서 바꾼 사람 빼고 나머지 기기에 알립니다. 누가 바꿨는지 모르면 켜둔 모두에게 갑니다.
 * 알림이 실패해도 일정 저장은 이미 끝난 뒤라, 여기서는 절대 예외를 올리지 않습니다.
 */
export async function notify(coupleId, kind, event, actor) {
  try {
    // 둘을 차례로 부르면 Neon 왕복이 두 번입니다 — 같이 보냅니다
    const [all, settings] = await Promise.all([listPushSubs(coupleId), getSettings(coupleId)]);
    const rows = all.filter((row) => row.owner !== actor);
    if (!rows.length) return;

    const who = actor === 'a' ? settings.names.a : actor === 'b' ? settings.names.b : '';
    const { title, body } = describe(kind, event, who, settings.locale);
    const payload = JSON.stringify({
      title,
      body: body.slice(0, BODY_LIMIT),
      // 같은 일정을 여러 번 고쳐도 알림이 쌓이지 않고 마지막 것만 남습니다
      tag: event.id || 'diary',
    });

    await Promise.all(rows.map((row) => deliver(coupleId, row, payload)));
  } catch (e) {
    console.error('push notification', e);
  }
}

/**
 * 그 달력의 켜둔 기기 전부에 같은 알림을 보냅니다. 위의 notify와 달리 아무도 빼지 않아요 —
 * 오늘 일정 알림은 둘 다 받아야 하는 거라서요.
 *
 * 문구는 이미 만들어진 것을 받습니다. 부르는 쪽(api/cron.js)이 시간대를 보려고
 * 설정을 이미 읽었기 때문에, 여기서 또 읽으면 Neon 왕복이 한 번 더 늡니다.
 */
export async function notifyAll(coupleId, { title, body }, tag) {
  try {
    const rows = await listPushSubs(coupleId);
    if (!rows.length) return;
    const payload = JSON.stringify({ title, body: body.slice(0, BODY_LIMIT), tag });
    await Promise.all(rows.map((row) => deliver(coupleId, row, payload)));
  } catch (e) {
    console.error('push notification', e);
  }
}
