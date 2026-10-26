import crypto from 'node:crypto';
import { keys } from './setup.js';
import { hasDatabase } from './db.js';
import { findSession, extendSession, SESSION_DAYS } from './accounts.js';
import '../public/limits.js'; // 일정 색 목록 (화면과 같이 씁니다)

/* ── 인증 ────────────────────────────────── */

/** 설치가 덜 끝났으면 무엇이 빠졌는지 문구 키로. 다 됐으면 null. */
export function missingSetup() {
  if (!hasDatabase()) return 'error.noDatabase';
  return null;
}

/**
 * DB가 붙어 있고 표가 맞춰졌는지. 아니면 500을 직접 내려보내고 false.
 * 막 만든 DB에는 표가 없어서, 무엇이든 읽기 전에 keys()가 schema.sql을 한 번 돌려야 합니다.
 */
export async function ready(res) {
  const missing = missingSetup();
  if (missing) {
    res.status(500).json({ error: missing });
    return false;
  }
  await keys();
  return true;
}

/* 길이가 다르면 timingSafeEqual이 예외를 던져서, 먼저 길이를 봅니다. */
const same = (given, expected) =>
  given.length === expected.length &&
  crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));

const bearer = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};

/*
 * 로그인은 쿠키로 들고 다닙니다. 예전엔 localStorage의 토큰을 Authorization 헤더에
 * 실었는데, 사진은 <img src>로 불러서 헤더를 못 실었고 그래서 사진 주소만 인증 없이
 * 열려 있었습니다. 쿠키는 img 요청에도 실립니다.
 *
 * HttpOnly — 화면의 스크립트가 못 읽습니다. 글자 칸에 스크립트가 끼어들어도 토큰은 못 훔쳐요
 * SameSite=Lax — 다른 사이트에서 보낸 POST/PATCH/DELETE에는 안 실립니다
 */
const COOKIE = 'diary_session';

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return '';
}

export const sessionToken = (req) => readCookie(req, COOKIE);

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

/**
 * 로그인한 사람 { userId, login, hasPassword, coupleId, slot, paired }. 아니면 401을 직접 내려보내고 null.
 * 달력을 만지는 모든 핸들러는 여기서 받은 coupleId로만 DB를 읽고 씁니다.
 */
export async function requireSession(req, res) {
  if (!(await ready(res))) return null;
  const token = sessionToken(req);
  const session = await findSession(token);
  if (!session) {
    res.status(401).json({ error: 'error.relogin' });
    return null;
  }
  if (session.stale) {
    await extendSession(token);
    setSessionCookie(res, token);
  }
  return session;
}

/**
 * 오늘 일정 알림을 깨우는 바깥 시계의 열쇠. 로그인과 따로 둡니다 — 이건 사람이 아니라
 * 기계가 들고 있어서요. 헤더로도 받고, 주소 뒤 ?key= 로도 받습니다 (시계 서비스마다
 * 되는 게 달라서).
 *
 * 여러 커플이 한 배포를 쓰니 이 열쇠는 운영하는 사람만 압니다 — 예전처럼 설정 화면에
 * 보여주면 아무 커플이나 모든 커플의 알림을 두드릴 수 있습니다. CRON_SECRET을 넣으면
 * 그걸 쓰고(Vercel Cron이 이 이름으로 Bearer를 실어 보냅니다), 없으면 앱이 만든 것을 씁니다.
 *
 * 여기 오류 문구만 문구 키가 아니라 영어 그대로입니다. 이 답을 읽는 건 앱이
 * 아니라 시계 서비스의 실행 기록이라, 'error.badKey'가 찍히면 아무 도움이 안 됩니다.
 */
export async function requireCron(req, res) {
  const expected = process.env.CRON_SECRET || (await keys()).cronSecret;
  if (!same(bearer(req) || String(req.query?.key || ''), expected)) {
    res.status(401).json({ error: 'wrong key' });
    return false;
  }
  return true;
}

/* ── 요청 다루기 ─────────────────────────── */

/**
 * 요청한 쪽의 IP. Vercel이 앞단에서 이 헤더들을 직접 채워서, 보내는 쪽이 꾸며 넣은 값은
 * 덮어써집니다. 헤더가 없으면(로컬 개발·테스트) 빈 문자열.
 */
export function clientIp(req) {
  const real = String(req.headers?.['x-real-ip'] || '').trim();
  if (real) return real;
  return String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
}

/**
 * 기기 목록에 보여줄 이름 — "Chrome · Windows". User-Agent 원문은 길고 버전까지 담겨 있어
 * 그대로 두지 않고, 사람이 "아, 그 폰"하고 알아볼 만큼만 남깁니다. 모르겠으면 빈 문자열.
 * 순서가 중요합니다: 엣지·삼성 인터넷은 Chrome이라고도 쓰고, 크롬은 Safari라고도 씁니다.
 */
