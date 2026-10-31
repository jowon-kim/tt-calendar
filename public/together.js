/* "우리" 탭 (10/27) — api/together.js 의 화면. app.js 와 따로 둡니다 (app.js 가 3,000줄이 넘어서).
   오늘(질문·콕·1년 전 오늘·지난 질문) · 일기(사진·앨범) · 버킷 · 가계부(월별) · 지도(장소·맛집·문화와 별점, 장소·서로 위치).
   폰 화면 한 장 크기로만 그립니다 — 데스크탑에서도 가운데 폰 폭 기둥 하나 (style.css --frame).
   지도는 열 때만 MapLibre(unpkg) 와 OpenFreeMap 벡터 지도를 불러옵니다 (키·비용 없음).
   문구는 언어팩 9개의 together.* — 그릴 때마다 읽어서, 서버가 정한 언어로 바뀌어도 따라갑니다.
   app.js 의 state · nameOf · toast 를 빌려 씁니다 (같은 전역). */
(() => {
  if (!document.body || !document.body.appendChild) return;  // screen-test.mjs 의 가짜 DOM 에는 body 가 없다
  const tr = (k, vars) => (window.t ? window.t('together.' + k, vars) : k);
  const T = new Proxy({}, { get: (_, k) => tr(k) });
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const locale = () => (window.i18n ? i18n.getLocale() : navigator.language) || 'en';
  // app.js 의 state · nameOf 는 const 라 window 에 안 붙습니다 — 전역 이름으로 직접 읽습니다
  const app = () => (typeof state === 'object' ? state : null);
  const me = () => app()?.me || 'a';
  const nameFor = (slot) => (typeof nameOf === 'function' ? nameOf(slot) : slot);
  const say = (msg) => { if (window.toast) toast(msg); };

  /* 그림 — 화면의 다른 아이콘과 같은 선 굵기 (style.css .icon-btn svg) */
  const P = {
    today: '<path d="M12 21s-7.5-4.6-7.5-10.4A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.6C19.5 16.4 12 21 12 21z"/>',
    diary: '<path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8.5h6"/>',
    bucket: '<path d="M4.5 12.5l4.5 4.5 10.5-11"/>',
    ledger: '<rect x="3.5" y="6" width="17" height="13" rx="3"/><path d="M3.5 10h17M15.5 14.5h2"/>',
    log: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    map: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    camera: '<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3V19H4z"/><circle cx="12" cy="13.2" r="3.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    locate: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
    pen: '<path d="M4.5 19.5l1-4L16 5a2 2 0 0 1 3 3L8.5 18.5z"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
    food: '<path d="M7 3v8M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2 1-3 3.6-3 7v3h3"/>',
    culture: '<path d="M4 8a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 8v2a2 2 0 0 0 0 4v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16v-2a2 2 0 0 0 0-4z"/><path d="M14 7v10"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[k]}</svg>`;
  const TABS = ['today', 'diary', 'bucket', 'ledger', 'map'];
  /* 지도에 모이는 것들 (10/31) — 옛 '기록' 칸의 맛집·문화도 여기로. 위치 없이 적은 것은 목록에만 있다가 꽂을 수 있습니다 */
  const SPOTS = ['place', 'food', 'culture'];
  const SPOT_ICON = { place: 'today', food: 'food', culture: 'culture' };
  const pinOf = (kind, cls = '') => `<span class="tg-pin ${kind} ${cls}"><svg viewBox="0 0 24 24" aria-hidden="true">${P[SPOT_ICON[kind]]}</svg></span>`;

  let data = null, tab = 'today', busy = false;
  let composing = false, editing = null, armed = null, armTimer = 0, preview = null;
  let found = null; // 지도 검색 결과 — null 이면 결과 칸을 닫습니다
  let month = null, spotKind = 'place', pending = null, filter = 'all', selected = null, pinning = null;
  let map = null, watch = null, lastSent = 0, fitted = false, mapMode = 'map';

  /* ── 서버 ── */
  async function call(method, body, query = '') {
    // 질문 글을 지금 화면 언어로 받게 언어를 같이 보냅니다
    const r = await fetch('/api/together' + (query ? query + '&' : '?') + 'lang=' + encodeURIComponent(locale()), {
      method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status, code: j.error });
    data = j;
    return j;
  }
  /** 저장 하나 — 도는 동안 버튼을 막고, 실패하면 토스트로 알리고 그대로 둡니다 */
  async function save(promise, done) {
    busy = true;
    root.classList.add('busy');
    try {
      await promise;
      if (done) done();
      render();
      return true;
    } catch (e) {
      say(e.status === 429 ? T.nudgeLimit : e.code === 'geo' ? T.denied : T.error);
      return false;
    } finally {
      busy = false;
      root.classList.remove('busy');
    }
  }
  const item = (b, done) => save(call('POST', { action: 'item', ...b }), done);
  const patch = (id, b, done) => save(call('PATCH', { action: 'item', id, ...b }), done);
  const remove = (id) => save(call('DELETE', null, '?id=' + encodeURIComponent(id)));

  /* ── 틀: 앱 아래 탭 [달력 | 우리] 위에 놓이는 한 장 — 위에 제목과 칸 고르기, 가운데 내용 ── */
  const root = document.createElement('section');
  root.id = 'together';
  root.className = 'together';
  root.hidden = true;
  root.setAttribute('aria-labelledby', 'tg-title');
  root.innerHTML = `
    <div class="tg-frame">
      <header class="tg-head">
        <h2 class="tg-title" id="tg-title"></h2>
        <span class="tg-dday"></span>
      </header>
      <nav class="tg-nav">${TABS.map((k) => `<button type="button" data-tab="${k}">${icon(k)}<span></span></button>`).join('')}</nav>
      <div class="tg-body">${TABS.map((k) => `<div class="tg-pane" data-pane="${k}"></div>`).join('')}</div>
      <div class="tg-lightbox" hidden><img alt=""></div>
    </div>`;
  document.body.appendChild(root);
  /* 칸은 옆으로 나란히 — 손가락으로 밀면 옆 칸으로 (10/31). 브라우저 스크롤이라 손을 그대로 따라옵니다.
     지도 판 위에서는 지도가 움직이고, 옆 칸으로는 위쪽 줄이나 아래 카드를 밀거나 탭을 눌러 갑니다 */
  const slider = $('.tg-body', root);
  const pane = (k) => $(`[data-pane="${k}"]`, root);
  const current = () => pane(tab);
  const at = (k) => TABS.indexOf(k);
  const slideTo = (k, smooth) => slider.scrollTo({ left: at(k) * slider.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  function settle(k) {
    tab = k; composing = false; editing = null; pending = null; pinning = null; selected = null;
    render();
  }
  root.querySelectorAll('.tg-nav button').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.tab;
      if (tab === k) return;
      const near = Math.abs(at(k) - at(tab)) === 1;
      settle(k);
      slideTo(k, near);
      current().scrollTop = 0;
    };
  });
  slider.addEventListener('scroll', () => {
    const k = TABS[Math.round(slider.scrollLeft / (slider.clientWidth || 1))];
    if (k && k !== tab) settle(k);
  }, { passive: true });
  addEventListener('resize', () => { if (!root.hidden) slideTo(tab, false); });
  const box = $('.tg-lightbox', root);
  box.onclick = () => { box.hidden = true; };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!glance.hidden) return closeGlance();
    if (root.hidden) return;
    if (!box.hidden) box.hidden = true; else close();
  });

  /* ── 들어오는 길: 앱 맨 아래 탭 [달력 | 우리] — 하트 아이콘 하나로는 뭔지 몰라서 이름을 붙였습니다 (10/27) ── */
  const appMain = $('#app');
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.innerHTML = `
    <button type="button" data-go="calendar" class="on"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><span></span></button>
    <button type="button" data-go="us"><svg viewBox="0 0 24 24" aria-hidden="true">${P.today}</svg><span></span><i class="app-nav-dot" hidden></i></button>
    <div class="app-coach" hidden><span></span><button type="button" class="app-coach-x">×</button></div>`;
  if (appMain) appMain.append(nav);
  const goCal = $('[data-go="calendar"]', nav);
  const goUs = $('[data-go="us"]', nav);
  const coach = $('.app-coach', nav);
  goCal.onclick = close;
  goUs.onclick = () => open();
  const SEEN = 'tt_us_seen';
  const seen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } };
  const markSeen = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* 사생활 모드 */ } coach.hidden = true; };
  $('.app-coach-x', coach).onclick = (e) => { e.stopPropagation(); markSeen(); };
  coach.onclick = () => open();

  /* 달력 바로 위 "우리" 카드 줄 — 오늘의 질문부터 일기·버킷·가계부·기록·지도까지 옆으로 넘겨 봅니다.
     카드를 누르면 우리 탭의 그 칸이 "바로 쓸 수 있는 상태로" 열리고, 작은 단추는 그 자리에서 끝납니다 (원터치) */
  const strip = document.createElement('section');
  strip.className = 'home-us';
  strip.hidden = true;
  strip.innerHTML = '<div class="home-us-track"></div><div class="home-us-dots"></div>';
  const track = $('.home-us-track', strip);
  const dots = $('.home-us-dots', strip);
  const monthbar = $('#app .monthbar');
  if (monthbar) monthbar.before(strip);
  /* 한눈에 보기 (10/27) — 설정 옆 단추. 같은 카드들을 위에서 내려오는 한 장에 두 줄로 다 펼쳐 봅니다 */
  const glanceBtn = $('#open-glance');
  const glance = document.createElement('div');
  glance.className = 'glance';
  glance.hidden = true;
  glance.innerHTML = `<div class="glance-panel" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="glance-title">
      <header class="glance-head"><h2 id="glance-title"></h2><span class="tg-dday"></span><span class="tg-grow"></span>
        <button type="button" class="icon-btn glance-x"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
      <div class="glance-grid"></div></div>`;
  document.body.appendChild(glance);
  const grid = $('.glance-grid', glance);
  const openGlance = () => { if (!data) return; glance.hidden = false; paintEntry(); $('.glance-panel', glance).focus({ preventScroll: true }); };
  const closeGlance = () => { glance.hidden = true; };
  if (glanceBtn) glanceBtn.onclick = openGlance;
  glance.onclick = (e) => { if (e.target === glance) closeGlance(); };
  $('.glance-x', glance).onclick = closeGlance;
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / ((track.firstElementChild?.offsetWidth || 1) + 10));
    dots.querySelectorAll('i').forEach((d, n) => d.classList.toggle('on', n === i));
  }, { passive: true });

  function cards() {
    const q = data.question;
    const other = me() === 'a' ? 'b' : 'a';
    const waiting = q.mine === null && q.theyAnswered; // 상대가 답해 두고 내 답을 기다리는 중
    const status = q.mine === null
      ? (q.theyAnswered ? tr('statusTheirs', { name: nameFor(other) }) : T.statusNone)
      : (q.theirs !== null ? T.statusBoth : tr('statusMine', { name: nameFor(other) }));
    const quick = (act, label, cls = '') => `<button type="button" class="home-quick ${cls}" data-quick="${act}">${label}</button>`;
    const card = (to, cls, inner, actions = '') => `<div role="button" tabindex="0" class="home-card ${cls}" data-open="${to}">
      <span class="home-card-top">${icon(to)}<span class="tg-kicker">${to === 'today' ? T.question : T[to]}</span><span class="tg-grow"></span><span class="home-card-go" aria-hidden="true">›</span></span>
      ${inner}${actions ? `<span class="home-card-acts">${actions}</span>` : ''}</div>`;

    const out = [card('today', waiting ? 'hot' : 'question',
      `<b class="home-card-q">${esc(q.text)}</b><span class="home-card-line">${esc(status)}</span>`,
      `${quick('answer', q.mine === null ? `✍️ ${T.goAnswer}` : T.goSee, 'solid')}${data.nudgesLeft ? quick('poke', `💗 ${T.actPoke}`) : ''}`)];

    const diary = items('diary')[0];
    out.push(card('diary', diary?.photoId ? 'photo' : '', diary
      ? `${diary.photoId ? `<img class="home-card-bg" src="${photoUrl(diary.photoId)}" alt="" loading="lazy" decoding="async">` : ''}
         <b class="home-card-big">${esc(diary.title || diary.memo.split('\n')[0])}</b><span class="home-card-line">${who(diary.member)} ${fmtDay(diary.day)}</span>`
      : `<span class="home-card-line">${T.diaryEmpty}</span>`, quick('write', `＋ ${T.writeDiary}`, 'solid')));

    const bucket = items('bucket');
    const done = bucket.filter((i) => i.done).length;
    const nextUp = bucket.find((i) => !i.done);
    out.push(card('bucket', '', bucket.length
      ? `<b class="home-card-big">${tr('bucketProgress', { done, total: bucket.length })}</b>
         <span class="tg-bar"><i style="width:${Math.round((done / bucket.length) * 100)}%"></i></span>
         ${nextUp ? `<span class="home-card-line">${tr('nextUp', { title: esc(nextUp.title) })}</span>` : ''}`
      : `<span class="home-card-line">${T.bucketEmpty}</span>`,
      nextUp ? quick(`done:${nextUp.id}`, `✓ ${T.actDone}`, 'solid') : quick('addBucket', `＋ ${T.add}`, 'solid')));

    const thisMonth = q.day.slice(0, 7);
    const spent = items('ledger').filter((i) => (i.day || String(i.createdAt).slice(0, 10)).startsWith(thisMonth));
    const sum = spent.reduce((s, i) => s + (i.amount || 0), 0);
    const byA = spent.filter((i) => i.member !== 'b').reduce((s, i) => s + (i.amount || 0), 0);
    const pa = sum ? Math.round((byA / sum) * 100) : 50;
    out.push(card('ledger', '', `<span class="home-card-line">${T.thisMonth}</span><b class="home-card-money">${money(sum)}</b>
      ${sum ? `<span class="tg-split"><i class="a" style="width:${pa}%"></i><i class="b" style="width:${100 - pa}%"></i></span>` : ''}`,
      quick('spend', `＋ ${T.actSpend}`, 'solid')));

    const loc = data.location;
    const where = loc.on && loc.them
      ? (() => { const d = km(loc.me, loc.them); return tr('distance', { km: dist(d) }); })()
      : loc.on ? T.theyOff : T.shareOffShort;
    const all = spots();
    const latest = [...all].sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)))[0];
    out.push(card('map', '', `<b class="home-card-big">${tr('placesCount', { n: all.length })}</b>${latest ? `<span class="home-card-line">${esc(latest.title)}</span>${stars(latest.rating)}` : ''}<span class="home-card-line">${esc(where)}</span>`,
      `<button type="button" class="tg-switch small ${loc.on ? 'on' : ''}" role="switch" aria-checked="${loc.on}" aria-label="${T.share}" data-quick="share"><i></i></button><span class="home-card-line">${loc.on ? T.sharing : T.share}</span>`));
    return { html: out.join(''), waiting };
  }

  /* 카드 단추: 그 자리에서 끝내거나(콕·했어요·위치 공유), 우리 탭을 쓰는 칸까지 열어 줍니다 */
  function quickAct(act) {
    if (act === 'answer') return open('today', data.question.mine === null ? 'answer' : null);
    if (act === 'poke') return save(call('POST', { action: 'nudge' }), () => say(T.nudgeSent));
    if (act === 'write') return open('diary', 'compose');
    if (act === 'addBucket') return open('bucket', 'add');
    if (act === 'spend') return open('ledger', 'amount');
    if (act === 'share') return toggleShare();
    if (act.startsWith('done:')) {
      const id = act.slice(5);
      return patch(id, { done: true }, () => say(T.doneToast));
    }
  }

  function wireCards(box) {
    box.querySelectorAll('[data-open]').forEach((c) => {
      const go = () => open(c.dataset.open, c.dataset.open === 'today' && data.question.mine === null ? 'answer' : null);
      c.onclick = go;
      c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    });
    box.querySelectorAll('[data-quick]').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); if (!busy) quickAct(b.dataset.quick); };
    });
  }

  function paintEntry() {
    goCal.lastElementChild.textContent = T.navCalendar;
    goUs.querySelector('span').textContent = T.navUs;
    $('span', coach).textContent = T.coach;
    $('.app-coach-x', coach).setAttribute('aria-label', T.close);
    coach.hidden = seen() || !root.hidden;
    if (!data) { strip.hidden = true; if (glanceBtn) glanceBtn.hidden = true; return; }
    const { html, waiting } = cards();
    goUs.querySelector('.app-nav-dot').hidden = !waiting;
    // 같은 내용이면 건드리지 않습니다 — 사진이 다시 그려지고 넘기던 자리가 튀지 않게
    if (html !== track.dataset.html) {
      const keep = track.scrollLeft;
      track.innerHTML = html;
      track.dataset.html = html;
      track.scrollLeft = keep;
      wireCards(track);
    }
    if (glanceBtn) {
      glanceBtn.hidden = false;
      glanceBtn.classList.toggle('hot', waiting);
      glanceBtn.setAttribute('aria-label', T.glance);
    }
    if (!glance.hidden) {
      $('h2', glance).textContent = T.glance;
      $('.tg-dday', glance).textContent = dday();
      $('.glance-x', glance).setAttribute('aria-label', T.close);
      grid.innerHTML = html;
      wireCards(grid);
    }
    const n = track.children.length;
    if (dots.children.length !== n) {
      // 점을 누르면 그 카드로 — 마우스로는 옆으로 밀기 어려운 컴퓨터에서도 넘겨 볼 수 있게
      dots.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i === 0 ? 'on' : ''}" data-to="${i}"></i>`).join('');
      dots.querySelectorAll('i').forEach((d) => {
        d.onclick = () => {
          const card = track.children[Number(d.dataset.to)];
          if (card) track.scrollTo({ left: card.offsetLeft - track.firstElementChild.offsetLeft, behavior: 'smooth' });
        };
      });
    }
    strip.hidden = false;
  }

  /* 달력이 보일 때 한 번, 다시 앞으로 왔을 때 1분에 한 번까지만 읽습니다 (Neon 깨우는 횟수 아끼기) */
  let lastLoad = 0;
  const KEPT = 'diary_together';
  async function refresh(force = false) {
    if (!appMain || appMain.hidden) return;
    if (!force && Date.now() - lastLoad < 60000) return paintEntry();
    lastLoad = Date.now();
    if (!data) { try { data = JSON.parse(localStorage.getItem(KEPT)); paintEntry(); } catch { /* 처음이거나 깨졌으면 기다립니다 */ } }
    try {
      await call('GET');
      try { localStorage.setItem(KEPT, JSON.stringify(data)); } catch { /* 꽉 찼으면 그만둡니다 */ }
    } catch { /* 첫 화면 카드만 못 그릴 뿐 */ }
    paintEntry();
  }
  // 로그아웃하면(#app 이 숨으면) 우리 탭도 닫습니다
  if (appMain) new MutationObserver(() => (appMain.hidden ? close() : refresh())).observe(appMain, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  // 언어를 바꾸면(i18n.setLocale 이 <html lang> 을 바꿉니다) 질문 글도 그 언어로 바로 다시 받습니다
  new MutationObserver(() => {
    if (!data) return;
    if (!root.hidden) open(); else refresh(true);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  /** to = 열 칸, focus = 열자마자 쓸 수 있게 할 곳 ('answer' · 'compose' · 'add' · 'amount') */
  async function open(to, focus) {
    if (to) { tab = to; composing = focus === 'compose'; editing = null; pending = null; }
    glance.hidden = true;
    root.hidden = false;
    slideTo(tab, false); // 숨었다 나오면 옆 스크롤 자리가 처음으로 돌아갑니다
    document.documentElement.classList.add('tg-open');
    goCal.classList.remove('on');
    goUs.classList.add('on');
    markSeen();
    render();
    try { await call('GET'); lastLoad = Date.now(); } catch (e) {
      if (e.status === 401) { close(); return; }
      say(T.error);
    }
    if (data?.location.on) startWatch(); // 켜 둔 채 다시 열면 이어서 올립니다
    render();
    if (focus) {
      const target = { answer: '.tg-answer textarea', compose: '.tg-compose textarea', add: 'form[data-form="item"] input[name="title"]', amount: '.tg-ledger-add input[name="amount"]' }[focus];
      const el = target && $(target, current());
      if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }
    }
  }
  function close() {
    glance.hidden = true;
    root.hidden = true;
    document.documentElement.classList.remove('tg-open');
    goUs.classList.remove('on');
    goCal.classList.add('on');
    stopWatch();
    if (map) { map.remove(); map = null; }
    pane('map').innerHTML = '';
    paintEntry();
  }

  /* ── 그리기 ── */
  function render() {
    $('.tg-title', root).textContent = T.title;
    $('.tg-dday', root).textContent = dday();
    root.querySelectorAll('.tg-nav button').forEach((b) => {
      b.classList.toggle('on', b.dataset.tab === tab);
      b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
      b.lastElementChild.textContent = T[b.dataset.tab];
    });
    paintEntry();
    root.dataset.tab = tab;
    if (!data || root.hidden) return;
    paintPane(tab);
    // 옆 칸은 한가할 때 미리 — 밀 때 빈 칸이 보이지 않게
    clearIdle(); idleJob = idle(() => [at(tab) - 1, at(tab) + 1].forEach((i) => { if (TABS[i] && !root.hidden) paintPane(TABS[i]); }));
  }
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 80));
  const clearIdle = () => (window.cancelIdleCallback ? cancelIdleCallback(idleJob) : clearTimeout(idleJob));
  let idleJob = 0;
  /** 칸 하나 — 내용이 그대로면 손대지 않습니다 (쓰던 글·사진·스크롤이 그대로 남게) */
  function paintPane(k) {
    if (k === 'map') return renderMap();
    const views = { today: todayView, diary: diaryView, bucket: bucketView, ledger: ledgerView };
    const html = `<p class="tg-lead">${T['lead' + k[0].toUpperCase() + k.slice(1)]}</p>` + views[k]();
    const el = pane(k);
    if (el.dataset.html === html) return;
    el.dataset.html = html;
    el.innerHTML = html;
    wire(el);
  }

  /** 처음 만난 날부터 — 설정에 적어 뒀을 때만 */
  function dday() {
    const since = app()?.settings?.since;
    if (!since || !data) return '';
    const days = Math.round((Date.parse(data.question.day) - Date.parse(since)) / 864e5) + 1;
    return days > 0 ? tr('dday', { n: days }) : '';
  }

  const items = (k) => (data ? data.items.filter((i) => i.kind === k) : []);
  const who = (slot) => `<i class="tg-who ${slot === 'b' ? 'b' : 'a'}" title="${esc(nameFor(slot))}"></i>`;
  /* Intl 은 만들 때가 비쌉니다 — 가계부 한 칸에 수십 번 부르므로 한 번 만들어 씁니다 */
  const fmts = new Map();
  const fmt = (Kind, opts) => {
    const key = `${Kind.name}|${locale()}|${JSON.stringify(opts)}`;
    if (!fmts.has(key)) fmts.set(key, new Kind(locale(), opts));
    return fmts.get(key);
  };
  const fmtDay = (d, opts = { month: 'short', day: 'numeric' }) => {
    if (!d) return '';
    const [y, m, n] = d.split('-').map(Number);
    return fmt(Intl.DateTimeFormat, { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, n)));
  };
  const money = (n) => fmt(Intl.NumberFormat, undefined).format(n || 0);
  /* 지우기는 한 번에 — 실수면 토스트의 "되돌리기". 사진 붙은 일기만은 사진을 되살릴 수 없어서 한 번 더 묻습니다 */
  const delBtn = (id, confirm = false) => `<button class="tg-icon-btn ${armed === id ? 'armed' : ''}" type="button" data-del="${id}" ${confirm ? 'data-confirm' : ''} aria-label="${armed === id ? T.confirmDel : T.del}">${armed === id ? `<span>${T.confirmDel}</span>` : icon('trash')}</button>`;
  /** 줄 글씨를 누르면 그 자리에서 고치기 */
  const editable = (i, inner) => `<span class="tg-text" role="button" tabindex="0" data-edit="${i.id}" aria-label="${T.edit}">${inner}</span>`;
  const editBtn = (id) => `<button class="tg-icon-btn" type="button" data-edit="${id}" aria-label="${T.edit}">${icon('pen')}</button>`;
  const empty = (k, text) => `<div class="tg-empty">${icon(k)}<p>${text}</p></div>`;

  /* 오늘 */
  function todayView() {
    const q = data.question;
    const answered = q.mine !== null;
    const memories = items('diary').filter((i) => i.day === `${Number(q.day.slice(0, 4)) - 1}${q.day.slice(4)}`);
    const other = me() === 'a' ? 'b' : 'a';
    const bubble = (slot, text, side) => `<div class="tg-bubble ${side} ${slot}"><b>${esc(nameFor(slot))}</b><p>${esc(text)}</p></div>`;
    const answerForm = (value = '') => `<form class="tg-answer" data-form="answer">
        <textarea name="text" rows="3" required maxlength="1000" placeholder="${T.answerPlaceholder}">${esc(value)}</textarea>
        <button class="btn btn-solid">${value ? T.save : T.answer}</button></form>`;
    let answers;
    if (!answered) {
      answers = `${q.theyAnswered ? `<div class="tg-bubble left ${other} locked">${icon('lock')}<p>${T.lockedBubble}</p></div>` : ''}
        <p class="tg-hint">${q.theyAnswered ? T.theyDone : T.locked}</p>${answerForm()}`;
    } else if (editing === 'answer') {
      answers = answerForm(q.mine);
    } else {
      answers = `${q.theirs !== null ? bubble(other, q.theirs, 'left') : `<div class="tg-bubble left ${other} wait"><p>${T.waiting}</p></div>`}
        ${bubble(me(), q.mine, 'right')}
        <button class="tg-text-btn" type="button" data-edit="answer">${T.editAnswer}</button>`;
    }
    const left = data.nudgesLeft;
    return `
      <article class="tg-qcard">
        <span class="tg-kicker">${T.question} · ${fmtDay(q.day)}</span>
        <h3 class="tg-q">${esc(q.text)}</h3>
        <div class="tg-answers">${answers}</div>
      </article>
      <article class="tg-card tg-nudge">
        <button class="tg-heart" type="button" data-act="nudge" ${left ? '' : 'disabled'} aria-label="${T.nudge}">${icon('today')}</button>
        <div><b>${T.nudge}</b><p class="tg-hint">${left ? T.nudgeHint : T.nudgeLimit}</p>
          <span class="tg-dots" aria-label="${tr('nudgesLeft', { n: left })}">${[0, 1, 2].map((i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</span></div>
      </article>
      ${memories.length ? `<article class="tg-card"><span class="tg-kicker">${T.memory}</span>
        <div class="tg-polaroids">${memories.map((i) => `<figure class="tg-polaroid">${i.photoId ? `<img src="${photoUrl(i.photoId)}" alt="" data-zoom>` : `<div class="tg-blank">${esc(i.memo || i.title)}</div>`}
          <figcaption>${esc(i.title || fmtDay(i.day, { year: 'numeric', month: 'short', day: 'numeric' }))}</figcaption></figure>`).join('')}</div></article>` : ''}
      ${data.history?.length ? `<details class="tg-card tg-history"><summary>${T.history} <span class="tg-count">${data.history.length}</span></summary>
        ${data.history.map((h) => `<div class="tg-past"><span class="tg-kicker">${fmtDay(h.day)}</span><p class="tg-past-q">${esc(h.text)}</p>
          <p><b>${esc(nameFor(me()))}</b> ${esc(h.mine)}</p>${h.theirs !== null ? `<p><b>${esc(nameFor(other))}</b> ${esc(h.theirs)}</p>` : ''}</div>`).join('')}</details>` : ''}`;
  }

  /* 일기 */
  const photoUrl = (id) => '/api/photos/' + encodeURIComponent(id);
  function diaryForm(i = null) {
    const day = i?.day || data.question.day;
    return `<form class="tg-card tg-compose" data-form="diary" ${i ? `data-id="${i.id}"` : ''}>
        <input name="day" type="date" value="${day}" required aria-label="${T.day}">
        <input name="title" placeholder="${T.title_}" maxlength="120" value="${esc(i?.title || '')}">
        <textarea name="memo" rows="5" placeholder="${T.diaryPlaceholder}" maxlength="2000">${esc(i?.memo || '')}</textarea>
        <label class="tg-photo-pick">${preview || i?.photoId ? `<img src="${preview || photoUrl(i.photoId)}" alt="">` : `${icon('camera')}<span>${T.photo}</span>`}
          <input name="photo" type="file" accept="image/*" hidden></label>
        <div class="tg-actions"><button class="btn btn-ghost" type="button" data-act="cancel">${T.cancel}</button><button class="btn btn-solid">${T.save}</button></div>
      </form>`;
  }
  function diaryView() {
    const list = items('diary');
    const album = list.filter((i) => i.photoId);
    const feed = list.map((i) => editing === i.id ? diaryForm(i) : `
      <article class="tg-entry">
        ${i.photoId ? `<img class="tg-entry-photo" src="${photoUrl(i.photoId)}" alt="" loading="lazy" decoding="async" data-zoom>` : ''}
        <div class="tg-entry-body">
          <div class="tg-entry-meta">${who(i.member)}<span>${fmtDay(i.day, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
            <span class="tg-grow"></span>${editBtn(i.id)}${delBtn(i.id, !!i.photoId)}</div>
          ${i.title ? `<h4>${esc(i.title)}</h4>` : ''}${i.memo ? `<p>${esc(i.memo)}</p>` : ''}
        </div>
      </article>`).join('');
    return `${composing ? diaryForm() : `<button class="tg-cta" type="button" data-act="compose">${icon('plus')}<span>${T.writeDiary}</span></button>`}
      ${album.length ? `<section class="tg-section"><h3>${T.album} <span class="tg-count">${album.length}</span></h3>
        <div class="tg-album">${album.map((i) => `<img src="${photoUrl(i.photoId)}" alt="" loading="lazy" decoding="async" data-zoom>`).join('')}</div></section>` : ''}
      ${list.length ? `<section class="tg-section">${feed}</section>` : composing ? '' : empty('diary', T.diaryEmpty)}`;
  }

  /* 버킷 */
  function bucketView() {
    const list = items('bucket');
    const done = list.filter((i) => i.done);
    const todo = list.filter((i) => !i.done);
    const pct = list.length ? Math.round((done.length / list.length) * 100) : 0;
    const row = (i) => editing === i.id ? editRow(i) : `
      <li class="tg-check ${i.done ? 'done' : ''}">
        <label class="tg-tick"><input type="checkbox" data-done="${i.id}" ${i.done ? 'checked' : ''} aria-label="${esc(i.title)}"><span class="tg-box"></span></label>
        ${editable(i, `<b>${esc(i.title)}</b>${i.memo ? `<small>${esc(i.memo)}</small>` : ''}`)}
        ${who(i.member)}${delBtn(i.id)}</li>`;
    return `${list.length ? `<article class="tg-card tg-progress"><div class="tg-progress-top"><b>${tr('bucketProgress', { done: done.length, total: list.length })}</b><span>${pct}%</span></div>
        <div class="tg-bar"><i style="width:${pct}%"></i></div></article>` : ''}
      ${addRow('bucket', T.bucketPlaceholder)}
      ${list.length ? `<ul class="tg-list">${todo.map(row).join('')}</ul>
        ${done.length ? `<h3 class="tg-sub">${T.doneSection}</h3><ul class="tg-list">${done.map(row).join('')}</ul>` : ''}` : empty('bucket', T.bucketEmpty)}`;
  }
  const addRow = (kind, placeholder, extra = '') => `<form class="tg-add" data-form="item" data-kind="${kind}">
      <input name="title" placeholder="${placeholder}" required maxlength="120" aria-label="${T.title_}">${extra}
      <button class="tg-add-btn" aria-label="${T.add}">${icon('plus')}</button></form>`;
  /** 한 줄 고치기 — 제목·메모 (가계부는 금액·날짜, 기록은 별점도) */
  function editRow(i) {
    return `<li class="tg-editing"><form class="tg-edit" data-form="edit" data-id="${i.id}">
        <input name="title" value="${esc(i.title)}" required maxlength="120" aria-label="${T.title_}">
        ${i.kind === 'ledger' ? `<input name="amount" type="number" inputmode="numeric" value="${i.amount ?? ''}" required aria-label="${T.amount}">
          <input name="day" type="date" value="${i.day || ''}" aria-label="${T.day}">` : ''}
        <input name="memo" value="${esc(i.memo)}" maxlength="2000" placeholder="${T.memo}">
        ${SPOTS.includes(i.kind) ? stars(i.rating, true) : ''}
        <div class="tg-actions"><button class="btn btn-ghost" type="button" data-act="cancel">${T.cancel}</button><button class="btn btn-solid">${T.save}</button></div>
      </form></li>`;
  }

  /* 가계부: 한 달씩 */
  function ledgerView() {
    month = month || data.question.day.slice(0, 7);
    const all = items('ledger');
    const list = all.filter((i) => (i.day || String(i.createdAt).slice(0, 10)).startsWith(month));
    const sum = list.reduce((s, i) => s + (i.amount || 0), 0);
    const by = { a: 0, b: 0 };
    list.forEach((i) => { by[i.member === 'b' ? 'b' : 'a'] += i.amount || 0; });
    const pa = sum ? Math.round((by.a / sum) * 100) : 50;
    const [y, m] = month.split('-').map(Number);
    const title = fmt(Intl.DateTimeFormat, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
    // 지난달과 견주기 — 두 달 다 적은 게 있을 때만
    const before = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
    const prev = all.filter((i) => (i.day || String(i.createdAt).slice(0, 10)).startsWith(before)).reduce((s, i) => s + (i.amount || 0), 0);
    const diff = sum - prev;
    const groups = {};
    list.forEach((i) => { (groups[i.day || ''] ||= []).push(i); });
    return `<article class="tg-card tg-month">
        <div class="tg-month-nav"><button class="icon-btn" type="button" data-month="-1" aria-label="${T.prev}">${icon('back')}</button>
          <b>${title}</b><button class="icon-btn" type="button" data-month="1" aria-label="${T.next}">${icon('next')}</button></div>
        <p class="tg-total">${money(sum)}</p>
        ${sum && prev && diff ? `<p class="tg-vs ${diff > 0 ? 'up' : 'down'}">${tr(diff > 0 ? 'vsMore' : 'vsLess', { amount: money(Math.abs(diff)) })}</p>` : ''}
        ${sum ? `<div class="tg-split"><i class="a" style="width:${pa}%"></i><i class="b" style="width:${100 - pa}%"></i></div>
          <div class="tg-legend"><span>${who('a')}${esc(nameFor('a'))} ${money(by.a)}</span><span>${who('b')}${esc(nameFor('b'))} ${money(by.b)}</span></div>` : ''}
      </article>
      <form class="tg-card tg-ledger-add" data-form="item" data-kind="ledger">
        <input class="tg-amount-in" name="amount" type="number" inputmode="numeric" min="0" placeholder="${T.amount}" required aria-label="${T.amount}">
        <div class="tg-two"><input name="title" placeholder="${T.ledgerPlaceholder}" required maxlength="120" aria-label="${T.title_}">
          <input name="day" type="date" value="${month === data.question.day.slice(0, 7) ? data.question.day : `${month}-01`}" aria-label="${T.day}"></div>
        <button class="btn btn-solid">${T.add}</button>
      </form>
      ${list.length ? Object.keys(groups).sort().reverse().map((d) => `<section class="tg-section"><h3 class="tg-sub">${fmtDay(d, { month: 'long', day: 'numeric', weekday: 'short' })}</h3>
        <ul class="tg-list">${groups[d].map((i) => editing === i.id ? editRow(i) : `<li class="tg-money">${who(i.member)}
          ${editable(i, `<b>${esc(i.title)}</b>${i.memo ? `<small>${esc(i.memo)}</small>` : ''}`)}
          <b class="tg-amount" data-edit="${i.id}">${money(i.amount)}</b>${delBtn(i.id)}</li>`).join('')}</ul></section>`).join('') : empty('ledger', T.ledgerEmpty)}`;
  }

  /* 별점 */
  /** 별: input = 입력 칸 안, id = 목록에서 바로 눌러 바꾸기, 둘 다 없으면 보기만 */
  const stars = (n, input = false, id = null) => `<span class="tg-stars ${input ? 'input' : id ? 'tap' : ''}" ${input ? `role="radiogroup" aria-label="${T.rate}"` : `aria-label="${n || 0}/5"`}>${[1, 2, 3, 4, 5].map((s) => input
    ? `<label><input type="radio" name="rating" value="${s}" ${n === s ? 'checked' : ''}><i class="${s <= (n || 0) ? 'on' : ''}">★</i></label>`
    : id ? `<button type="button" class="${s <= (n || 0) ? 'on' : ''}" data-rate="${id}" data-v="${s}" aria-label="${s}/5">★</button>`
      : `<i class="${s <= (n || 0) ? 'on' : ''}">★</i>`).join('')}</span>`;
  /* ── 동작 ── */
  function wire(body) {
    body.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.del;
        if ('confirm' in b.dataset && armed !== id) { armed = id; clearTimeout(armTimer); armTimer = setTimeout(() => { armed = null; render(); }, 3000); render(); return; }
        armed = null; clearTimeout(armTimer);
        const gone = data.items.find((i) => i.id === id);
        if (!(await remove(id)) || !gone) return;
        // 되돌리기: 같은 내용으로 다시 적습니다 (사진 붙은 일기는 위에서 두 번 물었으니 여기 오지 않습니다)
        if (window.toast) toast(T.deleted, { label: T.undo, run: () => item(Object.fromEntries(Object.entries(gone).filter(([k]) => ['kind', 'title', 'memo', 'done', 'amount', 'day', 'lat', 'lng', 'rating'].includes(k)))) });
      };
    });
    body.querySelectorAll('[data-edit]').forEach((b) => {
      const go = () => { editing = b.dataset.edit; composing = false; preview = null; render(); $('.tg-edit input', current())?.focus(); };
      b.onclick = go;
      b.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    });
    body.querySelectorAll('[data-rate]').forEach((b) => { b.onclick = () => patch(b.dataset.rate, { rating: Number(b.dataset.v) }); });
    body.querySelectorAll('[data-done]').forEach((c) => { c.onchange = () => patch(c.dataset.done, { done: c.checked }); });
    body.querySelectorAll('[data-zoom]').forEach((img) => { img.onclick = () => { $('img', box).src = img.src; box.hidden = false; }; });
    body.querySelectorAll('[data-month]').forEach((b) => {
      b.onclick = () => {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(Date.UTC(y, m - 1 + Number(b.dataset.month), 1));
        month = d.toISOString().slice(0, 7);
        render();
      };
    });
    body.querySelectorAll('[data-spot]').forEach((b) => {
      b.onclick = () => {
        spotKind = b.dataset.spot;
        const form = b.closest('form');
        form.dataset.kind = spotKind;
        form.querySelectorAll('[data-spot]').forEach((x) => x.classList.toggle('on', x === b));
        $('input[name="title"]', form).placeholder = spotHint(spotKind);
      };
    });
    body.querySelectorAll('.tg-stars.input input').forEach((r) => {
      r.onchange = () => r.closest('.tg-stars').querySelectorAll('i').forEach((i, n) => i.classList.toggle('on', n < Number(r.value)));
    });
    const act = (name, fn) => body.querySelectorAll(`[data-act="${name}"]`).forEach((b) => { b.onclick = fn; });
    act('compose', () => { composing = true; editing = null; preview = null; render(); $('textarea', current())?.focus(); });
    act('cancel', () => { composing = false; editing = null; preview = null; pending = null; pinning = null; render(); });
    act('nudge', (ev) => {
      const heart = ev.currentTarget;
      heart.classList.add('beat');
      save(call('POST', { action: 'nudge' }), () => say(T.nudgeSent));
    });
    const photo = $('input[name="photo"]', body);
    if (photo) {
      photo.onchange = () => {
        const f = photo.files[0];
        const pick = photo.closest('.tg-photo-pick');
        if (!f) return;
        if (preview) URL.revokeObjectURL(preview);
        preview = URL.createObjectURL(f);
        pick.querySelectorAll('svg, span, img').forEach((n) => n.remove());
        pick.insertAdjacentHTML('afterbegin', `<img src="${preview}" alt="">`);
      };
    }
    body.querySelectorAll('form[data-form]').forEach((f) => {
      f.onsubmit = async (ev) => {
        ev.preventDefault();
        if (busy) return;
        const v = Object.fromEntries(new FormData(f));
        const kind = f.dataset.form;
        if (kind === 'answer') return save(call('POST', { action: 'answer', text: v.text }), () => { editing = null; });
        if (kind === 'item') {
          return item({ kind: f.dataset.kind, title: v.title, memo: v.memo || '', amount: v.amount, day: v.day, rating: v.rating ? Number(v.rating) : undefined },
            () => { if (f.dataset.kind === 'ledger' && v.day) month = v.day.slice(0, 7); });
        }
        if (kind === 'edit') {
          const it = data.items.find((i) => i.id === f.dataset.id);
          const change = { title: v.title, memo: v.memo || '' };
          if (it.kind === 'ledger') Object.assign(change, { amount: v.amount, day: v.day });
          if ('rating' in v) change.rating = Number(v.rating);
          return patch(it.id, change, () => { editing = null; });
        }
        if (kind === 'diary') {
          const file = f.photo.files[0];
          let photoId;
          if (file) {
            try { photoId = await upload(file); } catch { say(T.photoFailed); return; }
          }
          const fields = { title: v.title, memo: v.memo, day: v.day, ...(photoId ? { photoId } : {}) };
          const after = () => { composing = false; editing = null; if (preview) URL.revokeObjectURL(preview); preview = null; };
          return f.dataset.id ? patch(f.dataset.id, fields, after) : item({ kind: 'diary', ...fields }, after);
        }
      };
    });
  }

  /** 사진: 긴 변 1280px webp 로 줄여 /api/photos 에 일기 사진으로 올리고 id 를 받습니다 */
  async function upload(file) {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/webp', 0.82);
    const mime = url.startsWith('data:image/webp') ? 'image/webp' : 'image/png';
    const r = await fetch('/api/photos', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mime, data: url.split(',')[1], purpose: 'diary' }) });
    if (!r.ok) throw new Error('upload');
    return (await r.json()).id;
  }

  /** 위치 공유 켜기·끄기 — 지도 카드와 첫 화면 카드가 같이 씁니다.
      켜는 순간 한 번 바로 올리고, 그 뒤로는 우리 탭이 열려 있는 동안 1분에 한 번 */
  function toggleShare(button) {
    if (data.location.on) return save(call('POST', { action: 'location', on: false }), () => stopWatch());
    if (!navigator.geolocation) return say(T.denied);
    button?.classList.add('on');
    navigator.geolocation.getCurrentPosition((p) => {
      lastSent = Date.now();
      save(call('POST', { action: 'location', on: true, lat: p.coords.latitude, lng: p.coords.longitude }), () => { fitted = false; if (!root.hidden) startWatch(); });
    }, () => { button?.classList.remove('on'); say(T.denied); }, { timeout: 20000, maximumAge: 60000 });
  }

  /* ── 위치: 켜 둔 동안 이 화면이 열려 있으면 1분에 한 번만 올립니다 ── */
  function startWatch() {
    if (!navigator.geolocation || watch !== null) return;
    watch = navigator.geolocation.watchPosition((p) => {
      if (Date.now() - lastSent < 60000 && data.location.on) return;
      lastSent = Date.now();
      call('POST', { action: 'location', on: true, lat: p.coords.latitude, lng: p.coords.longitude }).then(render).catch(() => say(T.error));
    }, () => {
      // 이 기기에서 위치를 못 읽으면 올리기만 멈춥니다. 공유를 끄는 건 스위치로만 —
      // 폰에서 켜 둔 공유가 권한 없는 노트북에서 화면을 열었다고 꺼지면 안 되니까요
      stopWatch();
    }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 });
  }
  function stopWatch() { if (watch !== null && navigator.geolocation) navigator.geolocation.clearWatch(watch); watch = null; }

  /* ── 지도: MapLibre 를 처음 열 때만 불러옵니다. 그림은 OpenFreeMap 벡터 지도 (키·비용 없음).
     밝은 테마는 positron 을 테마 색으로 다시 칠하고, 밤 테마는 dark. 지명은 화면 언어로 ── */
  let lib = null;
  function loadMap() {
    if (lib) return lib;
    lib = new Promise((ok, fail) => {
      const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css' });
      const js = Object.assign(document.createElement('script'), { src: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js', onload: ok, onerror: () => { lib = null; fail(); } });
      document.head.append(css, js);
    });
    return lib;
  }
  const km = (a, b) => {
    const r = (x) => (x * Math.PI) / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  const dist = (d) => (d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(d < 10 ? 1 : 0)}km`);
  const ago = (at) => {
    const s = (Date.parse(at) - Date.now()) / 1000;
    const f = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
    return Math.abs(s) < 3600 ? f.format(Math.round(s / 60), 'minute') : Math.abs(s) < 86400 ? f.format(Math.round(s / 3600), 'hour') : f.format(Math.round(s / 86400), 'day');
  };
  const initial = (slot) => esc([...nameFor(slot)][0] || '♥');
  const other = () => (me() === 'a' ? 'b' : 'a');
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /** positron 을 지금 테마 색으로 — 바탕은 종이색, 물은 옅은 하늘, 공원은 잎빛, 길은 흰색 */
  function paint() {
    const set = (id, prop, value) => { if (map.getLayer(id)) map.setPaintProperty(id, prop, value); };
    const hide = (id) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); };
    // 도로 번호판·국경선·작은 동네 이름처럼 핀과 눈길을 다투는 것은 뺍니다
    for (const id of ['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us', 'boundary_3', 'label_other', 'aeroway-taxiway', 'railway_service', 'railway_service_dashline']) hide(id);
    if (document.documentElement.dataset.theme === 'night') return;
    const ink = cssVar('--ink') || '#40323A';
    const paper = cssVar('--paper') || '#FBF3F4';
    set('background', 'background-color', paper);
    set('water', 'fill-color', '#BFE0EC');
    set('waterway', 'line-color', '#BFE0EC');
    set('park', 'fill-color', '#D5EBC8');
    set('park', 'fill-opacity', 1);
    set('landcover_wood', 'fill-color', '#CDE6BF');
    set('landcover_wood', 'fill-opacity', 0.75);
    set('landuse_residential', 'fill-color', cssVar('--paper-2') || '#FDF7F7');
    set('building', 'fill-color', cssVar('--surface-sink') || '#F6E9E9');
    set('building', 'fill-opacity', 0.75);
    for (const id of ['highway_minor', 'highway_path', 'highway_major_inner', 'highway_major_subtle']) set(id, 'line-color', '#FFFFFF');
    for (const id of ['highway_motorway_inner', 'highway_motorway_subtle', 'highway_motorway_bridge_inner']) set(id, 'line-color', '#FFE9C7');
    for (const id of ['highway_major_casing', 'highway_motorway_casing', 'highway_motorway_bridge_casing']) set(id, 'line-color', cssVar('--line-2') || '#EBD9DC');
    for (const id of ['railway', 'railway_dashline', 'railway_transit', 'railway_transit_dashline']) set(id, 'line-opacity', 0.3);
    for (const l of map.getStyle().layers) {
      if (l.type !== 'symbol' || !l.layout?.['text-field']) continue;
      set(l.id, 'text-color', /^water/.test(l.id) ? '#5C93A8' : ink);
      set(l.id, 'text-halo-color', /^water/.test(l.id) ? '#DDF0F6' : paper);
      set(l.id, 'text-halo-width', 1.6);
      if (/^label_city/.test(l.id)) set(l.id, 'text-opacity', 0.45); // 큰 도시 이름이 핀을 누르지 않게
    }
  }
  /** 지명은 화면 언어로 — 없으면 원래 이름 */
  function relabel() {
    const lang = locale().split('-')[0];
    const field = ['coalesce', ['get', `name:${lang}`], ['get', 'name']];
    for (const l of map.getStyle().layers) {
      if (l.type !== 'symbol' || !l.layout?.['text-field']) continue;
      if (/shield|housenumber/.test(l.id)) continue;
      map.setLayoutProperty(l.id, 'text-field', field);
    }
  }

  const spots = () => (data ? data.items.filter((i) => SPOTS.includes(i.kind)) : []);
  const shown = () => spots().filter((i) => filter === 'all' || i.kind === filter);
  const spotHint = (k) => ({ place: T.placeName, food: T.foodPlaceholder, culture: T.culturePlaceholder }[k]);
  const kindName = (k) => T[k === 'place' ? 'placeKind' : k];
  const kindPick = () => `<div class="tg-chips in-form">${SPOTS.map((k) => `<button type="button" class="tg-chip ${k === spotKind ? 'on' : ''}" data-spot="${k}">${kindName(k)}</button>`).join('')}</div>`;
  /** 고른 핀 한 장 — 별점은 그 자리에서, 고치기는 목록에서 */
  function spotCard(i) {
    const d = data.location?.me && i.lat != null ? km(data.location.me, i) : null;
    return `<div class="tg-sheet tg-spot">
        <div class="tg-spot-top">${pinOf(i.kind, 'mini')}<div class="tg-spot-name"><b>${esc(i.title)}</b><small>${kindName(i.kind)}${d != null ? ` · ${dist(d)}` : ''}</small></div>
          ${who(i.member)}<button class="tg-icon-btn" type="button" data-act="unselect" aria-label="${T.close}">${icon('close')}</button></div>
        ${stars(i.rating, false, i.id)}${i.memo ? `<p class="tg-spot-memo">${esc(i.memo)}</p>` : ''}
        <div class="tg-spot-acts"><a class="btn btn-solid" href="${esc(route(i))}" target="_blank" rel="noopener">${T.directions}</a>
          <button class="btn btn-ghost" type="button" data-editspot="${i.id}">${T.edit}</button>${delBtn(i.id)}</div>
      </div>`;
  }
  function mapCard() {
    const loc = data.location;
    let status = T.shareNote;
    if (loc.on && loc.them) {
      const d = km(loc.me, loc.them);
      status = tr('distance', { km: dist(d) }) + ' · ' + tr('updated', { time: ago(loc.them.at) });
    } else if (loc.on) status = T.theyOff;
    const picked = selected && spots().find((i) => i.id === selected);
    if (selected && !picked) selected = null;
    if (pinning) return `<div class="tg-sheet"><p class="tg-hint tg-tap">📍 ${T.pinTap}</p>
        <div class="tg-actions"><button class="btn btn-ghost" type="button" data-act="cancel">${T.cancel}</button></div></div>`;
    if (pending) return `<form class="tg-sheet" data-form="place" data-kind="${spotKind}">
        ${kindPick()}
        <input name="title" placeholder="${spotHint(spotKind)}" required maxlength="120" aria-label="${T.placeName}">
        <input name="memo" placeholder="${T.memo}" maxlength="2000" aria-label="${T.memo}">
        ${stars(0, true)}
        <div class="tg-actions"><button class="btn btn-ghost" type="button" data-act="cancel">${T.cancel}</button><button class="btn btn-solid">${T.save}</button></div>
      </form>`;
    if (picked) return spotCard(picked);
    return `<div class="tg-sheet">
          <div class="tg-share">
            <div><b>${loc.on ? T.sharing : T.share}</b><p class="tg-hint">${esc(status)}</p></div>
            <button class="tg-switch ${loc.on ? 'on' : ''}" type="button" role="switch" aria-checked="${loc.on}" aria-label="${T.share}" data-act="share"><i></i></button>
          </div>
          <p class="tg-hint tg-tap">📍 ${T.tapMap}</p>
        </div>`;
  }
  /** 목록 — 위치를 알면 가까운 순, 위치 없이 적은 것은 뒤로. 줄을 누르면 지도에서 그 핀으로 */
  function placesList() {
    const mine = data.location?.me;
    const list = shown().map((i) => ({ i, d: mine && i.lat != null ? km(mine, i) : null }))
      .sort((x, y) => (x.i.lat == null) - (y.i.lat == null) || (mine ? (x.d ?? 0) - (y.d ?? 0) : String(y.i.createdAt).localeCompare(String(x.i.createdAt))));
    return `<form class="tg-card tg-log-add" data-form="item" data-kind="${spotKind}">${kindPick()}
        <input name="title" placeholder="${spotHint(spotKind)}" required maxlength="120" aria-label="${T.title_}">
        <input name="memo" placeholder="${T.memo}" maxlength="2000" aria-label="${T.memo}">
        <div class="tg-two">${stars(0, true)}<button class="btn btn-solid">${T.add}</button></div>
      </form>
      <button class="tg-cta" type="button" data-act="here">${icon('locate')}<span>${T.saveHere}</span></button>
      ${list.length ? `<h3 class="tg-sub">${mine ? T.nearFirst : T.newFirst}</h3>
        <ul class="tg-list">${list.map(({ i, d }) => editing === i.id ? editRow(i) : `<li class="tg-place">
          ${pinOf(i.kind, 'mini')}
          <span class="tg-text" role="button" tabindex="0" ${i.lat != null ? `data-fly="${i.id}"` : `data-edit="${i.id}"`} aria-label="${T.showOnMap}"><b>${esc(i.title)}</b>${i.memo ? `<small>${esc(i.memo)}</small>` : ''}
            <small class="tg-place-meta">${d != null ? `${dist(d)} · ` : ''}${fmtDay(String(i.createdAt).slice(0, 10))}</small>${stars(i.rating, false, i.id)}</span>
          ${i.lat == null ? `<button class="tg-icon-btn" type="button" data-pin="${i.id}" aria-label="${T.pinIt}">${icon('map')}</button>` : editBtn(i.id)}${delBtn(i.id)}</li>`).join('')}</ul>` : empty('map', T.placesEmpty)}`;
  }
  let markers = [];
  const mp = pane('map');
  /** 저장한 곳은 위에, 찾은 곳은 아래에. 찾은 곳을 누르면 그 자리에 새 핀과 이름까지 채운 칸이 열립니다 */
  function paintResults() {
    const box = $('.tg-results', mp);
    if (!box) return;
    box.hidden = !found;
    if (!found) { box.innerHTML = ''; return; }
    const { saved, places } = found;
    const row = (attr, kind, name, sub) => `<button type="button" class="tg-result" ${attr}>${pinOf(kind, 'mini')}<span><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
    box.innerHTML = saved.map((i) => row(`data-fly="${i.id}"`, i.kind, i.title, kindName(i.kind))).join('')
      + places.map((p, n) => row(`data-found="${n}"`, p.kind, p.name, p.address)).join('')
      + (saved.length || places.length ? '' : `<p class="tg-hint tg-result-none">${T.searchEmpty}</p>`);
    box.querySelectorAll('[data-fly]').forEach((b) => { b.onclick = () => { found = null; paintResults(); showPlace(b.dataset.fly); }; });
    box.querySelectorAll('[data-found]').forEach((b) => {
      b.onclick = () => {
        const p = places[Number(b.dataset.found)];
        found = null; selected = null; pinning = null;
        pending = { lat: p.lat, lng: p.lng };
        spotKind = p.kind;
        paintResults();
        map?.jumpTo({ center: [p.lng, p.lat], zoom: 16, offset: [0, -60] });
        drawMarkers();
        paintCard();
        $('input[name="title"]', mp).value = p.name;
        $('input[name="memo"]', mp).value = p.address;
      };
    });
  }
  async function findPlaces(q) {
    const word = q.trim().toLowerCase();
    if (!word) { found = null; return paintResults(); }
    const saved = spots().filter((i) => i.title.toLowerCase().includes(word) && i.lat != null).slice(0, 3);
    const center = map?.getCenter();
    const query = `?search=${encodeURIComponent(q.trim())}${center ? `&near=${center.lat},${center.lng}` : ''}`;
    try {
      const r = await fetch('/api/together' + query, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(r.status);
      found = { saved, places: (await r.json()).places };
    } catch {
      say(T.searchFailed);
      found = { saved, places: [] };
    }
    paintResults();
  }
  function paintCard() {
    const card = $('.tg-mapcard', mp);
    if (!card) return;
    card.innerHTML = mapCard();
    wire(card);
    wireMap();
  }
  async function renderMap() {
    if (!$('#tg-map', mp)) {
      mp.innerHTML = `<div class="tg-seg tg-mapseg"><button type="button" data-mode="map"></button><button type="button" data-mode="list"></button></div>
        <div class="tg-chips"></div>
        <div class="tg-mapwrap"><div id="tg-map" class="tg-map"></div>
        <form class="tg-search" role="search"><input name="q" type="search" enterkeyhint="search" maxlength="80" autocomplete="off" placeholder="${T.searchPlace}" aria-label="${T.searchPlace}"><button aria-label="${T.searchPlace}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></button></form>
        <div class="tg-results" hidden></div>
        <button class="tg-fab" type="button" data-act="locate" aria-label="${T.locate}">${icon('locate')}</button>
        <div class="tg-mapcard"></div></div>
        <div class="tg-places"></div>`;
      fitted = false;
    }
    // [지도 | 목록 n] — 지도는 숨겨만 두고 살려 둡니다 (다시 볼 때 새로 불러오지 않게)
    mp.querySelectorAll('[data-mode]').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === mapMode);
      b.innerHTML = b.dataset.mode === 'map' ? T.map : `${T.viewList} <span class="tg-count">${spots().length}</span>`;
    });
    // 전체·장소·맛집·문화 — 지도와 목록이 같이 걸러집니다
    $('.tg-chips', mp).innerHTML = ['all', ...SPOTS].map((k) => {
      const n = k === 'all' ? spots().length : items(k).length;
      return `<button type="button" class="tg-chip ${filter === k ? 'on' : ''}" data-filter="${k}">${k === 'all' ? T.all : `${icon(SPOT_ICON[k])}${kindName(k)}`} <span class="tg-count">${n}</span></button>`;
    }).join('');
    $('.tg-mapwrap', mp).hidden = mapMode !== 'map';
    const list = $('.tg-places', mp);
    list.hidden = mapMode !== 'list';
    const html = mapMode === 'list' ? placesList() : '';
    if (list.dataset.html !== html) { list.dataset.html = html; list.innerHTML = html; wire(list); }
    paintCard();
    if (mapMode === 'list') return;
    try { await loadMap(); } catch { say(T.error); return; }
    const el = $('#tg-map', mp);
    if (!el || root.hidden || mapMode !== 'map') return;
    if (!map || map.getContainer() !== el) {
      if (map) map.remove();
      const night = document.documentElement.dataset.theme === 'night';
      map = new maplibregl.Map({
        container: el,
        style: `https://tiles.openfreemap.org/styles/${night ? 'dark' : 'positron'}`,
        center: [126.978, 37.5665], zoom: 11,
        attributionControl: false,
        dragRotate: false, pitchWithRotate: false,
        localIdeographFontFamily: "'Pretendard Variable', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", // 한글은 앱 글꼴로
      });
      map.touchZoomRotate.disableRotation();
      // 출처 표기는 왼쪽 위에 접힌 (i) 로 — 오른쪽 위 '내 위치로' 단추를 가리지 않게
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-left');
      map.once('load', () => el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
      map.on('style.load', () => { paint(); relabel(); });
      map.on('click', (e) => {
        if (e.originalEvent.target.closest('.tg-marker')) return;
        const spot = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        if (pinning) { const id = pinning; patch(id, spot, () => { pinning = null; selected = id; }); return; }
        if (selected) { selected = null; drawMarkers(); paintCard(); return; } // 빈 곳을 누르면 카드만 닫습니다
        pending = spot;
        drawMarkers();
        paintCard();
        $('.tg-sheet input[name="title"]', mp)?.focus();
      });
    }
    drawMarkers();
    if (!fitted) {
      fitted = true;
      const pts = markers.map((m) => m.getLngLat());
      if (pts.length > 1) {
        const b = pts.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
        map.fitBounds(b, { padding: { top: 70, bottom: 190, left: 50, right: 50 }, maxZoom: 15, duration: 0 });
      } else if (pts.length === 1) map.jumpTo({ center: pts[0], zoom: 14 });
    }
    map.resize();
  }
  /** 목록에서 고른 장소를 지도에서 — 그 핀의 카드까지 열어 둡니다 */
  async function showPlace(id) {
    const p = data.items.find((i) => i.id === id);
    if (p?.lat == null) return;
    mapMode = 'map'; editing = null; fitted = true; selected = id;
    await renderMap();
    map?.jumpTo({ center: [p.lng, p.lat], zoom: 16 });
  }
  /** 길찾기 — 한국어 화면은 카카오맵, 그 밖은 구글 지도 (앱이 깔려 있으면 앱으로 열립니다) */
  const route = (p) => (locale().startsWith('ko')
    ? `https://map.kakao.com/link/to/${encodeURIComponent(String(p.title).replace(/,/g, ' '))},${p.lat},${p.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`);
  function drawMarkers() {
    if (!map) return;
    markers.forEach((m) => m.remove());
    markers = [];
    const add = (html, lat, lng, anchor, popup) => {
      const el = document.createElement('div');
      el.className = 'tg-marker';
      el.innerHTML = html;
      const m = new maplibregl.Marker({ element: el, anchor }).setLngLat([lng, lat]);
      if (popup) m.setPopup(new maplibregl.Popup({ offset: anchor === 'bottom' ? 38 : 26, closeButton: false, className: 'tg-popup' }).setHTML(popup));
      m.addTo(map);
      markers.push(m);
      return el;
    };
    shown().filter((i) => i.lat != null).forEach((i) => {
      const el = add(pinOf(i.kind, selected === i.id ? 'on' : ''), i.lat, i.lng, 'bottom');
      el.onclick = () => {
        selected = i.id; pending = null;
        drawMarkers();
        paintCard();
        map.easeTo({ center: [i.lng, i.lat], offset: [0, -70], duration: 350 });
      };
    });
    if (pending) add(`<span class="tg-pin fresh"><svg viewBox="0 0 24 24">${P.plus}</svg></span>`, pending.lat, pending.lng, 'bottom');
    const loc = data.location;
    const face = (slot) => `<span class="tg-face ${slot}"><b>${initial(slot)}</b></span>`;
    if (loc.them) add(face(other()), loc.them.lat, loc.them.lng, 'center', `<b>${esc(nameFor(other()))}</b><br>${esc(ago(loc.them.at))}`);
    if (loc.me) add(face(me()), loc.me.lat, loc.me.lng, 'center', `<b>${esc(nameFor(me()))}</b>`);
  }
  function wireMap() {
    const card = $('.tg-mapcard', mp);
    const share = $('[data-act="share"]', card);
    if (share) share.onclick = () => toggleShare(share);
    const search = $('.tg-search', mp);
    if (search) {
      search.onsubmit = (ev) => { ev.preventDefault(); const input = $('input', search); input.blur(); findPlaces(input.value); };
      $('input', search).oninput = (ev) => { if (!ev.target.value) { found = null; paintResults(); } };
    }
    const repaint = () => { editing = null; pending = null; selected = null; pinning = null; renderMap(); };
    mp.querySelectorAll('[data-mode]').forEach((b) => {
      b.onclick = () => { if (mapMode === b.dataset.mode) return; mapMode = b.dataset.mode; repaint(); };
    });
    mp.querySelectorAll('[data-filter]').forEach((b) => {
      b.onclick = () => { filter = b.dataset.filter; repaint(); };
    });
    mp.querySelectorAll('[data-fly]').forEach((c) => {
      c.onclick = () => showPlace(c.dataset.fly);
      c.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); showPlace(c.dataset.fly); } };
    });
    // 위치 없이 적어 둔 것: 지도로 가서 누른 자리에 꽂습니다
    mp.querySelectorAll('[data-pin]').forEach((b) => {
      b.onclick = () => { pinning = b.dataset.pin; pending = null; selected = null; mapMode = 'map'; renderMap(); };
    });
    mp.querySelectorAll('[data-editspot]').forEach((b) => {
      b.onclick = () => { editing = b.dataset.editspot; selected = null; mapMode = 'list'; filter = 'all'; renderMap().then(() => $('.tg-edit input', mp)?.focus()); };
    });
    const unselect = $('[data-act="unselect"]', card);
    if (unselect) unselect.onclick = () => { selected = null; drawMarkers(); paintCard(); };
    // 지금 있는 곳 저장: 내 자리에 새 핀을 꽂고 이름 칸을 엽니다
    const here = $('[data-act="here"]', mp);
    if (here) {
      here.onclick = () => {
        if (!navigator.geolocation) return say(T.denied);
        navigator.geolocation.getCurrentPosition(async (p) => {
          pending = { lat: p.coords.latitude, lng: p.coords.longitude };
          mapMode = 'map'; fitted = true;
          await renderMap();
          map?.jumpTo({ center: [pending.lng, pending.lat], zoom: 16 });
          $('.tg-sheet input[name="title"]', mp)?.focus();
        }, () => say(T.denied), { timeout: 20000, maximumAge: 60000 });
      };
    }
    const cancel = $('[data-act="cancel"]', card);
    if (cancel) cancel.onclick = () => { pending = null; pinning = null; drawMarkers(); paintCard(); };
    const form = $('form[data-form="place"]', card);
    if (form) {
      form.onsubmit = (ev) => {
        ev.preventDefault();
        if (busy) return;
        const v = Object.fromEntries(new FormData(form));
        item({ kind: form.dataset.kind, title: v.title, memo: v.memo || '', rating: v.rating ? Number(v.rating) : undefined, lat: pending.lat, lng: pending.lng }, () => { pending = null; });
      };
    }
    const locate = $('[data-act="locate"]', mp);
    if (locate) {
      locate.onclick = () => {
        const mine = data.location.me;
        if (mine && map) return map.flyTo({ center: [mine.lng, mine.lat], zoom: 15, duration: 700 });
        if (!navigator.geolocation) return say(T.denied);
        navigator.geolocation.getCurrentPosition((p) => map && map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15, duration: 700 }),
          () => say(T.denied), { timeout: 20000 });
      };
    }
  }
  refresh(); // 맨 끝에서 — 인트로 없이 들어오면 앱이 이미 보이는 채로 이 파일이 돕니다
})();
