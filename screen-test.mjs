/**
 * Tests for the screen itself (public/app.js).
 *
 *   npm test
 *
 * The handler tests never load app.js, so a typo in it once shipped with every
 * test green: the + button threw before the editor could open, and nobody
 * could add an event. This loads the real scripts in the order index.html does
 * and presses the things people press first.
 *
 * Like i18n-test.mjs it stubs the browser rather than pulling in a headless
 * one. Elements are made on demand by id, so the stub only has to be as smart
 * as the code paths below need. It cannot tell whether things look right —
 * that still needs a real browser.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* ── 아주 작은 가짜 DOM ── */
class Text {
  constructor(data) { this.textContent = String(data); }
}

class El {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = { setProperty(k, v) { this[k] = String(v); } };
    this.attrs = {};
    this.listeners = {};
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.open = false;
    this.innerHTML = '';
    this.parentElement = null;
    this.offsetTop = this.offsetHeight = this.offsetWidth = this.clientHeight = this.scrollTop = 0;
    this.own = '';
    const names = new Set();
    Object.defineProperty(this, 'className', {
      get: () => [...names].join(' '),
      set: (v) => { names.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => names.add(x)); },
    });
    this.classList = {
      add: (...c) => c.forEach((x) => names.add(x)),
      remove: (...c) => c.forEach((x) => names.delete(x)),
      toggle: (c, on = !names.has(c)) => { on ? names.add(c) : names.delete(c); return on; },
      contains: (c) => names.has(c),
    };
  }

  get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join('') : this.own; }
  set textContent(v) { this.children = []; this.own = String(v); }

  append(...nodes) {
    for (const n of nodes) {
      const node = typeof n === 'string' ? new Text(n) : n;
      if (node.fragment) { node.children.forEach((c) => this.append(c)); node.children = []; continue; }
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.children = []; this.own = ''; this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
  dispatchEvent(event) {
    event.target ??= this;
    event.preventDefault ??= () => {};
    event.stopPropagation ??= () => {};
    (this.listeners[event.type] || []).forEach((fn) => fn(event));
    this['on' + event.type]?.(event);
    return true;
  }
  click() { this.dispatchEvent({ type: 'click' }); }
  showModal() { this.open = true; }
  close() { if (!this.open) return; this.open = false; this.dispatchEvent({ type: 'close' }); }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  closest() { return null; }
  cloneNode() { return new El(this.tagName); }
  getBoundingClientRect() { return { width: 400, height: 0, top: 0, left: 0 }; }
  focus() {}
  select() {}
  scrollIntoView() {}
  scrollTo() {}
  setPointerCapture() {}
}

const byId = new Map();
const bySelector = new Map();
const document = new El('html');
Object.assign(document, {
  documentElement: new El('html'),
  hidden: false,
  title: '',
  getElementById: (id) => {
    if (!byId.has(id)) { const el = new El(); el.id = id; byId.set(id, el); }
    return byId.get(id);
  },
  querySelector: (selector) => {
    if (!bySelector.has(selector)) bySelector.set(selector, new El());
    return bySelector.get(selector);
  },
  createElement: (tag) => new El(tag),
  createTextNode: (data) => new Text(data),
  createDocumentFragment: () => Object.assign(new El(), { fragment: true }),
});

const store = new Map();
const fetches = [];
const winListeners = {};

Object.assign(globalThis, {
  window: globalThis,
  document,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  addEventListener: (type, fn) => { (winListeners[type] ||= []).push(fn); },
  location: { origin: 'https://diary.test' },
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  requestAnimationFrame: () => 0,
  setInterval: () => 0,   // 2분마다 맞추는 타이머가 테스트를 붙잡지 않게
  fetch: async (url, init = {}) => {
    fetches.push({ url, method: init.method, body: init.body, headers: init.headers || {} });
    const body = init.body ? JSON.parse(init.body) : {};
    // 로그인한 뒤 달력을 받아오는 자리 — 계정이 누구인지(me)와 상대가 들어왔는지(paired)를 같이 줍니다
    const reply = url === '/api/state'
      ? { events: [], photos: [], settings: globalThis.__settings || {}, me: { slot: 'b', login: 'we' }, paired: false }
      : body;
    return { ok: true, status: 200, json: async () => reply };
  },
});
// Node 24 ships its own navigator, and it is read-only.
Object.defineProperty(globalThis, 'navigator', {
  value: { languages: ['ko-KR', 'ko'], language: 'ko-KR', userAgent: 'test' }, configurable: true,
});

/* 로그인이 없던 한 쌍용 판을 이 브라우저로 본 적이 있습니다 — 그때 적힌 제목이 남아 있어요 */
store.set('diary_title', '예전 달력 이름');
store.set('diary_sub', '예전 부제');

/* index.html과 같은 순서로, 같은 전역에 싣습니다 */
const scripts = [...readFileSync('public/index.html', 'utf8').matchAll(/<script src="\/([^"]+)"><\/script>/g)]
  .map((m) => m[1]);
for (const file of scripts) {
  vm.runInThisContext(readFileSync(`public/${file}`, 'utf8'), { filename: file });
}
const run = (code) => vm.runInThisContext(code);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let passed = 0;
let failed = 0;
const ok = (what, cond, saw) => {
  if (cond) { passed++; console.log(`PASS  ${what}`); }
  else { failed++; console.log(`FAIL  ${what}  ${JSON.stringify(saw)}`); }
};
const attempt = (code) => {
  try { run(code); return null; } catch (e) { return e.message; }
};

const year = new Date().getFullYear();
ok('a name left from before sign-in does not show on the sign-in screen',
  document.title === run(`t('default.title')`), document.title);
ok('and is not kept for next time', !store.get('diary_title') && !store.get('diary_sub'),
  [store.get('diary_title'), store.get('diary_sub')]);
ok('the screen starts in the browser language', run('i18n.getLocale()') === 'ko', run('i18n.getLocale()'));

/* 일정 쓰기 — + 버튼과 "이 날에 일정 추가"가 부르는 곳 */
let error = attempt(`openEditor(null, '${year}-09-20')`);
ok('the + button opens the editor', !error && $('editor').open, error);
ok('with the date written out', $('f-date-text').textContent.includes('9월 20일'), $('f-date-text').textContent);

/* 날짜 고르기 */
error = attempt(`datePicker.open('f-date')`);
ok('the date picker opens', !error && $('datepick').open, error);
ok('its title does not say the month twice', $('dp-title').textContent === `${year}년 9월`, $('dp-title').textContent);
error = attempt(`datePicker.pick('${year}-09-30')`);
ok('picking a day closes the picker', !error && !$('datepick').open, error);
ok('and puts the day in', $('f-date').value === `${year}-09-30` && $('f-date-text').textContent.includes('9월 30일'),
  [$('f-date').value, $('f-date-text').textContent]);
run(`$('editor').close()`);

/* 달력 머리 */
run(`state.cursor = new Date(${year}, 8, 1); render()`);
ok('the month label does not say the month twice', $('month-label').children[0]?.textContent === '9월',
  $('month-label').children[0]?.textContent);

/* 설정 — 처음 만난 날을 넣은 뒤에도 열려야 합니다 */
run(`state.settings.since = '2025-05-18'`);
error = attempt('openSettings()');
ok('settings open once the day you met is set', !error && $('settings').open, error);
ok('and show that day', $('s-since-text').textContent.includes('2025년 5월 18일'), $('s-since-text').textContent);
run(`$('settings').close()`);
await sleep(20);

/* 언어 — 아무도 안 고른 달력은 처음 연 기기의 언어로 채웁니다 */
fetches.length = 0;
run(`applyState({ events: [], photos: [], settings: { ...state.settings, locale: '' } })`);
await sleep(20);
const savedLocale = () => fetches.filter((f) => f.method === 'PATCH' && f.body && 'locale' in JSON.parse(f.body));
ok('an unpicked language stays the browser one', run('i18n.getLocale()') === 'ko', run('i18n.getLocale()'));
ok('and is saved so notifications speak it too',
  run('state.settings.locale') === 'ko' && savedLocale().length === 1 && JSON.parse(savedLocale()[0].body).locale === 'ko',
  fetches);

fetches.length = 0;
run(`applyState({ events: [], photos: [], settings: { ...state.settings, locale: 'en' } })`);
await sleep(20);
ok('a language someone picked wins over the browser', run('i18n.getLocale()') === 'en', run('i18n.getLocale()'));
ok('and is left alone', savedLocale().length === 0, fetches);

/* 여러 날 일정 — 열하루짜리 하나가 달력과 목록을 도배하지 않게 */
{
  const day = (n) => run(`ymd(addDays(parse(TODAY), ${n}))`);
  const kids = (el, cls) => el.children.filter((c) => c.classList?.contains(cls));
  const trip = { id: 'trip', title: '오점뭐', date: day(1), endDate: day(11), time: null, endTime: null, memo: '', owner: 'both', repeat: 'none' };
  const lunch = { id: 'lunch', title: '점심', date: day(3), endDate: null, time: '12:00', endTime: null, memo: '', owner: 'a', repeat: 'none' };
  globalThis.__events = [trip, lunch];
  run(`state.events = __events; state.settings.since = null; state.cursor = new Date(parse('${day(1)}').getFullYear(), parse('${day(1)}').getMonth(), 1); render()`);

  const rows = $('upcoming-list').children.map((li) => li.children[0].children[1]);
  const tripRows = rows.filter((body) => body.children[0].textContent === '오점뭐');
  ok('coming up lists a multi-day event once', tripRows.length === 1 && rows.length === 2, rows.map((b) => b.textContent));
  const dotted = (s) => `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}`;
  const range = `${dotted(day(1))} ~ ${dotted(day(11))}`;
  ok('with the days it runs', tripRows[0]?.children[1].textContent.includes(range), tripRows[0]?.children[1].textContent);

  const cells = $('grid').children.filter((c) => c.dataset.date >= trip.date && c.dataset.date <= trip.endDate);
  const bars = cells.map((c) => kids(kids(c, 'spans')[0] || { children: [] }, 'bar')[0]);
  ok('every day it covers gets a piece of one band', cells.length > 0 && bars.every((b) => b && b.classList.contains('both')), cells.length);
  ok('and no dot of its own', cells.every((c) => kids(kids(c, 'branch')[0], 'cherry-dot').length === 0 || c.dataset.date === lunch.date));
  ok('the band has ends where it starts and stops',
    !!bars[0]?.classList.contains('from') && (cells.at(-1).dataset.date !== trip.endDate || !!bars.at(-1)?.classList.contains('to')));
  const labels = bars.filter((b) => kids(b, 'bar-label').length);
  const weeks = new Set(cells.map((c) => Math.floor($('grid').children.indexOf(c) / 7))).size;
  ok('its title shows once a week, not once a day', labels.length === weeks && labels[0].children[0].textContent === '오점뭐',
    [labels.length, weeks]);
  ok('the single-day event still gets its dot',
    kids(kids($('grid').children.find((c) => c.dataset.date === lunch.date), 'branch')[0], 'cherry-dot').length === 1);

  /* 겹치면 줄을 나누고, 다섯 줄까지 보여주고, 넘치면 +n으로 */
  const overlap = (id, owner) => ({ ...trip, id, owner, title: id });
  globalThis.__events = [trip, ...['2', '3', '4', '5', '6'].map((n, i) => overlap(n, ['a', 'b', 'both'][i % 3]))];
  run('state.events = __events; render()');
  const first = $('grid').children.find((c) => c.dataset.date === trip.date);
  const lanes = kids(kids(first, 'spans')[0], 'bar');
  ok('five overlapping bands all show', lanes.length === 5 && lanes.every((b) => !b.classList.contains('vacant')), lanes.map((b) => b.className));
  ok('drawn thinner so the week does not balloon', kids(first, 'spans')[0].classList.contains('dense'));
  ok('and the sixth is counted', kids(kids(first, 'branch')[0], 'more')[0]?.textContent === '+1');

  globalThis.__events = [trip, overlap('second', 'a')];
  run('state.events = __events; render()');
  ok('two bands keep the roomy size', !kids($('grid').children.find((c) => c.dataset.date === trip.date), 'spans')[0].classList.contains('dense'));
}

/* 줄은 주마다 새로 잡습니다 — 앞 주에 둘째 줄이던 띠도, 윗줄이 비면 다음 주엔 맨 위로 */
{
  const band = (id, date, endDate) => ({ id, title: id, date, endDate, time: null, endTime: null, memo: '', owner: 'both', repeat: 'none' });
  globalThis.__events = [band('short', '2026-09-06', '2026-09-08'), band('long', '2026-09-07', '2026-09-15')];
  run(`state.events = __events; state.cursor = new Date(2026, 8, 1); render()`);
  const cell = (date) => $('grid').children.find((c) => c.dataset.date === date);
  const bars = (date) => cell(date).children.find((c) => c.classList?.contains('spans'))?.children || [];
  ok('a band sits under the one that started first', bars('2026-09-07').length === 2 && bars('2026-09-07')[1].className.includes('both'),
    bars('2026-09-07').map((b) => b.className));
  ok('and moves up the next week instead of leaving a gap', bars('2026-09-13').length === 1 && !bars('2026-09-13')[0].classList.contains('vacant'),
    bars('2026-09-13').map((b) => b.className));
}

/* 다가오는 일 — 반복 일정은 가장 가까운 한 번만, "매달"이라고 적어서 */
{
  run(`i18n.setLocale('ko', { remember: false })`);
  const day = (n) => run(`ymd(addDays(parse(TODAY), ${n}))`);
  const ev = (id, date, endDate, repeat, time = null) => ({ id, title: id, date, endDate, time, endTime: null, memo: '', owner: 'both', repeat });
  // 매달 돌아오는 이틀짜리와 하루짜리 — 45일 안에 두 번씩 들어옵니다
  globalThis.__events = [ev('span', day(1), day(2), 'monthly'), ev('day', day(3), null, 'monthly', '09:00'), ev('plain', day(5), null, 'none')];
  run(`state.events = __events; state.settings.since = null; render()`);
  const rows = $('upcoming-list').children.map((li) => li.children[0].children[1]);
  const titles = rows.map((body) => body.children[0].textContent);
  ok('a repeating event is listed once', titles.filter((x) => x === 'span').length === 1 && titles.filter((x) => x === 'day').length === 1, titles);
  ok('at its nearest date, in date order', titles.join() === 'span,day,plain', titles);
  const meta = (id) => rows[titles.indexOf(id)].children[1].textContent;
  ok('and says it comes back', meta('span').includes('매달') && meta('day').includes('매달') && !meta('plain').includes('매달'),
    [meta('span'), meta('day'), meta('plain')]);
}

/* 반복 — 매달/매년 밑에 위에서 고른 날짜를 풀어 씁니다 */
{
  run(`i18n.setLocale('ko', { remember: false })`);
  const summary = () => ($('f-repeat-summary').hidden ? null : $('f-repeat-summary').textContent);
  const lunch = { id: 'lunch', title: '오점뭐', date: '2026-09-15', endDate: '2026-09-25', time: null, endTime: null, memo: '', owner: 'both', repeat: 'monthly' };
  globalThis.__lunch = lunch;
  error = attempt('openEditor(__lunch)');
  ok('a monthly multi-day event reads back its days', !error && summary() === '매달 15일 ~ 25일', error || summary());

  run(`setRepeat('yearly')`);
  ok('yearly names the month too', summary() === '매년 9월 15일 ~ 9월 25일', summary());

  $('f-multi').checked = false;
  $('f-multi').dispatchEvent({ type: 'change' });
  ok('turning off several days leaves one day', summary() === '매년 9월 15일', summary());

  run(`setRepeat('none')`);
  ok('no repeat, no line', summary() === null, summary());
  run(`$('editor').close()`);

  globalThis.__lunch = { ...lunch, date: '2026-09-28', endDate: '2026-10-03' };
  run('openEditor(__lunch)');
  ok('running into the next month says so', summary() === '매달 28일 ~ 다음 달 3일', summary());
  run(`$('editor').close()`);

  error = attempt(`openEditor(null, '${year}-09-20')`);
  $('f-repeat-on').checked = true;
  $('f-repeat-on').dispatchEvent({ type: 'change' });
  ok('ticking repeats on a new event shows the day at once', !error && summary() === '매달 20일', error || summary());
  run(`$('editor').close()`);

  run(`i18n.setLocale('en', { remember: false })`);
  globalThis.__lunch = lunch;
  run('openEditor(__lunch)');
  ok('and in English', summary() === 'Every month, day 15 to 25', summary());
  run(`$('editor').close()`);
}

/* 로그인 화면 — 구글 하나로 들어옵니다. 아이디·비밀번호 폼은 없어요 */
{
  await sleep(1300); // 인트로가 끝나고 로그인 화면이 뜰 때까지
  ok('someone not signed in lands on the sign-in screen', !$('gate').hidden && $('app').hidden);

  run(`i18n.setLocale('en', { remember: false }); showGateNote()`);
  const tr = (key) => run(`t('${key}')`);
  const gateHtml = /<section id="gate"[\s\S]*?<\/section>/.exec(readFileSync('public/index.html', 'utf8'))[0];
  ok('there is no username or password form — only google',
    !/<form|<input|gate-switch/.test(gateHtml) && gateHtml.includes('id="gate-google-button"'));
  ok('nothing to warn about without an invite', $('gate-note').hidden);
  run(`pendingInvite = 'abc'; showGateNote()`);
  ok('an invite says to continue with google', !$('gate-note').hidden && $('gate-note').textContent === tr('gate.invited'));
  run(`pendingInvite = ''; showGateNote()`);

  /* 소개 페이지(landing.mjs)와 오가는 길 */
  ok('the sign-in screen links to the about page in the screen language', $('gate-about').href === '/ko/', $('gate-about').href);
  const replaced = [];
  globalThis.history = { replaceState: (state, title, url) => replaced.push(url) };
  Object.assign(location, { search: '?signup', pathname: '/' });
  run('readLinkCodes()');
  ok('"start free" on the about page lands here with a clean address bar', replaced[0] === '/' && run('pendingInvite') === '', replaced);
  Object.assign(location, { search: '' });

  globalThis.__settings = run('({ ...state.settings })'); // 서버는 설정을 늘 온전한 모양으로 줍니다
  globalThis.google = { accounts: { id: { renderButton() {} } } };
  run('googleReady = Promise.resolve(true)');
  await run('offerGoogle()');
  fetches.length = 0;
  run(`onGoogleCredential('first-google-token')`);
  await sleep(50);
  ok('nothing ever signs up with a username', !fetches.some((f) => f.url === '/api/signup' || f.url === '/api/login'), fetches.map((f) => f.url));
  ok('then opens the calendar', !$('app').hidden && $('gate').hidden && fetches.some((f) => f.url === '/api/state'));
  ok('seated where the account says', run('state.me') === 'b', run('state.me'));
  ok('nothing carries a token by hand any more — the cookie does that',
    fetches.every((f) => !('Authorization' in f.headers)), fetches.map((f) => f.headers));
  delete globalThis.google;
  run('googleReady = null');

  /* 일정을 저장해도 "누가 바꿨는지"를 화면이 정하지 않습니다 — 서버가 계정을 봅니다 */
  fetches.length = 0;
  run(`openEditor(null, '2026-09-20')`);
  $('f-title').value = 'lunch';
  $('editor-form').dispatchEvent({ type: 'submit' });
  await sleep(30);
  const saved = fetches.find((f) => f.url === '/api/events');
  ok('saving an event names no actor', saved && !('actor' in JSON.parse(saved.body)), saved?.body);

  /* 이름을 안 적었으면 "나"는 보는 사람 쪽입니다 — b 자리 사람에겐 a가 "너" */
  run(`state.settings.names = { a: '', b: '' }`);
  ok('an unnamed partner reads as "you", from where I sit',
    run(`nameOf('b')`) === run(`t('default.nameA')`) && run(`nameOf('a')`) === run(`t('default.nameB')`),
    [run(`nameOf('a')`), run(`nameOf('b')`)]);
  run(`state.settings.names = { a: '조원', b: '' }`);
  ok('a name someone wrote wins', run(`nameOf('a')`) === '조원');

  /* 상대가 아직이면 설정이 초대를 권하고, 들어온 계정도 보여줍니다 */
  run('openSettings()');
  ok('settings offer an invite while they are one', !$('s-invite-field').hidden);
  ok('and say who is signed in', $('s-account').textContent.includes('we'), $('s-account').textContent);
  run(`state.paired = true; renderInvite()`);
  ok('once they are two the invite goes away', $('s-invite-field').hidden);
  run(`$('settings').close()`);
  await sleep(20);

  /* 로그인이 풀리면 적어둔 달력도 지웁니다 — 같은 폰으로 다른 커플이 들어올 수 있어서 */
  run('rememberState()');
  ok('the calendar is remembered while signed in', localStorage.getItem('diary_state') !== null);
  run('signOut()');
  ok('signing out forgets it', localStorage.getItem('diary_state') === null && localStorage.getItem('diary_signed_in') === null);
  ok('and shows the sign-in form again', !$('gate').hidden && $('app').hidden);
}

/* 크롬이 설치할 수 있다고 알려줘야 설정에 설치 버튼이 나옵니다 */
{
  let prevented = false;
  let prompted = false;
  const event = {
    preventDefault: () => { prevented = true; },
    prompt: () => { prompted = true; },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  };
  // index.html이 숨긴 채로 시작합니다 — 가짜 DOM은 html을 안 읽어요
  $('s-install-field').hidden = true;
  $('install-banner').hidden = true;
  (winListeners.beforeinstallprompt || []).forEach((fn) => fn(event));
  ok('an installable page shows the install button', !$('s-install-field').hidden);
  ok('and the banner on top, with its own install button', !$('install-banner').hidden && !$('install-banner-go').hidden);
  ok('instead of the browser\'s own banner', prevented);
  $('install-banner-go').click();
  await sleep(10);
  ok('pressing it asks the browser to install', prompted);
  ok('and both go away after', $('s-install-field').hidden && $('install-banner').hidden);

  /* 아이폰 사파리는 신호가 없어서 글로 안내합니다 */
  run('showInstallBanner(true)');
  ok('iphone safari gets the share → add to home screen note', !$('install-banner').hidden && !$('install-banner-ios').hidden && $('install-banner-android').hidden);
  ok('with no install button to press', $('install-banner-go').hidden);
  $('install-banner').hidden = true;

  /* 홈 화면에서 연 앱에는 띄우지 않습니다 */
  const browserMedia = globalThis.matchMedia;
  globalThis.matchMedia = (q) => ({ matches: q === '(display-mode: standalone)' });
  run('showInstallBanner(true)');
  ok('opened from the home screen, no banner', $('install-banner').hidden);
  globalThis.matchMedia = browserMedia;

  /* "나중에"를 누르면 한동안 다시 안 뜹니다 */
  run('showInstallBanner(true)');
  $('install-banner-close').click();
  ok('"later" closes the banner', $('install-banner').hidden);
  run('showInstallBanner(true)');
  ok('and it stays away next time', $('install-banner').hidden);
  store.delete('diary_install_snoozed');
}

/* 스토어 앱 안 — 웹푸시 대신 OS 알림. 네이티브가 넣어주는 window.Capacitor를 흉내 냅니다 */
{
  const loaded = [];
  document.head = new El('head');
  document.head.append = (node) => { loaded.push(node.src); setTimeout(() => node.onload?.(), 0); };

  ok('the browser never loads the app bridge', run('inApp()') === false && loaded.length === 0);

  const listeners = {};
  let permission = 'prompt';
  const unregistered = [];
  const fakePush = {
    addListener: async (name, fn) => { listeners[name] = fn; return { remove() {} }; },
    checkPermissions: async () => ({ receive: permission }),
    requestPermissions: async () => { permission = 'granted'; return { receive: permission }; },
    register: async () => { setTimeout(() => listeners.registration({ value: 'os-token-123' }), 0); },
    unregister: async () => { unregistered.push(true); },
  };
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    registerPlugin: (name) => (name === 'PushNotifications' ? fakePush : null),
  };

  /* 앱 안에서는 구글 로그인을 숨깁니다 — 웹 방식 구글 버튼은 앱 웹뷰에서 막히고,
     아이폰 앱에 구글을 넣으면 애플 로그인도 같이 넣어야 해서(심사 4.8) */
  fetches.length = 0;
  run('googleReady = null');
  const google = await run('loadGoogle()');
  await run('offerGoogle()');
  ok('the store app never offers google', google === false && $('gate-google').hidden
    && !fetches.some((f) => f.url === '/api/google'), fetches);
  run('googleReady = null'); // 아래 브라우저 검사는 다시 물어보게

  /* 아이폰 앱의 웹뷰도 사파리처럼 보이지만, 이미 앱이라 홈 화면에 추가하라고 하면 안 됩니다 */
  $('install-banner').hidden = true;
  run('showInstallBanner(true)');
  ok('the store app never asks to be added to the home screen', $('install-banner').hidden);

  fetches.length = 0;
  await run('syncPush()');
  ok('opening the app with notifications not yet allowed asks nothing and sends nothing',
    fetches.length === 0 && run('pushSub') === null);
  ok('but loads the bridge file once', loaded.length === 1 && loaded[0] === '/vendor/capacitor.js', loaded);

  run(`i18n.setLocale('en', { remember: false })`);
  run('renderPush()');
  ok('the settings button offers to turn them on in the app', !$('s-push').disabled && $('s-push').textContent === run(`t('push.allow')`));

  await run('subscribePush()');
  const sent = fetches.find((f) => f.url === '/api/push' && f.method === 'POST');
  ok('turning them on hands the OS token to the server as an app device',
    sent && JSON.parse(sent.body).platform === 'android' && JSON.parse(sent.body).token === 'os-token-123', fetches);
  ok('and no browser subscription is involved', sent && !('subscription' in JSON.parse(sent.body)));
  ok('the bridge file is still loaded only once', loaded.length === 1, loaded);

  fetches.length = 0;
  await run('togglePush()');
  ok('turning them off forgets this device on the server',
    fetches.some((f) => f.method === 'DELETE' && f.url === '/api/push?endpoint=os-token-123') && unregistered.length === 1, fetches);

  permission = 'denied';
  await run('syncPush()');
  ok('if the phone says no, the settings say why', $('s-push').disabled && $('s-push-note').textContent === run(`t('push.denied')`));

  delete globalThis.Capacitor;
}