export function deviceName(req) {
  const ua = String(req.headers?.['user-agent'] || '');
  const pick = (table) => table.find(([re]) => re.test(ua))?.[1] || '';
  const browser = pick([
    [/Edg(e|A|iOS)?\//, 'Edge'],
    [/SamsungBrowser\//, 'Samsung Internet'],
    [/OPR\/|Opera/, 'Opera'],
    [/Firefox\/|FxiOS\//, 'Firefox'],
    [/Chrome\/|CriOS\//, 'Chrome'],
    [/Safari\//, 'Safari'],
  ]);
  const system = pick([
    [/iPhone/, 'iPhone'],
    [/iPad/, 'iPad'],
    [/Android/, 'Android'],
    [/Windows/, 'Windows'],
    [/CrOS/, 'ChromeOS'],
    [/Mac OS X|Macintosh/, 'Mac'],
    [/Linux/, 'Linux'],
  ]);
  return [browser, system].filter(Boolean).join(' · ');
}

export function body(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { throw new Error('error.badJson'); }
  }
  return req.body;
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  res.status(405).json({ error: 'error.methodNotAllowed' });
}

/** 핸들러를 감싸서 예외를 400/500으로 바꿔줍니다. */
export function guard(handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await handler(req, res);
    } catch (e) {
      const known = e instanceof ValidationError;
      if (!known) console.error(e);
      res.status(known ? 400 : 500).json({
        error: known ? e.message : 'error.requestFailed',
      });
    }
  };
}

/* ── 검증 ────────────────────────────────── */

export class ValidationError extends Error {}

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** 아는 시간대면 그대로, 아니면 UTC. 아는지는 Intl에게 물어봅니다. */
const knownZone = (v) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: v });
    return v;
  } catch {
    return 'UTC';
  }
};
const isTime = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

/**
 * 입력을 DB에 넣을 수 있는 모양으로 다듬습니다.
 * base를 주면 수정, 안 주면 새로 만들기.
 */
export function normalizeEvent(input, base = null) {
  const pick = (key, fallback) => (input[key] !== undefined ? input[key] : fallback);

  const date = isDate(input.date) ? input.date : base?.date;
  if (!date) throw new ValidationError('error.needDate');

  const title = clip(pick('title', base?.title), 80).trim();
  if (!title) throw new ValidationError('error.needTitle');

  // 조용히 버리지 않고 왜 안 되는지 알려줍니다
  const endDate = isDate(input.endDate) ? input.endDate : null;
  if (endDate && endDate < date) throw new ValidationError('error.endBeforeStart');

  const rawOwner = pick('owner', base?.owner);
  const rawRepeat = pick('repeat', base?.repeat);
  const rawColor = pick('color', base?.color);

  const time = isTime(input.time) ? input.time : null;
  const endTime = time && isTime(input.endTime) ? input.endTime : null;
  if (endTime && endTime <= time) throw new ValidationError('error.endTimeBeforeStart');

  return {
    title,
    date,
    endDate,
    time,
    endTime,
    memo: clip(pick('memo', base?.memo), 1000),
    owner: ['a', 'b', 'both'].includes(rawOwner) ? rawOwner : 'both',
    repeat: ['none', 'monthly', 'yearly'].includes(rawRepeat) ? rawRepeat : 'none',
    color: globalThis.DIARY_LIMITS.eventColors.includes(rawColor) ? rawColor : null,
  };
}

/**
 * 보내온 칸만 골라 담습니다. 안 보낸 칸은 아예 넣지 않아요 — 예전엔 현재
 * 설정을 통째로 받아 그 위에 덮었는데, 색 고르기와 저장이 겹치면 나중에
 * 읽은 쪽이 먼저 쓴 쪽을 통째로 지웠습니다.
 */
export function normalizeSettings(input) {
  const patch = {};
  // 비우면 기본값으로 되돌립니다 — 이름 없는 달력이 되면 상단이 휑해서요
  /* 비우면 비운 채로 둡니다 — 화면이 그 언어의 기본 이름을 씁니다.
     여기서 채워 넣으면 처음 쓴 언어의 이름이 굳어버립니다. */
  if ('title' in input) patch.title = clip(input.title, 12).trim();
  if ('subtitle' in input) patch.subtitle = clip(input.subtitle, 20).trim();
  if ('theme' in input) patch.theme = clip(input.theme, 12).trim() || 'peach';
  if ('locale' in input) patch.locale = clip(input.locale, 12).trim() || 'en';
  if ('region' in input) patch.region = clip(input.region, 12).trim() || 'none';
  // 낯선 시간대를 담으면 알림이 통째로 엉뚱한 시각에 갑니다 — 여기서 걸러둡니다
  if ('timezone' in input) patch.timezone = knownZone(clip(input.timezone, 64).trim());
  // 한 사람 것만 보내도 됩니다 — 처음 들어와 "뭐라고 불러 드릴까요?"에 답하면 내 자리 이름만 옵니다.
  // 보낸 자리만 바꿔야, 그새 상대가 고친 이름을 옛 값으로 덮지 않아요
  if (input.names && typeof input.names === 'object') {
    patch.names = {};
    for (const slot of ['a', 'b']) {
      if (slot in input.names) patch.names[slot] = clip(input.names[slot], 12).trim();
    }
  }
  if ('since' in input) patch.since = isDate(input.since) ? input.since : null;
  if ('showMilestones' in input) patch.showMilestones = !!input.showMilestones;
  return patch;
}
