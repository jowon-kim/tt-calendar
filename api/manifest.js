import { readFileSync } from 'node:fs';
import { guard, methodNotAllowed, sessionToken } from '../lib/http.js';
import { findSession } from '../lib/accounts.js';
import { getSettings } from '../lib/store.js';

/**
 * 홈 화면 설치 정보 (10/27) — /manifest.json 을 여기로 넘깁니다 (vercel.json).
 *
 * 두 사람이 고른 앱 이름과 아이콘으로 홈 화면에 깔리게, 로그인한 커플이면 그 값을 얹고
 * 아니면 public/manifest.default.json 그대로 돌려줍니다. (public/manifest.json 이라는 파일이 있으면
 * Vercel 이 rewrite 보다 그 파일을 먼저 내줘서, 기본값은 다른 이름으로 둡니다.) 화면은 <link rel="manifest" crossorigin="use-credentials">
 * 로 불러서 로그인 쿠키가 같이 옵니다. 아이콘 사진은 로그인 없이도 읽히는 자리입니다 (api/photos/[id].js).
 */
const BASE = JSON.parse(readFileSync(new URL('../public/manifest.default.json', import.meta.url), 'utf8'));

export default guard(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const manifest = { ...BASE };
  // 로그인 안 했거나 DB 가 없으면 기본 그대로 — 설치 정보 하나 때문에 화면이 깨지면 안 됩니다
  const session = await findSession(sessionToken(req)).catch(() => null);
  if (session) {
    const settings = await getSettings(session.coupleId).catch(() => null);
    if (settings?.title) Object.assign(manifest, { name: settings.title, short_name: settings.title });
    if (settings?.icon) {
      const src = `/api/photos/${settings.icon}`;
      manifest.icons = [
        { src, sizes: '512x512', purpose: 'any' },
        { src, sizes: '512x512', purpose: 'maskable' },
      ];
    }
  }
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'private, no-cache');
  res.status(200).end(JSON.stringify(manifest));
});
