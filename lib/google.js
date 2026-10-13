/**
 * 구글로 들어오기 — 화면이 구글에서 받아온 ID 토큰(JWT)을 확인합니다.
 *
 * google-auth-library를 넣지 않고 구글 공개키로 서명을 직접 맞춰봅니다. 하는 일은
 * "구글이 서명했나, 우리 앱 앞으로 발급됐나, 아직 살아 있나"뿐이에요 (lib/fcm.js와 같은 이유).
 *
 *   GOOGLE_CLIENT_IDS  구글 클라우드 콘솔 → OAuth 클라이언트 ID. 웹 것을 맨 앞에,
 *                      앱 것이 생기면 쉼표로 이어 붙입니다. 없으면 구글 버튼이 안 보입니다
 */
import crypto from 'node:crypto';

const CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const SKEW = 60; // 서버 시계가 조금 어긋나도 막 받은 토큰을 거절하지 않게 (초)

export const clientIds = () =>
  String(process.env.GOOGLE_CLIENT_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);

export const canGoogle = () => clientIds().length > 0;

/* 테스트가 구글 대신 자기 공개키를 끼워 넣는 자리 */
let keySource = null;
export function useGoogleKeys(fn) {
  keySource = fn;
  cached = { keys: null, until: 0 };
}

/* 구글은 키를 며칠마다 바꾸고, 얼마나 들고 있어도 되는지 Cache-Control로 알려줍니다 */
let cached = { keys: null, until: 0 };

async function publicKeys({ fresh = false } = {}) {
  if (keySource) return keySource();
  if (!fresh && cached.keys && Date.now() < cached.until) return cached.keys;
  const res = await fetch(CERTS);
  if (!res.ok) throw new Error(`google certs ${res.status}`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  const { keys } = await res.json();
  cached = { keys, until: Date.now() + maxAge * 1000 };
  return keys;
}

const part = (text) => JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));

/**
 * 믿을 수 있는 토큰이면 { sub, email }, 아니면 null.
 * sub는 구글 계정마다 변하지 않는 번호라 이걸로 사람을 알아봅니다. 이메일은 바뀔 수 있어서
 * 보여주기만 하고, 구글이 확인한 주소일 때만 받습니다.
 */
export async function verifyIdToken(token) {
  const pieces = String(token || '').split('.');
  if (pieces.length !== 3) return null;
  let header, claims;
  try {
    header = part(pieces[0]);
    claims = part(pieces[1]);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  let jwk = (await publicKeys()).find((k) => k.kid === header.kid);
  if (!jwk && !keySource) jwk = (await publicKeys({ fresh: true })).find((k) => k.kid === header.kid); // 막 바뀐 키
  if (!jwk) return null;

  const signed = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${pieces[0]}.${pieces[1]}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(pieces[2], 'base64url'),
  );
  if (!signed) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!ISSUERS.includes(claims.iss)) return null;
  if (!clientIds().includes(claims.aud)) return null;
  if (typeof claims.exp !== 'number' || claims.exp < now - SKEW) return null;
  if (!claims.sub) return null;

  const verified = claims.email_verified === true || claims.email_verified === 'true';
  return { sub: String(claims.sub), email: verified && claims.email ? String(claims.email).toLowerCase() : null };
}
