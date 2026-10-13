/**
 * Tests for the service worker (public/sw.js) — the part that lets the home
 * screen app open with no signal.
 *
 *   npm test
 *
 * The worker is loaded for real, with a stub for the three things it touches:
 * `self`, `caches` and `fetch`. What matters most is what it must never do:
 * hand out an old screen while the network is fine, or keep anything from
 * /api/ (that is other people's calendar).
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ORIGIN = 'https://diary.test';
const listeners = {};
const shelf = new Map();          // what the worker has kept, by url
let online = true;
const served = new Map();         // what the network answers, by path
const asked = [];                 // every network request, in order

const response = (body, extra = {}) => ({
  ok: true, status: 200, type: 'basic', redirected: false, body,
  clone() { return { ...this }; },
  ...extra,
});
const request = (path, extra = {}) => ({ url: ORIGIN + path, method: 'GET', mode: 'no-cors', ...extra });
const keyOf = (req) => (typeof req === 'string' ? new URL(req, ORIGIN).href : req.url);

const context = {
  URL,
  self: {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  },
  caches: {
    open: async () => ({
      put: async (req, res) => { shelf.set(keyOf(req), res); },
      match: async (req, options = {}) => {
        const key = keyOf(req);
        if (shelf.has(key)) return shelf.get(key);
        if (!options.ignoreSearch) return undefined;
        const bare = key.split('?')[0];
        for (const [url, res] of shelf) if (url.split('?')[0] === bare) return res;
        return undefined;
      },
    }),
  },
  fetch: async (req) => {
    const path = keyOf(req).slice(ORIGIN.length);
    asked.push(path);
    if (!online) throw new TypeError('Failed to fetch');
    return served.get(path) || response(`fresh ${path}`);
  },
};
vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), context, { filename: 'sw.js' });

let passed = 0;
let failed = 0;
const ok = (what, cond, saw) => {
  if (cond) { passed++; console.log(`PASS  ${what}`); }
  else { failed++; console.log(`FAIL  ${what}  ${JSON.stringify(saw)}`); }
};

/** Sends a request through the worker. `null` means the worker left it to the browser. */
async function through(req) {
  let answer = null;
  listeners.fetch?.({ request: req, respondWith: (promise) => { answer = promise; } });
  if (!answer) return null;
  try { return await answer; } catch (err) { return err; }
}

/* 인터넷이 될 때 — 늘 새 파일 */
let got = await through(request('/app.js'));
ok('with a network, a screen file comes from the network', got?.body === 'fresh /app.js', got);
ok('and a copy is kept', shelf.get(`${ORIGIN}/app.js`)?.body === 'fresh /app.js', [...shelf.keys()]);

served.set('/app.js', response('newer /app.js'));
got = await through(request('/app.js'));
ok('a newer file replaces the kept one — nobody is stuck on an old screen',
  got?.body === 'newer /app.js' && shelf.get(`${ORIGIN}/app.js`)?.body === 'newer /app.js', got);

/* 손대지 않는 것들 */
ok('the calendar itself (/api/) is left alone', await through(request('/api/state')) === null);
ok('so are photos', await through(request('/api/photos/abc')) === null);
ok('so is anything that is not a GET', await through(request('/app.js', { method: 'POST' })) === null);
ok('so are other sites (fonts)', await through({ url: 'https://fonts.googleapis.com/css2', method: 'GET' }) === null);

served.set('/missing.js', response('not found', { ok: false, status: 404 }));
await through(request('/missing.js'));
ok('an error page is not kept', !shelf.has(`${ORIGIN}/missing.js`), [...shelf.keys()]);
served.set('/moved', response('elsewhere', { redirected: true }));
await through(request('/moved'));
ok('nor a redirected answer', !shelf.has(`${ORIGIN}/moved`), [...shelf.keys()]);

/* 신호가 없을 때 */
await through(request('/', { mode: 'navigate' }));
online = false;
got = await through(request('/app.js'));
ok('with no signal, the kept file is handed out', got?.body === 'newer /app.js', got);
got = await through(request('/', { mode: 'navigate' }));
ok('the app opens from the home screen', got?.body === 'fresh /', got);
got = await through(request('/?utm_source=homescreen', { mode: 'navigate' }));
ok('even when the address carries a tag', got?.body === 'fresh /', got);
got = await through(request('/never-seen.js'));
ok('a file never seen fails the way it would without the worker', got instanceof Error, got);
online = true;

/* 워커가 자리 잡기 전에 받은 파일 — 페이지가 불러 준 목록 */
asked.length = 0;
let waited = null;
listeners.message?.({
  data: { type: 'keep', urls: [`${ORIGIN}/style.css`, `${ORIGIN}/app.js`, `${ORIGIN}/api/state`, 'https://fonts.gstatic.com/a.woff2'] },
  waitUntil: (promise) => { waited = promise; },
});
await waited;
ok('files loaded before the worker took over are kept when the page lists them',
  shelf.get(`${ORIGIN}/style.css`)?.body === 'fresh /style.css', [...shelf.keys()]);
ok('only the ones not kept yet are fetched, and never /api/ or other sites',
  asked.length === 1 && asked[0] === '/style.css', asked);

/* 저장소를 못 여는 브라우저 — 화면은 평소대로 */
const realOpen = context.caches.open;
context.caches.open = async () => { throw new Error('SecurityError'); };
got = await through(request('/app.js'));
ok('when the browser refuses storage, files still come from the network', got?.body === 'newer /app.js', got);
context.caches.open = realOpen;

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
