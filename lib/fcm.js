/**
 * 안드로이드 앱 알림 — Firebase Cloud Messaging HTTP v1.
 *
 * firebase-admin을 넣지 않고 fetch로 직접 부릅니다. 하는 일은 "서비스 계정으로
 * 토큰을 받아 메시지 하나 보내기"뿐인데, 그 패키지는 의존성을 수십 개 끌고 옵니다.
 * iOS는 여기로 오지 않습니다 — lib/apns.js가 애플에 바로 보냅니다.
 *
 *   FIREBASE_SERVICE_ACCOUNT  Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키의
 *                             JSON 파일 내용 통째로 (Vercel 환경변수에 한 줄로)
 */
import crypto from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const canNative = () => !!process.env.FIREBASE_SERVICE_ACCOUNT;

function account() {
  const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing client_email, private_key or project_id');
  }
  return parsed;
}

const base64url = (value) => Buffer.from(value).toString('base64url');

/* 구글 토큰은 한 시간 삽니다. 인스턴스가 살아 있는 동안 돌려 씁니다. */
let cached = { token: '', until: 0 };

async function accessToken() {
  if (cached.token && Date.now() < cached.until) return cached.token;

  const { client_email: email, private_key: key } = account();
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    base64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })),
  ].join('.');
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key, 'base64url');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}: ${await res.text()}`);
  const { access_token: token, expires_in: seconds } = await res.json();
  cached = { token, until: Date.now() + (seconds - 60) * 1000 };
  return token;
}

/**
 * 알림 하나. 실패하면 statusCode를 단 오류를 던집니다 — 웹푸시와 같은 모양이라
 * lib/push.js가 404(앱을 지웠거나 토큰이 만료됨)를 보고 그 기기 줄을 치웁니다.
 *
 * tag는 같은 일정을 여러 번 고쳐도 알림이 쌓이지 않고 마지막 것만 남게 하는 이름입니다.
 * 안드로이드는 tag, iOS는 apns-collapse-id(64바이트까지)가 그 일을 합니다.
 */
export async function sendNative(token, { title, body, tag }) {
  const { project_id: project } = account();
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { tag: String(tag || '') },
        android: { notification: { tag: String(tag || 'diary') } },
        apns: { headers: { 'apns-collapse-id': String(tag || 'diary').slice(0, 64) } },
      },
    }),
  });
  if (!res.ok) {
    const e = new Error(`fcm ${res.status}: ${await res.text()}`);
    e.statusCode = res.status;
    throw e;
  }
}