/* 비밀번호 바꾸기 — 지금 것과 새 것을 같이 보냅니다. 구글로만 들어온 사람에게는 버튼이 없어요 */
{
  run(`i18n.setLocale('en', { remember: false }); state.hasPassword = true; localStorage.setItem('diary_signed_in', '1'); rememberState(); show('app')`);
  run('openSettings()');
  ok('a password account can change its password', !$('s-password').hidden);
  $('s-password').click();
  ok('it asks for the current one first', $('pw').open && $('pw-current').value === '' && $('pw-new').value === '');

  fetches.length = 0;
  $('pw-current').value = 'old one here';
  $('pw-new').value = 'a brand new one';
  $('pw-form').dispatchEvent({ type: 'submit', preventDefault() {} });
  await sleep(30);
  const sent = fetches.find((f) => f.url === '/api/account');
  ok('saving sends both passwords as a change, not a delete',
    sent?.method === 'PATCH' && JSON.parse(sent.body).current === 'old one here' && JSON.parse(sent.body).password === 'a brand new one', fetches);
  ok('and closes the box', !$('pw').open);

  run(`$('settings').close(); state.hasPassword = false`);
  run('openSettings()');
  ok('a google-only account has no password button', $('s-password').hidden);
  run(`$('settings').close(); state.hasPassword = true`);
  fetches.length = 0; // 아래 탈퇴 검사는 /api/account 요청이 없는 데서 시작합니다
}

