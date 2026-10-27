/* "우리" 탭 (10/27) — api/together.js 의 화면. app.js 와 따로 둡니다 (app.js 가 3,000줄이 넘어서).
   오늘(질문·콕·1년 전 오늘·지난 질문) · 일기(사진·앨범) · 버킷 · 가계부(월별) · 기록(맛집·문화, 별점) · 지도(장소·서로 위치).
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
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[k]}</svg>`;
  const TABS = ['today', 'diary', 'bucket', 'ledger', 'log', 'map'];

  let data = null, tab = 'today', busy = false;
  let composing = false, editing = null, armed = null, armTimer = 0, preview = null;
  let month = null, logKind = 'food', pending = null;
  let map = null, watch = null, lastSent = 0, fitted = false;

  /* ── 서버 ── */
  async function call(method, body, query = '') {
    const r = await fetch('/api/together' + query, {
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
      <div class="tg-body"></div>
      <div class="tg-lightbox" hidden><img alt=""></div>
    </div>`;
  document.body.appendChild(root);
  const body = $('.tg-body', root);
  root.querySelectorAll('.tg-nav button').forEach((b) => {
    b.onclick = () => {
      if (tab === b.dataset.tab) return;
      tab = b.dataset.tab; composing = false; editing = null; pending = null;
      render();
      body.scrollTop = 0;
    };
  });
  const box = $('.tg-lightbox', root);
  box.onclick = () => { box.hidden = true; };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || root.hidden) return;
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

  /* 달력 화면의 "오늘의 질문" 카드 — 무엇을 하면 되는지 한눈에. 누르면 우리 탭의 오늘로 */
  const teaser = document.createElement('button');
  teaser.type = 'button';
  teaser.className = 'home-us';
  teaser.hidden = true;
  const upcoming = $('.upcoming');
  if (upcoming) upcoming.prepend(teaser);
  teaser.onclick = () => open('today');

  function paintEntry() {
    goCal.lastElementChild.textContent = T.navCalendar;
    goUs.querySelector('span').textContent = T.navUs;
    $('span', coach).textContent = T.coach;
    $('.app-coach-x', coach).setAttribute('aria-label', T.close);
    coach.hidden = seen() || !root.hidden;
    if (!data) { teaser.hidden = true; return; }
    const q = data.question;
    const other = me() === 'a' ? 'b' : 'a';
    const waiting = q.mine === null && q.theyAnswered; // 상대가 답해 두고 내 답을 기다리는 중
    goUs.querySelector('.app-nav-dot').hidden = !waiting;
    const status = q.mine === null
      ? (q.theyAnswered ? tr('statusTheirs', { name: nameFor(other) }) : T.statusNone)
      : (q.theirs !== null ? T.statusBoth : tr('statusMine', { name: nameFor(other) }));
    teaser.hidden = false;
    teaser.classList.toggle('waiting', waiting);
    teaser.innerHTML = `<span class="home-us-top"><span class="tg-kicker">${T.question}</span>${waiting ? '<i class="home-us-dot"></i>' : ''}</span>
      <b class="home-us-q">${esc(q.text)}</b>
      <span class="home-us-foot"><span>${esc(status)}</span><span class="home-us-go">${q.mine === null ? T.goAnswer : T.goSee} ›</span></span>`;
  }

  /* 달력이 보일 때 한 번, 다시 앞으로 왔을 때 1분에 한 번까지만 읽습니다 (Neon 깨우는 횟수 아끼기) */
  let lastLoad = 0;
  async function refresh(force = false) {
    if (!appMain || appMain.hidden) return;
    if (!force && Date.now() - lastLoad < 60000) return paintEntry();
    lastLoad = Date.now();
    try { await call('GET'); } catch { /* 첫 화면 카드만 못 그릴 뿐 */ }
    paintEntry();
  }
  // 로그아웃하면(#app 이 숨으면) 우리 탭도 닫습니다
  if (appMain) new MutationObserver(() => (appMain.hidden ? close() : refresh())).observe(appMain, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  refresh();

  async function open(to) {
    if (to) { tab = to; composing = false; editing = null; pending = null; }
    root.hidden = false;
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
  }
  function close() {
    root.hidden = true;
    document.documentElement.classList.remove('tg-open');
    goUs.classList.remove('on');
    goCal.classList.add('on');
    stopWatch();
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
    if (tab === 'map') return renderMap();
    if (map) { map.remove(); map = null; }
    const views = { today: todayView, diary: diaryView, bucket: bucketView, ledger: ledgerView, log: logView };
    body.innerHTML = `<p class="tg-lead">${T['lead' + tab[0].toUpperCase() + tab.slice(1)]}</p>` + views[tab]();
    wire();
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
  const fmtDay = (d, opts = { month: 'short', day: 'numeric' }) => {
    if (!d) return '';
    const [y, m, n] = d.split('-').map(Number);
    return new Intl.DateTimeFormat(locale(), { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, n)));
  };
  const money = (n) => new Intl.NumberFormat(locale()).format(n || 0);
  const delBtn = (id) => `<button class="tg-icon-btn ${armed === id ? 'armed' : ''}" type="button" data-del="${id}" aria-label="${armed === id ? T.confirmDel : T.del}">${armed === id ? `<span>${T.confirmDel}</span>` : icon('trash')}</button>`;
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
        ${i.photoId ? `<img class="tg-entry-photo" src="${photoUrl(i.photoId)}" alt="" loading="lazy" data-zoom>` : ''}
        <div class="tg-entry-body">
          <div class="tg-entry-meta">${who(i.member)}<span>${fmtDay(i.day, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
            <span class="tg-grow"></span>${editBtn(i.id)}${delBtn(i.id)}</div>
          ${i.title ? `<h4>${esc(i.title)}</h4>` : ''}${i.memo ? `<p>${esc(i.memo)}</p>` : ''}
        </div>
      </article>`).join('');
    return `${composing ? diaryForm() : `<button class="tg-cta" type="button" data-act="compose">${icon('plus')}<span>${T.writeDiary}</span></button>`}
      ${album.length ? `<section class="tg-section"><h3>${T.album} <span class="tg-count">${album.length}</span></h3>
        <div class="tg-album">${album.map((i) => `<img src="${photoUrl(i.photoId)}" alt="" loading="lazy" data-zoom>`).join('')}</div></section>` : ''}
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
        <label><input type="checkbox" data-done="${i.id}" ${i.done ? 'checked' : ''}><span class="tg-box"></span>
          <span class="tg-text"><b>${esc(i.title)}</b>${i.memo ? `<small>${esc(i.memo)}</small>` : ''}</span></label>
        ${who(i.member)}${editBtn(i.id)}${delBtn(i.id)}</li>`;
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
        ${i.kind === 'food' || i.kind === 'culture' ? stars(i.rating, true) : ''}
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
    const title = new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
    const groups = {};
    list.forEach((i) => { (groups[i.day || ''] ||= []).push(i); });
    return `<article class="tg-card tg-month">
        <div class="tg-month-nav"><button class="icon-btn" type="button" data-month="-1" aria-label="${T.prev}">${icon('back')}</button>
          <b>${title}</b><button class="icon-btn" type="button" data-month="1" aria-label="${T.next}">${icon('next')}</button></div>
        <p class="tg-total">${money(sum)}</p>
        ${sum ? `<div class="tg-split"><i class="a" style="width:${pa}%"></i><i class="b" style="width:${100 - pa}%"></i></div>
          <div class="tg-legend"><span>${who('a')}${esc(nameFor('a'))} ${money(by.a)}</span><span>${who('b')}${esc(nameFor('b'))} ${money(by.b)}</span></div>` : ''}
      </article>
      <form class="tg-card tg-ledger-add" data-form="item" data-kind="ledger">
        <input name="title" placeholder="${T.ledgerPlaceholder}" required maxlength="120" aria-label="${T.title_}">
        <div class="tg-two"><input name="amount" type="number" inputmode="numeric" min="0" placeholder="${T.amount}" required aria-label="${T.amount}">
          <input name="day" type="date" value="${month === data.question.day.slice(0, 7) ? data.question.day : `${month}-01`}" aria-label="${T.day}"></div>
        <button class="btn btn-solid">${T.add}</button>
      </form>
      ${list.length ? Object.keys(groups).sort().reverse().map((d) => `<section class="tg-section"><h3 class="tg-sub">${fmtDay(d, { month: 'long', day: 'numeric', weekday: 'short' })}</h3>
        <ul class="tg-list">${groups[d].map((i) => editing === i.id ? editRow(i) : `<li class="tg-money">${who(i.member)}
          <span class="tg-text"><b>${esc(i.title)}</b>${i.memo ? `<small>${esc(i.memo)}</small>` : ''}</span>
          <b class="tg-amount">${money(i.amount)}</b>${editBtn(i.id)}${delBtn(i.id)}</li>`).join('')}</ul></section>`).join('') : empty('ledger', T.ledgerEmpty)}`;
  }

  /* 기록: 맛집 · 문화 */
  const stars = (n, input = false) => `<span class="tg-stars ${input ? 'input' : ''}" ${input ? `role="radiogroup" aria-label="${T.rate}"` : `aria-label="${n || 0}/5"`}>${[1, 2, 3, 4, 5].map((s) => input
    ? `<label><input type="radio" name="rating" value="${s}" ${n === s ? 'checked' : ''}><i class="${s <= (n || 0) ? 'on' : ''}">★</i></label>`
    : `<i class="${s <= (n || 0) ? 'on' : ''}">★</i>`).join('')}</span>`;
  function logView() {
    const list = items(logKind);
    return `<div class="tg-seg">${['food', 'culture'].map((k) => `<button type="button" data-kind="${k}" class="${logKind === k ? 'on' : ''}">${T[k]} <span class="tg-count">${items(k).length}</span></button>`).join('')}</div>
      <form class="tg-card tg-log-add" data-form="item" data-kind="${logKind}">
        <input name="title" placeholder="${logKind === 'food' ? T.foodPlaceholder : T.culturePlaceholder}" required maxlength="120" aria-label="${T.title_}">
        <input name="memo" placeholder="${T.memo}" maxlength="2000" aria-label="${T.memo}">
        <div class="tg-two">${stars(0, true)}<button class="btn btn-solid">${T.add}</button></div>
      </form>
      ${list.length ? `<ul class="tg-list">${list.map((i) => editing === i.id ? editRow(i) : `<li class="tg-log">
        <span class="tg-text"><b>${esc(i.title)}</b>${stars(i.rating)}${i.memo ? `<small>${esc(i.memo)}</small>` : ''}</span>
        ${who(i.member)}${editBtn(i.id)}${delBtn(i.id)}</li>`).join('')}</ul>` : empty('log', T.logEmpty)}`;
  }

  /* ── 동작 ── */
  function wire() {
    body.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => {
        // 한 번 더 눌러야 지웁니다 — 3초 안에
        if (armed !== b.dataset.del) { armed = b.dataset.del; clearTimeout(armTimer); armTimer = setTimeout(() => { armed = null; render(); }, 3000); render(); return; }
        armed = null; clearTimeout(armTimer);
        remove(b.dataset.del);
      };
    });
    body.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => { editing = b.dataset.edit; composing = false; preview = null; render(); }; });
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
    body.querySelectorAll('.tg-seg button').forEach((b) => { b.onclick = () => { logKind = b.dataset.kind; editing = null; render(); }; });
    body.querySelectorAll('.tg-stars.input input').forEach((r) => {
      r.onchange = () => r.closest('.tg-stars').querySelectorAll('i').forEach((i, n) => i.classList.toggle('on', n < Number(r.value)));
    });
    const act = (name, fn) => body.querySelectorAll(`[data-act="${name}"]`).forEach((b) => { b.onclick = fn; });
    act('compose', () => { composing = true; editing = null; preview = null; render(); $('textarea', body)?.focus(); });
    act('cancel', () => { composing = false; editing = null; preview = null; pending = null; render(); });
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
    if (document.documentElement.dataset.theme === 'night') return;
    const set = (id, prop, value) => { if (map.getLayer(id)) map.setPaintProperty(id, prop, value); };
    set('background', 'background-color', cssVar('--paper') || '#FBF3F4');
    set('water', 'fill-color', '#CFE3EE');
    set('waterway', 'line-color', '#BFD8E6');
    set('park', 'fill-color', cssVar('--wash-both') || '#E9F2E6');
    set('landcover_wood', 'fill-color', '#DDEBD6');
    set('landuse_residential', 'fill-color', cssVar('--paper-2') || '#FDF7F7');
    set('building', 'fill-color', cssVar('--surface-sink') || '#FBF1F1');
    for (const id of ['highway_minor', 'highway_path']) set(id, 'line-color', '#FFFFFF');
    for (const id of ['highway_major_inner', 'highway_motorway_inner']) set(id, 'line-color', '#FFFDF8');
    for (const id of ['highway_major_casing', 'highway_motorway_casing']) set(id, 'line-color', cssVar('--line-2') || '#EBD9DC');
    // 철도 점선은 흐리게 — 장소 핀보다 눈에 띄지 않게
    for (const id of ['railway', 'railway_dashline', 'railway_transit', 'railway_transit_dashline', 'railway_service', 'railway_service_dashline']) set(id, 'line-opacity', 0.35);
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

  function mapCard() {
    const loc = data.location;
    const places = items('place');
    let status = T.shareNote;
    if (loc.on && loc.them) {
      const d = km(loc.me, loc.them);
      status = tr('distance', { km: d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(d < 10 ? 1 : 0)}km` }) + ' · ' + tr('updated', { time: ago(loc.them.at) });
    } else if (loc.on) status = T.theyOff;
    return `
      ${pending ? `<form class="tg-sheet" data-form="place">
          <b>${T.addPlace}</b>
          <input name="title" placeholder="${T.placeName}" required maxlength="120" aria-label="${T.placeName}">
          <input name="memo" placeholder="${T.memo}" maxlength="2000" aria-label="${T.memo}">
          <div class="tg-actions"><button class="btn btn-ghost" type="button" data-act="cancel">${T.cancel}</button><button class="btn btn-solid">${T.save}</button></div>
        </form>` : `<div class="tg-sheet">
          <div class="tg-share">
            <div><b>${loc.on ? T.sharing : T.share}</b><p class="tg-hint">${esc(status)}</p></div>
            <button class="tg-switch ${loc.on ? 'on' : ''}" type="button" role="switch" aria-checked="${loc.on}" aria-label="${T.share}" data-act="share"><i></i></button>
          </div>
          ${places.length ? `<div class="tg-chips">${places.map((p) => `<button type="button" class="tg-chip" data-fly="${p.id}"><i class="tg-who ${p.member === 'b' ? 'b' : 'a'}"></i>${esc(p.title)}</button>`).join('')}</div>` : ''}
          <p class="tg-hint tg-tap">📍 ${T.tapMap}</p>
        </div>`}`;
  }
  let markers = [];
  async function renderMap() {
    if (!$('#tg-map', body)) {
      body.innerHTML = `<div class="tg-mapwrap"><div id="tg-map" class="tg-map"></div>
        <button class="tg-fab" type="button" data-act="locate" aria-label="${T.locate}">${icon('locate')}</button>
        <div class="tg-mapcard"></div></div>`;
      fitted = false;
    }
    $('.tg-mapcard', body).innerHTML = mapCard();
    wireMap();
    try { await loadMap(); } catch { say(T.error); return; }
    const el = $('#tg-map', body);
    if (!el || root.hidden || tab !== 'map') return;
    if (!map || map.getContainer() !== el) {
      if (map) map.remove();
      const night = document.documentElement.dataset.theme === 'night';
      map = new maplibregl.Map({
        container: el,
        style: `https://tiles.openfreemap.org/styles/${night ? 'dark' : 'positron'}`,
        center: [126.978, 37.5665], zoom: 11,
        attributionControl: false,
        dragRotate: false, pitchWithRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      // 출처 표기는 왼쪽 위에 접힌 (i) 로 — 오른쪽 위 '내 위치로' 단추를 가리지 않게
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-left');
      map.once('load', () => el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
      map.on('style.load', () => { paint(); relabel(); });
      map.on('click', (e) => {
        if (e.originalEvent.target.closest('.tg-marker')) return;
        pending = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        drawMarkers();
        $('.tg-mapcard', body).innerHTML = mapCard();
        wireMap();
        $('.tg-sheet input', body)?.focus();
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
    setTimeout(() => map && map.resize(), 60);
  }
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
    };
    items('place').filter((i) => i.lat != null).forEach((i) => {
      add(`<span class="tg-pin ${i.member === 'b' ? 'b' : 'a'}"><svg viewBox="0 0 24 24">${P.today}</svg></span>`, i.lat, i.lng, 'bottom',
        `<b>${esc(i.title)}</b>${i.memo ? `<br>${esc(i.memo)}` : ''}`);
    });
    if (pending) add(`<span class="tg-pin new"><svg viewBox="0 0 24 24">${P.plus}</svg></span>`, pending.lat, pending.lng, 'bottom');
    const loc = data.location;
    const face = (slot) => `<span class="tg-face ${slot}"><b>${initial(slot)}</b></span>`;
    if (loc.them) add(face(other()), loc.them.lat, loc.them.lng, 'center', `<b>${esc(nameFor(other()))}</b><br>${esc(ago(loc.them.at))}`);
    if (loc.me) add(face(me()), loc.me.lat, loc.me.lng, 'center', `<b>${esc(nameFor(me()))}</b>`);
  }
  function wireMap() {
    const card = $('.tg-mapcard', body);
    const share = $('[data-act="share"]', card);
    if (share) {
      share.onclick = () => {
        if (data.location.on) return save(call('POST', { action: 'location', on: false }), () => stopWatch());
        if (!navigator.geolocation) return say(T.denied);
        // 켜는 순간 한 번 바로 올리고, 그 뒤로는 화면이 열려 있는 동안 1분에 한 번
        share.classList.add('on');
        navigator.geolocation.getCurrentPosition((p) => {
          lastSent = Date.now();
          save(call('POST', { action: 'location', on: true, lat: p.coords.latitude, lng: p.coords.longitude }), () => { fitted = false; startWatch(); });
        }, () => { share.classList.remove('on'); say(T.denied); }, { timeout: 20000, maximumAge: 60000 });
      };
    }
    card.querySelectorAll('[data-fly]').forEach((c) => {
      c.onclick = () => {
        const p = data.items.find((i) => i.id === c.dataset.fly);
        if (!map || p?.lat == null) return;
        map.flyTo({ center: [p.lng, p.lat], zoom: 16, duration: 700 });
        markers.find((m) => { const l = m.getLngLat(); return Math.abs(l.lat - p.lat) < 1e-9 && Math.abs(l.lng - p.lng) < 1e-9; })?.togglePopup();
      };
    });
    const cancel = $('[data-act="cancel"]', card);
    if (cancel) cancel.onclick = () => { pending = null; drawMarkers(); card.innerHTML = mapCard(); wireMap(); };
    const form = $('form[data-form="place"]', card);
    if (form) {
      form.onsubmit = (ev) => {
        ev.preventDefault();
        if (busy) return;
        const v = Object.fromEntries(new FormData(form));
        item({ kind: 'place', title: v.title, memo: v.memo || '', lat: pending.lat, lng: pending.lng }, () => { pending = null; });
      };
    }
    const locate = $('[data-act="locate"]', body);
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
})();
