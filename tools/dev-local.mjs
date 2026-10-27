/**
 * 로컬에서 TT를 통째로 띄웁니다 — 진짜 api/ 핸들러 + 메모리 Postgres(PGlite). Neon·Vercel·구글 계정 없이.
 *
 *   node tools/dev-local.mjs            → http://127.0.0.1:8787
 *
 * 구글 로그인만 가짜입니다: 이 서버가 직접 서명한 ID 토큰을 /__dev/token?sub=아무거나&name=이름 으로 내주고,
 * 그 공개키를 lib/google.js에 끼워 넣습니다. 화면의 구글 버튼(accounts.google.com 스크립트)은 그대로라,
 * 브라우저로 직접 쓸 땐 콘솔에서  google.accounts.id 대신  fetch('/__dev/token?sub=a&name=미나')  로 받은
 * 토큰을 signInWithGoogle(토큰) 에 넘기면 들어가집니다. 헤드리스 크롬 점검은 GSI 스크립트를
 * 가짜로 바꿔 끼워 버튼 한 번으로 들어갔습니다. 푸시는 보내지 않고 버립니다. 껐다 켜면 데이터는 사라집니다.
 * 운영에는 절대 쓰지 마세요 — 아무 토큰이나 서명해 줍니다.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PGlite } = await import('@electric-sql/pglite');
process.env.DIARY_URL = 'http://127.0.0.1';
process.env.DATABASE_URL = 'postgres://pglite.local';
process.env.GOOGLE_CLIENT_IDS = 'dev-web-client';
const pg = new PGlite();
const client = (strings, ...values) => {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  return pg.query(text, values).then((r) => r.rows);
};
client.query = (text) => pg.exec(text).then(() => []);
(await import('../lib/db.js')).useClient(client);
const { useGoogleKeys } = await import('../lib/google.js');
const { useSender } = await import('../lib/push.js');
useSender(async () => {});
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'dev', alg: 'RS256', use: 'sig' };
useGoogleKeys(async () => [jwk]);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(sub, given) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'RS256', kid: 'dev', typ: 'JWT' });
  const b = b64({ iss: 'https://accounts.google.com', aud: 'dev-web-client', sub, email: `${sub}@example.com`, email_verified: true, given_name: given, iat: now, exp: now + 3600 });
  return `${h}.${b}.${crypto.createSign('RSA-SHA256').update(`${h}.${b}`).sign(privateKey, 'base64url')}`;
}
const H = async (p) => (await import('..' + p)).default;
const routes = [
  [/^\/api\/(signup|login|logout|invite|account|google|devices)$/, async (m, q) => { q.op = m[1]; return H('/api/auth.js'); }],
  [/^\/api\/state$/, () => H('/api/state.js')],
  [/^\/api\/settings$/, () => H('/api/settings.js')],
  [/^\/api\/together$/, () => H('/api/together.js')],
  [/^\/api\/events$/, () => H('/api/events/index.js')],
  [/^\/api\/events\/([^/]+)$/, async (m, q) => { q.id = m[1]; return H('/api/events/[id].js'); }],
  [/^\/api\/photos$/, () => H('/api/photos/index.js')],
  [/^\/api\/photos\/([^/]+)$/, async (m, q) => { q.id = m[1]; return H('/api/photos/[id].js'); }],
  [/^\/api\/push$/, () => H('/api/push/index.js')],
];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__dev/token') { res.end(token(u.searchParams.get('sub'), u.searchParams.get('name') || '')); return; }
  if (u.pathname.startsWith('/api/')) {
    const query = Object.fromEntries(u.searchParams);
    let handler = null;
    for (const [re, get] of routes) { const m = re.exec(u.pathname); if (m) { handler = await get(m, query); break; } }
    if (!handler) { res.writeHead(404); return res.end(); }
    let body = ''; for await (const c of req) body += c;
    const r = {
      method: req.method, headers: req.headers, query, body: body ? (() => { try { return JSON.parse(body); } catch { return body; } })() : undefined,
    };
    let code = 200;
    const out = {
      status(c) { code = c; return out; },
      setHeader(k, v) { res.setHeader(k, v); return out; },
      json(o) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); return out; },
      end(p) { res.statusCode = code; res.end(p); return out; },
      send(p) { res.statusCode = code; res.end(p); return out; },
    };
    try { await handler(r, out); } catch (e) { console.error(e); if (!res.headersSent) { res.statusCode = 500; res.end('{}'); } }
    return;
  }
  let p = path.join(REPO, 'public', decodeURIComponent(u.pathname));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
server.listen(Number(process.env.PORT || 8787), '127.0.0.1', () => console.log(`TT (local) http://127.0.0.1:${server.address().port}`));