/* 로그인된 기기 — 설정을 열면 목록을 받아와 보여주고, 다른 기기는 여기서 로그아웃시킵니다 */
{
  const realFetch = globalThis.fetch;
  let list = [
    { id: 'id-here', device: 'Chrome · Windows', seenAt: '2026-10-02T03:00:00Z', current: true },
    { id: 'id-phone', device: 'Safari · iPhone', seenAt: '2026-09-20T03:00:00Z', current: false },
    { id: 'id-what', device: '', seenAt: '2026-09-01T03:00:00Z', current: false },
  ];
  globalThis.fetch = async (url, init = {}) => {
    if (url !== '/api/devices') return realFetch(url, init);
    fetches.push({ url, method: init.method, body: init.body });
    if (init.method === 'DELETE') {
      list = list.filter((d) => d.id !== JSON.parse(init.body).id);
      return { ok: true, status: 204, json: async () => null };
    }
    return { ok: true, status: 200, json: async () => ({ devices: list }) };
  };
  run(`i18n.setLocale('en', { remember: false }); localStorage.setItem('diary_signed_in', '1'); rememberState(); show('app')`);
  run('openSettings()');
  await sleep(20);
  const rows = () => $('s-devices').children;
  const button = (li) => li.children.find((c) => c.tagName === 'button' || c.tagName === 'BUTTON');
  ok('settings list every signed-in device', !$('s-devices-box').hidden && rows().length === 3, rows().length);
  ok('this device is marked and has no sign-out button',
    rows()[0].textContent === 'Chrome · Windows' + run(`t('devices.this')`) && !button(rows()[0]), rows()[0].textContent);
  ok('another device shows when it was last used and can be signed out',
    rows()[1].textContent.startsWith('Safari · iPhone') && rows()[1].textContent.includes('September 20') && !!button(rows()[1]),
    rows()[1].textContent);
  ok('a device with no name still gets a line', rows()[2].textContent.startsWith(run(`t('devices.unknown')`)));

  fetches.length = 0;
  button(rows()[1]).click();
  await sleep(10);
  ok('signing a device out asks first, by its name',
    $('ask').open && $('ask-text').textContent === run(`t('ask.signOutDevice', { name: 'Safari · iPhone' })`), $('ask-text').textContent);
  $('ask-no').click();
  await sleep(10);
  ok('backing out sends nothing', !fetches.some((f) => f.method === 'DELETE'));

  button(rows()[1]).click();
  await sleep(10);
  $('ask-yes').click();
  await sleep(30);
  const gone = fetches.find((f) => f.method === 'DELETE');
  ok('confirming sends that device and nothing else', gone?.url === '/api/devices' && gone.body === JSON.stringify({ id: 'id-phone' }), fetches);
  ok('and the list is drawn again without it', rows().length === 2 && !$('s-devices').textContent.includes('iPhone'), $('s-devices').textContent);

  /* 인터넷이 없거나 옛 서버면 목록 없이 설정이 그대로 열립니다 */
  run(`$('settings').close()`);
  globalThis.fetch = async (url, init) => { if (url === '/api/devices') throw new TypeError('Failed to fetch'); return realFetch(url, init); };
  run('openSettings()');
  await sleep(20);
  ok('with no signal the settings still open, without the list', $('settings').open && $('s-devices-box').hidden);
  globalThis.fetch = realFetch;
  run(`$('settings').close()`);
  run('openSettings()');
  await sleep(20);
  ok('an answer without a list leaves it hidden too', $('settings').open && $('s-devices-box').hidden);
  run(`$('settings').close()`);
  fetches.length = 0;
}

