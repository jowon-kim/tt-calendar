/**
 * iOS 앱 알림 — 애플 APNs에 바로 보냅니다.
 *
 * Capacitor의 알림 플러그인은 iOS에서 FCM 토큰이 아니라 **APNs 기기 토큰**을 줍니다.
 * FCM으로 돌리려면 iOS 앱에 Firebase SDK를 붙이고 AppDelegate를 고쳐야 하는데,
 * Mac 없이는 그걸 확인할 길이 없어요. 서버가 애플에 직접 보내면 앱 쪽은 손댈 게 없고,
 * Node에 들어 있는 http2만 쓰니 의존성도 늘지 않습니다.
 *
 *   APNS_KEY        애플 개발자 → Keys → APNs 키(.p8) 파일 내용 통째로
 *   APNS_KEY_ID     그 키의 ID (10자)
 *   APNS_TEAM_ID    팀 ID (10자)
 *   APNS_BUNDLE_ID  앱 번들 ID (capacitor.config.json의 appId)
 *   APNS_SANDBOX    Xcode에서 바로 깐 개발 빌드면 1. TestFlight·스토어 빌드는 비워 둡니다
 */
import crypto from 'node:crypto';
import http2 from 'node:http2';

export const canApns = () =>
  !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_BUNDLE_ID);

const host = () => (process.env.APNS_SANDBOX === '1'
  ? 'https://api.sandbox.push.apple.com'
  : 'https://api.push.apple.com');

/* 애플은 같은 토큰을 20분~1시간 안에서 다시 쓰라고 합니다. 너무 자주 새로 만들면 막혀요. */
let cached = { jwt: '', until: 0 };

function providerToken() {
  if (cached.jwt && Date.now() < cached.until) return cached.jwt;
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${b64({ alg: 'ES256', kid: process.env.APNS_KEY_ID })}.${b64({
    iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000),
  })}`;
  // JWT의 ES256은 DER이 아니라 r‖s 64바이트를 원합니다
  const signature = crypto.sign('sha256', Buffer.from(unsigned), {
    key: process.env.APNS_KEY, dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  cached = { jwt: `${unsigned}.${signature}`, until: Date.now() + 50 * 60 * 1000 };
  return cached.jwt;
}

/** 실제로 애플에 한 번 요청합니다. 테스트에서는 useApnsTransport로 갈아끼웁니다. */
export function http2Request(origin, headers, body) {
  return new Promise((resolve, reject) => {
    const session = http2.connect(origin);
    session.on('error', reject);
    const req = session.request(headers);
    let status = 0;
    let text = '';
    req.on('response', (h) => { status = h[':status']; });
    req.setEncoding('utf8');
    req.on('data', (chunk) => { text += chunk; });
    req.on('end', () => { session.close(); resolve({ status, text }); });
    req.on('error', (e) => { session.close(); reject(e); });
    req.end(body);
  });
}

let transport = http2Request;

export function useApnsTransport(fn) {
  transport = fn || http2Request;
}

/**
 * 알림 하나. 실패하면 statusCode를 단 오류를 던집니다 — lib/push.js가 웹푸시·FCM과
 * 똑같이 다룹니다. 애플은 앱을 지운 기기에 410을, 엉터리 토큰에 400 BadDeviceToken을
 * 주는데, 둘 다 다시 보낼 일이 없으니 410으로 맞춰서 그 기기 줄을 치우게 합니다.
 */
export async function sendApns(deviceToken, { title, body, tag }) {
  const headers = {
    ':method': 'POST',
    ':path': `/3/device/${deviceToken}`,
    authorization: `bearer ${providerToken()}`,
    'apns-topic': process.env.APNS_BUNDLE_ID,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'apns-collapse-id': String(tag || 'diary').slice(0, 64),
    'content-type': 'application/json',
  };
  const payload = JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, tag: String(tag || '') });
  const { status, text } = await transport(host(), headers, payload);
  if (status === 200) return;

  const reason = (() => { try { return JSON.parse(text).reason; } catch { return ''; } })();
  const e = new Error(`apns ${status} ${reason}`);
  e.statusCode = status === 400 && reason === 'BadDeviceToken' ? 410 : status;
  throw e;
}
