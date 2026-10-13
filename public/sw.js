/**
 * 서비스워커 — 알림을 띄우고, 신호가 없을 때도 앱이 열리게 화면 파일을 적어 둡니다.
 * 앱이 닫혀 있어도 이 파일이 깨어나서 알림을 띄웁니다.
 */

/* 새 파일을 올리면 다음에 열 때 바로 갈아탑니다 (기다리지 않게) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/* ── 신호가 없어도 열리게 ─────────────────────
   화면 파일(HTML·CSS·JS·그림)은 늘 네트워크에서 먼저 받고, 받을 때마다 한 벌 적어 둡니다.
   못 받으면(지하철·비행기) 적어 둔 것을 내줍니다. 인터넷이 되는 동안은 늘 새 파일이라
   옛 화면에 갇힐 일이 없어요. 달력 내용(/api/)은 건드리지 않습니다 — 그건 app.js가
   지난번에 본 것(diary_state)을 먼저 그립니다. */
const SHELF = 'tt-shell-v1';

const ours = (url) => {
  const where = new URL(url, self.location.origin);
  return where.origin === self.location.origin && !where.pathname.startsWith('/api/');
};

/* 오류 페이지나 다른 주소로 넘겨진 답은 적어 두지 않습니다 — 다음에 그게 화면으로 나갑니다 */
const worthKeeping = (res) => res.status === 200 && res.type === 'basic' && !res.redirected;

async function freshOrKept(request) {
  // 저장소를 못 여는 브라우저(막아 둔 경우)에서도 화면은 평소대로 떠야 합니다
  const shelf = await caches.open(SHELF).catch(() => null);
  try {
    const fresh = await fetch(request);
    if (shelf && worthKeeping(fresh)) await shelf.put(request, fresh.clone()).catch(() => { /* 자리가 없으면 그만둡니다 */ });
    return fresh;
  } catch (err) {
    // 홈 화면 아이콘이 여는 주소에는 꼬리표(?…)가 붙을 수 있어요
    const kept = await shelf?.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (kept) return kept;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method === 'GET' && ours(request.url)) event.respondWith(freshOrKept(request));
});

/* 워커가 자리 잡기 전에 받은 파일은 위를 거치지 않았습니다. 페이지가 받은 목록을
   불러 주면(app.js keepShell) 아직 없는 것만 받아 적어 둡니다. */
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'keep') return;
  event.waitUntil((async () => {
    const shelf = await caches.open(SHELF);
    await Promise.all(event.data.urls.filter(ours).map(async (url) => {
      if (await shelf.match(url)) return;
      const res = await fetch(url).catch(() => null);
      if (res && worthKeeping(res)) await shelf.put(url, res).catch(() => {});
    }));
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* 형식이 깨졌으면 기본 문구로 띄웁니다 — 안 띄우면 브라우저가 경고를 냅니다 */
  }

  event.waitUntil(self.registration.showNotification(data.title || 'TT', {
    body: data.body || '',
    icon: '/favicon.png',
    // 갤럭시 상단바에 뜨는 작은 아이콘. 안드로이드가 모양만 떼어다 쓰기 때문에
    // 사진을 주면 뭉개진 덩어리가 됩니다 — 모양만 남긴 고양이 얼굴을 따로 줍니다.
    // 색은 안드로이드가 알아서 (밝은 상단바면 회색, 어두우면 흰색) 칠합니다.
    badge: '/badge.png',
    // 같은 일정이면 알림이 쌓이지 않고 마지막 것만 남습니다
    tag: data.tag || 'diary',
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    // 이미 열어둔 창이 있으면 그리로, 없으면 새로 엽니다
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of open) {
      if (client.url.startsWith(self.location.origin)) return client.focus();
    }
    return self.clients.openWindow('/');
  })());
});