/* 탈퇴 — 비밀번호를 한 번 더 받고, 끝나면 이 기기에 적어둔 것도 지웁니다 */
{
  run(`i18n.setLocale('en', { remember: false }); state.paired = true; localStorage.setItem('diary_signed_in', '1'); rememberState(); show('app')`);
  run('openSettings()');
  $('s-delete').click();
  await sleep(10);
  ok('deleting the account asks for the password', $('ask').open && !$('ask-password').hidden);
  ok('and says the calendar stays with the other one',
    $('ask-text').textContent === run(`t('ask.deleteAccountPaired') + '\\n' + t('ask.confirmPassword')`), $('ask-text').textContent);

  $('ask-no').click();
  await sleep(10);
  ok('backing out sends nothing', !fetches.some((f) => f.url === '/api/account'));

  fetches.length = 0;
  $('s-delete').click();
  await sleep(10);
  $('ask-password').value = 'my password';
  $('ask-yes').click();
  await sleep(30);
  const gone = fetches.find((f) => f.url === '/api/account');
  ok('confirming sends the password with the delete',
    gone?.method === 'DELETE' && JSON.parse(gone.body).password === 'my password', fetches);
  ok('the password does not linger in the field', $('ask-password').value === '');
  ok('and the device forgets the calendar and signs out',
    localStorage.getItem('diary_state') === null && !$('gate').hidden && $('app').hidden);

  run('state.paired = false');
  run('openSettings()');
  $('s-delete').click();
  await sleep(10);
  ok('alone, it warns that everything goes', $('ask-text').textContent.startsWith(run(`t('ask.deleteAccountAlone')`)));
  ok('and no longer points at a download that is gone', !/download/i.test($('ask-text').textContent), $('ask-text').textContent);
  $('ask-no').click();
  run(`$('settings').close()`);
}

