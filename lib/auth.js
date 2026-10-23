/**
 * 비밀번호와 토큰. Node에 들어 있는 crypto만 씁니다 — 의존성을 늘리지 않으려고요.
 *
 * - 비밀번호는 scrypt 해시로만 둡니다. 설정값을 해시 문자열에 같이 적어서,
 *   나중에 값을 올려도 예전 해시는 그대로 맞춰볼 수 있습니다
 * - 쿠키·초대 링크에 실리는 토큰은 DB에 sha256 해시만 둡니다.
 *   표가 통째로 새도 그걸로 로그인하거나 링크를 만들 수 없게
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

const COST = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, COST);
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function checkPassword(password, stored) {
  const [kind, N, r, p, salt, key] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const given = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(given, expected);
}

/* 없는 이메일로 로그인해도 있는 이메일과 같은 만큼 걸리게, 버릴 해시를 하나 들고 있습니다.
   빨리 끝나면 "이 이메일은 가입 안 했다"가 시간으로 새어 나갑니다. */
let decoy = null;
export async function wasteTime(password) {
  decoy ??= hashPassword('decoy');
  await checkPassword(password, await decoy);
}

export const newToken = () => crypto.randomBytes(32).toString('base64url');

export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/* ── 입력 모양 ─────────────────────────────── */

/* 가입은 아이디로 합니다. 이메일을 안 받으니 비밀번호를 잊으면 되찾을 길이 없어요 —
   그게 싫은 사람은 구글로 들어옵니다. */
const USERNAME = /^[a-z0-9._-]{3,20}$/;

/** 대소문자와 앞뒤 공백을 걷어낸 아이디. 비었거나 터무니없이 길면 null. */
export function cleanLogin(value) {
  const login = String(value || '').trim().toLowerCase();
  // 이메일로 가입하던 때의 계정은 그 이메일이 아이디라, 로그인에서는 모양을 따지지 않습니다
  return login && login.length <= 254 ? login : null;
}

/** 새로 만드는 아이디의 모양: 영문 소문자·숫자·. _ - 로 3~20자. */
export const goodUsername = (value) => USERNAME.test(value);

/**
 * 아이디·비밀번호로 가입하고 들어오기. 2026-10-23부터 기본은 꺼져 있고 구글 하나로 들어옵니다.
 * PASSWORD_SIGNIN=on 이면 다시 열려요 — 구글 없이 직접 설치해 쓰는 곳과 테스트용 (화면에는 폼이 없습니다)
 */
export const passwordSignIn = () => process.env.PASSWORD_SIGNIN === 'on';

export const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200; // scrypt는 길이와 상관없이 돌지만, 터무니없는 건 받지 않습니다

export const goodPassword = (value) =>
  typeof value === 'string' && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;