/* 구글로 들어오기 — 버튼은 구글이 그리니, 그 자리에 가짜 구글을 둡니다 */
{
  const rendered = [];
  const asked = [];  // 구글에 부탁한 버튼 문구
  globalThis.google = { accounts: { id: { renderButton: (el, opts) => { rendered.push(el); asked.push(opts.text); } } } };
  run('googleReady = Promise.resolve(true)');

  /* 구글로만 들어온 사람의 탈퇴는 비밀번호 대신 구글로 확인합니다 */
  run(`localStorage.setItem('diary_signed_in', '1'); state.hasPassword = false; state.paired = true; rememberState(); show('app')`);
  run('openSettings()');
  fetches.length = 0;
  $('s-delete').click();
  await sleep(10);
  ok('a google account confirms leaving with google, not a password',
    $('ask').open && $('ask-password').hidden && $('ask-yes').hidden && !$('ask-google').hidden && rendered.at(-1) === $('ask-google'));
  ok('that button says continue, not sign up', asked.at(-1) === 'continue_with', asked);
  ok('and is told so', $('ask-text').textContent.endsWith(run(`t('ask.confirmGoogle')`)), $('ask-text').textContent);
  run(`onGoogleCredential('google-says-yes')`);
  await sleep(30);
  const gone = fetches.find((f) => f.url === '/api/account');
  ok('google\'s answer goes with the delete',
    gone?.method === 'DELETE' && JSON.parse(gone.body).credential === 'google-says-yes' && !('password' in JSON.parse(gone.body)), fetches);
  ok('and the next question has its yes button back', !$('ask-yes').hidden && $('ask-google').hidden);

  /* 로그인 화면 — 나가고 나면 구글 버튼이 다시 놓입니다 */
  ok('the sign-in screen offers google when the server has it on',
    !$('gate-google').hidden && rendered.at(-1) === $('gate-google-button'));
  ok('one button for new and returning people: continue with google', asked.at(-1) === 'continue_with', asked);
  fetches.length = 0;
  run(`onGoogleCredential('google-token')`);
  await sleep(50);
  const via = fetches.find((f) => f.url === '/api/google');
  ok('pressing it sends google\'s token', via?.method === 'POST' && JSON.parse(via.body).credential === 'google-token', fetches);
  ok('and opens the calendar', !$('app').hidden && fetches.some((f) => f.url === '/api/state'));

  run(`googleReady = Promise.resolve(false); offerGoogle()`);
  await sleep(10);
  ok('a server without google shows no google button, and says why',
    $('gate-google').hidden && $('gate-error').textContent === run(`t('error.googleOff')`), $('gate-error').textContent);
  delete globalThis.google;
}

/* 신호가 없을 때 앱을 열면 — 지난번에 본 달력이 그대로 떠 있어야 합니다 (화면 파일은 sw.js가 내줍니다) */
{
  const realFetch = globalThis.fetch;
  run(`localStorage.setItem('diary_signed_in', '1'); state.me = 'b'; rememberState(); show('intro')`);
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await run('enter()');
  ok('with no signal, the calendar from last time stays up', !$('app').hidden && $('gate').hidden,
    [$('app').hidden, $('gate').hidden]);
  ok('and it says the internet is out of reach', $('toast').textContent === run(`t('error.offline')`), $('toast').textContent);

  run(`show('intro')`);
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await run('enter()');
  ok('a sign-in that lapsed still lands on the sign-in screen', $('app').hidden && !$('gate').hidden,
    [$('app').hidden, $('gate').hidden]);

  run(`show('intro')`);
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await run('enter()');
  ok('with no signal and nothing remembered, it is the sign-in screen', $('app').hidden && !$('gate').hidden,
    [$('app').hidden, $('gate').hidden]);
  globalThis.fetch = realFetch;
}

/* 앱 안에서만 부르는 플러그인 다리(public/vendor/capacitor.js)는 설치된 @capacitor/core와 같아야 합니다.
   core를 올리고 이 파일을 안 바꾸면 네이티브 쪽과 말이 어긋납니다 — npm run vendor */
{
  const shipped = readFileSync('public/vendor/capacitor.js', 'utf8');
  let installed = null;
  try { installed = readFileSync('node_modules/@capacitor/core/dist/capacitor.js', 'utf8'); } catch { /* 설치 안 된 곳이면 건너뜀 */ }
  ok('the app bridge matches the installed @capacitor/core', installed === null || installed === shipped);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
