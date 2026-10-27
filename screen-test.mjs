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
  ok('no color picked means none is sent', JSON.parse(saved.body).color === null, saved?.body);

  /* 일정마다 색 — 고르면 같이 보내고, 달력은 그 색을 씁니다 */
  run(`openEditor(null, '2026-09-21')`);
  const swatches = [...$('f-color').children];
  ok('the editor offers default plus every color on the list',
    swatches.length === run('globalThis.DIARY_LIMITS.eventColors.length') + 1 && swatches[0].getAttribute('aria-checked') === 'true',
    swatches.length);
  ok('the colors stay folded until the dot beside the title is tapped', $('f-color').hidden && !$('f-color-btn').dataset.color);
  $('f-color-btn').click();
  ok('tapping it unfolds them', !$('f-color').hidden && $('f-color-btn').getAttribute('aria-expanded') === 'true');
  swatches.find((c) => c.dataset.color === 'red').click();
  ok('picking one paints the dot and folds the row', $('f-color-btn').dataset.color === 'red' && $('f-color').hidden);
  $('f-title').value = 'exam';
  fetches.length = 0;
  $('editor-form').dispatchEvent({ type: 'submit' });
  await sleep(30);
  const red = fetches.find((f) => f.url === '/api/events');
  ok('a picked color goes with the event', JSON.parse(red.body).color === 'red', red?.body);
  const tag = run(`(() => { const el = document.createElement('span'); paintColor(el, { color: 'blue' }); return el.dataset.color; })()`);
  const mile = run(`(() => { const el = document.createElement('span'); paintColor(el, { color: 'blue', milestone: true }); return el.dataset.color; })()`);
  ok('the calendar paints that color, but never on an anniversary', tag === 'blue' && !mile, [tag, mile]);
  run(`openEditor({ id: 'x', title: 'exam', date: '2026-09-21', owner: 'both', repeat: 'none', color: 'red' })`);
  ok('opening a colored event shows its color picked',
    [...$('f-color').children].find((c) => c.getAttribute('aria-checked') === 'true')?.dataset.color === 'red'
    && $('f-color-btn').dataset.color === 'red');
  run(`$('editor').close()`);

  /* 이름을 안 적었으면 "나"는 보는 사람 쪽입니다 — b 자리 사람에겐 a가 "너" */
  run(`state.settings.names = { a: '', b: '' }`);
  ok('an unnamed partner reads as "you", from where I sit',
    run(`nameOf('b')`) === run(`t('default.nameA')`) && run(`nameOf('a')`) === run(`t('default.nameB')`),
    [run(`nameOf('a')`), run(`nameOf('b')`)]);
  run(`state.settings.names = { a: '조원', b: '' }`);
  ok('a name someone wrote wins', run(`nameOf('a')`) === '조원');

  /* 설정에는 초대가 없습니다 — 혼자면 첫 화면 카드가 부릅니다 (10/27). 들어온 계정은 보여줍니다 */
  run('openSettings()');
  ok('settings no longer carry an invite', !/s-invite/.test(readFileSync('public/index.html', 'utf8')));
  ok('and say who is signed in', $('s-account').textContent.includes('we'), $('s-account').textContent);

  /* 공유 시트가 없으면(컴퓨터) 초대 링크를 복사해 두고, 복사도 안 되면 주소를 토스트로 */
  const copied = [];
  navigator.clipboard = { writeText: async (text) => { copied.push(text); } };
  const realCall = run('api.call');
  globalThis.__realCall = realCall;
  run(`api.call = async (method, url) => (url === '/api/invite' ? { code: 'abc 123' } : {})`);
  await run(`sendInvite($('s-push'))`);
  ok('without a share sheet the invite link is copied', copied[0]?.endsWith('/?invite=abc%20123') && $('toast').textContent === run(`t('invite.copied')`), copied);
  navigator.clipboard = { writeText: async () => { throw new Error('denied'); } };
  await run(`sendInvite($('s-push'))`);
  ok('and when copying is blocked the address itself is shown', $('toast').textContent.endsWith('/?invite=abc%20123'), $('toast').textContent);
  delete navigator.clipboard;

  /* 공유 시트가 있는 폰: 한 번으로 보내고, 닫으면 아무것도 남지 않습니다 */
  run(`api.call = async (method, url) => (url === '/api/invite' ? { code: 'xyz' } : {})`);
  const sent = [];
  navigator.share = async (data) => { sent.push(data); };
  await run(`sendInvite($('s-push'))`);
  ok('with a share sheet it opens the sheet', sent.length === 1 && sent[0].url.endsWith('/?invite=xyz'), sent);
  run(`$('toast').textContent = ''`);
  navigator.share = async () => { throw Object.assign(new Error('closed'), { name: 'AbortError' }); };
  await run(`sendInvite($('s-push'))`);
  ok('closing the share sheet leaves nothing behind', $('toast').textContent === '');
  delete navigator.share;
  run('api.call = globalThis.__realCall');
  run('state.paired = true');
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
  (winListeners.beforeinstallprompt || []).forEach((fn) => fn(event));
  ok('an installable page shows the install button in settings', !$('s-install-field').hidden);
  ok('instead of the browser\'s own banner', prevented);
  $('s-install').click();
  await sleep(10);
  ok('pressing it asks the browser to install', prompted);
  ok('and the button goes away after', $('s-install-field').hidden);

  /* 로그인 화면엔 구글 버튼 하나 — 설치 버튼도, 아래 띠도 없습니다 */
  const html = readFileSync('public/index.html', 'utf8');
  ok('the sign-in screen has no install button and no install bar',
    !/id="gate-install"|id="install-banner"/.test(html) && !/gate-install|install-banner/.test(readFileSync('public/app.js', 'utf8')));

  /* 아이폰 사파리 — 설정의 설치 버튼은 3단계 그림 안내를 엽니다(공유 시트에는 "홈 화면에 추가"가 없어서) */
  const plainAgent = navigator.userAgent;
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
  navigator.userAgent = iphone;
  run('showInstallButtons()');
  ok('iphone safari keeps an install button in settings', !$('s-install-field').hidden);
  const sharedFromSettings = [];
  navigator.share = async (data) => { sharedFromSettings.push(data); };
  $('s-install').click();
  await sleep(10);
  ok('it never opens the share sheet', sharedFromSettings.length === 0);
  ok('it shows the add-to-home-screen steps', $('install-guide').open && !$('install-guide-ios').hidden && $('install-guide-away').hidden);
  ok('pointing down at the safari share button', $('install-guide').classList.contains('point-down'));
  $('install-guide-close').click();
  ok('with no "later" — that is only for the first run', $('install-guide-later').hidden);
  ok('and closes', !$('install-guide').open);
  delete navigator.share;

  /* 카톡 안 화면 — 로그인도 설치도 안 되니 바깥 브라우저로 내보냅니다 */
  const kakao = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 10.8.0';
  const invite = 'https://diary.test/?invite=abc123';
  ok('kakaotalk opens the link, invite and all, in the outside browser',
    run(`outsideUrl(${JSON.stringify(kakao)}, ${JSON.stringify(invite)})`) === `kakaotalk://web/openExternal?url=${encodeURIComponent(invite)}`);
  ok('line gets its own flag', run(`outsideUrl('Mozilla/5.0 Line/14.0.0', ${JSON.stringify(invite)})`) === 'https://diary.test/?invite=abc123&openExternalBrowser=1');
  ok('other android apps hand it to the default browser',
    run(`outsideUrl('Mozilla/5.0 (Linux; Android 14) Instagram 300', ${JSON.stringify(invite)})`) === 'intent://diary.test/?invite=abc123#Intent;scheme=https;end');
  ok('instagram on iphone has no way out, so it only explains',
    run(`outsideUrl('Mozilla/5.0 (iPhone) Instagram 300', ${JSON.stringify(invite)})`) === null);
  navigator.userAgent = kakao;
  ok('a kakaotalk page counts as an app browser', run('appBrowser()') === true);
  run('showInstallButtons()');
  $('s-install').click();
  await sleep(10);
  ok('its install button explains how to get out instead', $('install-guide').open && !$('install-guide-away').hidden && $('install-guide-ios').hidden);
  ok('with a button that opens the browser', !$('install-guide-open').hidden);
  // 첫 화면에서는 언어를 고르기 전에 열리므로, 제목도 키로 달려 있어야 고른 언어로 바뀝니다
  ok('its title follows the language picked after it opened', $('install-guide-title').dataset.i18n === 'install.awayTitle');
  $('install-guide').close();
  navigator.userAgent = plainAgent;
  run('showInstallButtons()');
  ok('a desktop browser with nothing to install shows no install button', $('s-install-field').hidden);

  /* ── 처음 들어올 때: 이름 → 홈 화면 추가 한 번 → 사용법 ──
     구글이 준 토큰처럼 생긴 것을 만듭니다. 서명은 서버가 보니, 화면은 이름만 읽어요 */
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const credential = `${b64({ alg: 'RS256' })}.${b64({ sub: '1', given_name: '미나', name: '김미나' })}.sig`;
  const reset = () => {
    run('installGuideFirstRun = false'); // 닫으면서 사용법이 따라 뜨지 않게
    ['name-ask', 'install-offer', 'install-guide', 'guide'].forEach((id) => $(id).close());
    ['diary_install_offered', 'diary_guide'].forEach((k) => store.delete(k));
  };
  const guideShown = async () => { await sleep(500); return $('guide').open; };
  const shared = [];
  const fakeShare = async (data) => { shared.push(data); };

  reset();
  navigator.userAgent = iphone;
  navigator.share = fakeShare;
  globalThis.__settings = { ...run('state.settings'), names: { a: '레오', b: '' } }; // 초대로 들어온 b — 이름이 비었습니다
  fetches.length = 0;
  await run(`signInWithGoogle(${JSON.stringify(credential)})`);
  await sleep(20);
  ok('a new sign-up is asked one thing: what to call them', $('name-ask').open && !$('install-offer').open && !$('guide').open);
  ok('with the google first name already in', $('name-ask-input').value === '미나', $('name-ask-input').value);
  ok('the name box asks "what should we call you?"', run(`I18N.ko['name.title']`) === '뭐라고 불러 드릴까요?' && run(`t('name.title')`) === run(`I18N[i18n.getLocale()]['name.title']`));

  $('name-ask-form').dispatchEvent({ type: 'submit', preventDefault() {} });
  await sleep(30);
  const named = fetches.find((f) => f.url === '/api/settings' && f.method === 'PATCH');
  ok('"OK" saves only my own seat', named && JSON.stringify(JSON.parse(named.body).names) === JSON.stringify({ b: '미나' }), named?.body);
  ok('keeps the partner\'s name as it was', run('state.settings.names.a') === '레오' && run('state.settings.names.b') === '미나');
  ok('then, on iphone, goes straight to the three picture steps', !$('name-ask').open && $('install-guide').open && !$('install-guide-ios').hidden);
  ok('with no "keep it on your home screen?" box before it', !$('install-offer').open);
  ok('and no share sheet', shared.length === 0, shared);
  ok('the steps say iOS 26: share (or ··· first), view more, open as web app',
    run(`I18N.ko['install.step1']`).includes('···') && run(`I18N.ko['install.step2']`).includes('더 보기') && run(`I18N.ko['install.step3']`).includes('웹 앱으로 열기'));
  ok('with "later" underneath', !$('install-guide-later').hidden);
  ok('and the guide waits', !(await guideShown()));

  $('install-guide-later').click();
  ok('"later" closes the steps', !$('install-guide').open);
  ok('and the guide shows right there in the browser', await guideShown());
  ok('on its setup tab', !$('guide-setup').hidden);
  $('guide').close();
  run('firstSteps()');
  await sleep(20);
  ok('opening the tab again asks nothing more', !$('name-ask').open && !$('install-guide').open && !(await guideShown()));

  /* × 로 닫아도 같은 길 */
  reset();
  run('firstSteps()');
  await sleep(20);
  ok('a name already there skips the name box', !$('name-ask').open && $('install-guide').open);
  $('install-guide-close').click();
  ok('closing with × also leads to the guide', await guideShown());
  $('guide').close();
  ok('the iphone never touched the share sheet', shared.length === 0, shared);

  /* 홈 화면 앱으로 처음 열면 사용법 */
  reset();
  store.set('diary_install_offered', 'taken');
  const browserMedia = globalThis.matchMedia;
  globalThis.matchMedia = (q) => ({ matches: q === '(display-mode: standalone)' });
  run('firstSteps()');
  ok('opened from the home screen, the guide shows first time', !$('install-offer').open && (await guideShown()));
  $('guide').close();
  globalThis.matchMedia = browserMedia;

  /* 안드로이드 — 버튼 하나로 시스템 설치 창 */
  reset();
  navigator.userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36';
  let androidPrompted = 0;
  let outcome = 'accepted';
  const offerAgain = () => (winListeners.beforeinstallprompt || []).forEach((fn) => fn({
    preventDefault() {}, prompt: () => { androidPrompted++; }, get userChoice() { return Promise.resolve({ outcome }); },
  }));
  offerAgain();
  run('firstSteps()');
  await sleep(20);
  ok('android gets the "keep it on your home screen?" box', $('install-offer').open && !$('install-guide').open);
  $('install-offer-go').click();
  await sleep(20);
  ok('its button opens the system install prompt', androidPrompted === 1 && !$('install-offer').open);
  ok('installed — the guide waits for the app', !(await guideShown()));

  reset();
  outcome = 'dismissed';
  offerAgain();
  run('firstSteps()');
  await sleep(20);
  $('install-offer-go').click();
  ok('saying no to the system prompt counts as later', await guideShown());
  $('guide').close();

  /* 안드로이드 처음부터: 이름 → "둘까요?" 창 → 시스템 설치 창 */
  reset();
  outcome = 'accepted';
  offerAgain();
  run(`state.settings.names = { a: '레오', b: '' }`);
  run('firstSteps()');
  await sleep(20);
  ok('android starts with the name too', $('name-ask').open && !$('install-offer').open);
  $('name-ask-input').value = '미나';
  $('name-ask-form').dispatchEvent({ type: 'submit', preventDefault() {} });
  await sleep(30);
  ok('then the one install box', !$('name-ask').open && $('install-offer').open && !$('install-guide').open);
  const before = androidPrompted;
  $('install-offer-go').click();
  await sleep(20);
  ok('and one tap brings up the system install prompt', androidPrompted === before + 1 && !$('install-offer').open);

  /* 안드로이드 크롬은 설치 신호를 조금 늦게 줍니다 — 잠깐 기다렸다 묻습니다 */
  reset();
  run('installPrompt = null');
  run('firstSteps()');
  await sleep(20);
  ok('no install signal yet, nothing asked yet', !$('install-offer').open);
  offerAgain();
  await sleep(20);
  ok('once it comes, the offer shows', $('install-offer').open);
  $('install-offer').close();

  reset();
  navigator.userAgent = plainAgent;
  delete navigator.share;
  run('installPrompt = null');
  run('firstSteps()');
  ok('a browser with no way to install goes straight to the guide', !$('install-offer').open && (await guideShown()));
  $('guide').close();
  store.set('diary_install_offered', 'skipped');
  store.set('diary_guide', run('GUIDE_VERSION'));
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

  /* 안드로이드 앱은 웹 구글 창이 막혀서 폰의 구글 계정 선택 창을 씁니다. 웹 클라이언트 ID를 그대로 넘겨요 */
  const initialized = [];
  let signInAnswer = { idToken: 'phone-google-token' };
  const fakeGoogle = {
    initialize: async (opts) => { initialized.push(opts); },
    signIn: async () => { if (signInAnswer instanceof Error) throw signInAnswer; return signInAnswer; },
  };
  globalThis.Capacitor.registerPlugin = (name) => (name === 'PushNotifications' ? fakePush : name === 'GoogleSignIn' ? fakeGoogle : null);
  const plainFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => (url === '/api/google' && !init.method
    ? (fetches.push({ url, method: 'GET', headers: {} }), { ok: true, status: 200, json: async () => ({ clientId: 'web-client.apps' }) })
    : plainFetch(url, init));
  run('googleReady = null');
  ok('the android app offers google', (await run('loadGoogle()')) === true, initialized);
  ok('with the web client id, so the token is made out like the web one', initialized[0]?.clientId === 'web-client.apps', initialized);
  await run('offerGoogle()');
  const appButton = $('gate-google-button').children?.[0];
  ok('it draws its own button', !$('gate-google').hidden && appButton?.textContent === run(`t('gate.continueGoogle')`), appButton?.textContent);
  fetches.length = 0;
  let handed = null;
  run('onGoogleCredential = (c) => { globalThis.__handed = c; }');
  appButton.click();
  await sleep(10);
  handed = globalThis.__handed;
  ok('pressing it hands over the phone\'s google token', handed === 'phone-google-token', handed);
  signInAnswer = Object.assign(new Error('The user canceled the sign-in flow.'), { code: 'SIGN_IN_CANCELED' });
  globalThis.__handed = null;
  $('toast').textContent = '';
  appButton.click();
  await sleep(10);
  ok('closing the account chooser is not an error', globalThis.__handed === null && $('toast').textContent === '', $('toast').textContent);

  /* 아이폰 앱은 아직 숨깁니다 — 구글을 넣으면 애플 로그인도 같이 넣어야 해서(심사 4.8) */
  globalThis.Capacitor.getPlatform = () => 'ios';
  run('googleReady = null; appGoogle = null');
  ok('the iphone app does not offer google yet', (await run('loadGoogle()')) === false);
  globalThis.Capacitor.getPlatform = () => 'android';
  globalThis.fetch = plainFetch;
  run('appGoogle = null');
  run('googleReady = null'); // 아래 브라우저 검사는 다시 물어보게

  /* 아이폰 앱의 웹뷰도 사파리처럼 보이지만, 이미 앱이라 홈 화면에 추가하라고 하면 안 됩니다 */
  store.delete('diary_install_offered');
  run('firstSteps()');
  await sleep(20);
  ok('the store app never asks to be added to the home screen', !$('install-offer').open);
  store.set('diary_install_offered', 'skipped');

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

/* 로그인된 기기 목록은 뺐습니다 (2026-10-26) — 설정을 열어도 /api/devices를 부르지 않습니다 */
{
  fetches.length = 0;
  run(`i18n.setLocale('en', { remember: false }); localStorage.setItem('diary_signed_in', '1'); rememberState(); show('app')`);
  run('openSettings()');
  await sleep(20);
  ok('settings open without asking for a device list', $('settings').open && !fetches.some((f) => f.url === '/api/devices'), fetches);
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

/* 아이폰 사파리 탭 — 알림 버튼이 회색으로 죽어 있지 않고, 누르면 홈 화면 추가 그림 안내 */
{
  const plain = navigator.userAgent;
  const keepPush = globalThis.PushManager;
  navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
  delete globalThis.PushManager; // 사파리 탭에는 알림 API가 없을 수 있습니다
  run('renderPush()');
  ok('iphone safari says to add it to the home screen, not "unsupported"', $('s-push-note').textContent === run(`t('push.safariTab')`), $('s-push-note').textContent);
  ok('and the button is not greyed out', !$('s-push').disabled);
  $('s-push').click();
  await sleep(10);
  ok('pressing it shows the add-to-home-screen steps', $('install-guide').open && !$('install-guide-ios').hidden);
  run(`$('install-guide').close()`);
  navigator.userAgent = plain;
  if (keepPush) globalThis.PushManager = keepPush;
  run('renderPush()');
}

/* 처음 만난 날 — 비어 있으면 연도 → 월 → 날, 세 번이면 몇 년 전 날짜도 고릅니다 */
{
  run(`$('s-since').value = ''`);
  run(`datePicker.open('s-since')`);
  const years = $('dp-years');
  ok('an empty "day you met" opens on the years', $('datepick').open && !years.hidden && $('dp-grid').hidden);
  ok('ending at this year — no years still to come', Number(years.children.at(-1).textContent) === new Date().getFullYear());
  const y2023 = years.children.find((b) => b.textContent === '2023' || b.textContent === 2023);
  y2023.click();
  ok('picking a year shows its twelve months', !years.hidden && years.children.length === 12 && $('dp-title').textContent === '2023');
  years.children[4].click();
  ok('picking a month shows its days', years.hidden && !$('dp-grid').hidden && run('datePicker.view.getFullYear()') === 2023 && run('datePicker.view.getMonth()') === 4);
  run(`datePicker.close()`);
  run(`$('f-date').value = TODAY; datePicker.open('f-date')`);
  ok('an event date still opens on its days', !$('dp-grid').hidden && $('dp-years').hidden);
  run(`datePicker.close()`);
}

/* 혼자일 땐 첫 화면 맨 위에 초대 카드 하나 — 설정 깊이 들어가지 않고 상대를 부릅니다 */
{
  run(`state.me = 'a'; state.paired = false; state.events = []; render()`);
  const first = $('home-nudge').children[0];
  ok('alone, the home screen leads with inviting them', first?.className === 'invite-card', first?.className);
  ok('above the upcoming list, not inside it, so it does not look like a plan',
    !$('upcoming-list').children.some((c) => c.className === 'invite-card'));
  ok('and only that — no "add one with +" next to it', $('upcoming-list').children.length === 0);
  ok('nor an empty "upcoming" heading under it', $('upcoming-title').hidden);
  ok('the invite card cannot be closed', !first.children.some((c) => c.id === 'home-invite-close'));
  const shared = [];
  navigator.share = async (data) => { shared.push(data); };
  fetches.length = 0;
  first.children.find((c) => c.id === 'home-invite').click();
  await sleep(20);
  ok('one tap makes a link and opens the share sheet',
    fetches.some((f) => f.url === '/api/invite' && f.method === 'POST') && shared.length === 1 && /\/\?invite=/.test(shared[0].url), shared);
  delete navigator.share;
  run(`state.paired = true; state.settings.since = '2024-02-14'; render()`);
  ok('once they are in, the card is gone', $('home-nudge').children.length === 0);
  ok('and the heading is back', !$('upcoming-title').hidden);

  /* 둘이 됐는데 처음 만난 날이 없으면 같은 자리에 "처음 만난 날 넣기" — 한 번에 하나만 */
  run(`state.paired = false; state.settings.since = null; render()`);
  ok('alone with no day, only the invite card shows', $('home-nudge').children.length === 1
    && $('home-nudge').children[0].children.some((c) => c.id === 'home-invite'));
  run(`state.paired = true; render()`);
  const since = $('home-nudge').children[0];
  ok('together with no day, the same card asks for the day you met',
    since?.className === 'invite-card' && since.children.some((c) => c.id === 'home-since')
    && $('home-nudge').children.length === 1);

  /* 처음 만난 날을 안 넣을 커플은 닫을 수 있습니다 — 기기마다 기억하고, 로그아웃하면 잊어요 */
  since.children.find((c) => c.id === 'home-since-close').click();
  ok('the day-you-met card can be closed', $('home-nudge').children.length === 0);
  run('render()');
  ok('and stays closed on this device', $('home-nudge').children.length === 0 && localStorage.getItem('diary_since_skipped') === '1');
  run(`localStorage.removeItem('diary_since_skipped'); render()`);
  const sinceAgain = $('home-nudge').children[0];
  sinceAgain.children.find((c) => c.id === 'home-since').click();
  ok('one tap opens the years straight away', $('datepick').open && !$('dp-years').hidden);
  fetches.length = 0;
  $('dp-years').children.find((b) => String(b.textContent) === '2023').click();
  $('dp-years').children[4].click();
  $('dp-grid').children.find((c) => !c.classList.contains('out') && String(c.textContent) === '14').click();
  await sleep(30);
  ok('picking it saves the day', run('state.settings.since') === '2023-05-14'
    && fetches.some((f) => f.url === '/api/settings' && JSON.parse(f.body).since === '2023-05-14'), run('state.settings.since'));
  run('render()');
  ok('and the card goes away', $('home-nudge').children.length === 0);
}

/* 지우기 — 묻지 않고 바로, 대신 몇 초 동안 되돌리기. 서버에는 그 뒤에 보냅니다 */
{
  const plan = { id: 'undo-me', title: '영화', date: run('TODAY'), endDate: null, time: null, endTime: null, memo: '', owner: 'a', repeat: 'none', color: null };
  globalThis.__plan = plan;
  run(`state.picked = null; state.events = [__plan]; render(); openEditor(__plan)`);
  fetches.length = 0;
  $('f-delete').click();
  await sleep(10);
  ok('deleting asks nothing', !$('ask').open);
  ok('the event is gone at once', run('state.events.length') === 0 && !$('editor').open);
  const undo = $('toast').children.find((c) => c.className === 'toast-action');
  ok('with an undo in the toast', !!undo && undo.textContent === run(`t('toast.undo')`), $('toast').textContent);
  ok('nothing goes to the server yet', !fetches.some((f) => f.method === 'DELETE'));
  undo.click();
  ok('undo brings it back', run('state.events.length') === 1 && run('state.events[0].id') === 'undo-me');
  await run('sendDelete()');
  ok('and nothing is ever deleted on the server', !fetches.some((f) => f.method === 'DELETE'));

  run(`openEditor(__plan)`);
  $('f-delete').click();
  await sleep(10);
  await run('sendDelete()'); // 몇 초가 지난 것처럼
  ok('left alone, the delete reaches the server', fetches.some((f) => f.method === 'DELETE' && f.url === '/api/events/undo-me'), fetches);

  globalThis.__plan = { ...plan, id: 'every-month', repeat: 'monthly' };
  run(`state.events = [__plan]; openEditor(__plan)`);
  $('f-delete').click();
  await sleep(10);
  ok('a monthly event still asks first — it goes from every month', $('ask').open);
  $('ask-no').click();
  await sleep(10);
  ok('and saying no keeps it', run('state.events.length') === 1);
  run(`$('editor').close(); state.events = []; render()`);
}

/* 사용법이 지금 동작과 맞게 — 구글 로그인이라 비밀번호 이야기가 없고, 초대는 첫 화면에서 */
{
  const packs = run('Object.keys(I18N)');
  ok('the guide no longer talks about a password to write down',
    packs.every((l) => !/password|비밀번호|パスワードは|密码|contraseña|mot de passe|Passwort|senha|пароль/i.test(run(`I18N['${l}']['guide.setup6.p1']`).replace(/no password|비밀번호가 없|忘れるパスワードはありません|没有会忘记的密码|no hay contraseña|pas de mot de passe|kein Passwort|não há senha|нет пароля/i, ''))));
  ok('and points to the invite on the home screen', run(`I18N.ko['guide.setupInvite.p1']`).includes(run(`I18N.ko['home.inviteGo']`)));
  ok('its picture shows signed-in devices, not a password button', !readFileSync('public/index.html', 'utf8').includes('data-i18n="settings.changePassword"></text>'));
}

/* 밤 테마는 체크 상자 같은 기본 부품도 어둡게 */
{
  const css = readFileSync('public/style.css', 'utf8');
  const night = css.slice(css.indexOf('[data-theme="night"] {'), css.indexOf('}', css.indexOf('[data-theme="night"] {')));
  ok('the night theme asks the browser for dark built-in controls', /color-scheme:\s*dark/.test(night));
}

/* 사용법 "처음 설정" — 첫 진입에서 이미 한 것(이름·설치)은 빼고 남은 할 일 셋, 끝난 건 숨기고 다시 셉니다 */
{
  const html = readFileSync('public/index.html', 'utf8');
  const setup = html.slice(html.indexOf('id="guide-setup"'), html.indexOf('id="guide-use"'));
  const steps = [...setup.matchAll(/data-step="([a-z]+)"/g)].map((m) => m[1]);
  ok('the setup tab is three steps: invite, the day you met, notifications', JSON.stringify(steps) === '["invite","since","push"]', steps);
  ok('without the name or the install it already did',
    !/settings\.appName|settings\.people|guide\.addToHome|install\./.test(setup));
  ok('"day to day" explains the "Us" tab after coming-up, before looks', /guide\.use5\.h[\s\S]*guide\.useUs\.h[\s\S]*guide\.setup4\.h/.test(html.slice(html.indexOf('id="guide-use"'))));
  ok('and every language has those words', run('Object.keys(I18N)').every((l) => ['h', 'p1', 'p2', 'p3', 'fig1'].every((k) => run(`I18N['${l}']['guide.useUs.${k}']`))));
  ok('looks, language and account moved to "day to day"', /guide\.setup4\.h[\s\S]*guide\.setup5\.h[\s\S]*guide\.setup6\.h/.test(html.slice(html.indexOf('id="guide-use"'))));

  const fake = steps.map((step) => { const el = new El('section'); el.dataset.step = step; const n = new El('span'); el.querySelector = () => n; el.n = n; return el; });
  $('guide-setup').querySelectorAll = () => fake;
  run(`state.paired = true; state.settings.since = '2024-02-14'; renderSetupSteps()`);
  ok('with them in and the day set, only notifications is left, as step 1',
    fake[0].hidden && fake[1].hidden && !fake[2].hidden && fake[2].n.textContent === '1');
  run(`state.paired = false; state.settings.since = null; renderSetupSteps()`);
  ok('alone with no day, all three show as 1, 2, 3', fake.every((f, i) => !f.hidden && f.n.textContent === String(i + 1)));
  run(`state.paired = true; state.settings.since = '2024-02-14'; pushSub = { endpoint: 'x' }`);
  ok('with notifications already on, the notification step is gone too', run('renderSetupSteps()') === 0 && fake.every((f) => f.hidden));
  run('openGuide("setup")');
  ok('and with nothing left the guide opens on "day to day"', $('guide-setup').hidden && !$('guide-use').hidden);
  run(`$('guide').close(); pushSub = null; state.paired = false; state.settings.since = null`);
  $('guide-setup').querySelectorAll = () => [];
  run('state.paired = true');
}

/* 토스트 글자는 어느 테마에서나 어두운 바탕 위의 흰색 — 밤 테마에서 --on-accent(어두운 색)로 묻혔습니다 */
{
  const css = readFileSync('public/style.css', 'utf8');
  const rule = (sel) => css.slice(css.indexOf(sel + ' {'), css.indexOf('}', css.indexOf(sel + ' {')));
  ok('toast text is white on every theme', /color:\s*#fff/.test(rule('.toast')) && !/color:\s*var\(--on-accent\)/.test(rule('.toast')) && /color:\s*#fff/.test(rule('.toast-action')));
}

/* 혼자일 땐 상대 이름 칸을 비워 둡니다(상대가 들어와 정함), 내 이름은 혼자여도 저장됩니다 */
{
  run(`state.me = 'a'; state.paired = false; state.settings.names = { a: '미나', b: '' }; fillSettings()`);
  ok('alone, the partner name box waits for them', $('s-name-b').disabled && $('s-name-b').placeholder === run(`t('settings.partnerLater')`));
  ok('and my own stays open', !$('s-name-a').disabled);
  fetches.length = 0;
  $('s-name-a').value = '미나야';
  run('saveNames(0)');
  await sleep(30);
  const sent = fetches.filter((f) => f.url === '/api/settings' && f.method === 'PATCH').map((f) => JSON.parse(f.body).names);
  ok('renaming myself while alone is saved (it used to wait for both names)', sent.length === 1 && JSON.stringify(sent[0]) === JSON.stringify({ a: '미나야' }), sent);
  ok('without touching the other seat', run('state.settings.names.b') === '');
  run(`state.paired = true; state.settings.names = { a: '미나야', b: '레오' }; fillSettings()`);
  ok('once they are in, their name box opens', !$('s-name-b').disabled);
  fetches.length = 0;
  $('s-name-b').value = '레오야';
  run('saveNames(0)');
  await sleep(30);
  const sent2 = fetches.filter((f) => f.url === '/api/settings' && f.method === 'PATCH').map((f) => JSON.parse(f.body).names);
  ok('changing their name sends only theirs', sent2.length === 1 && JSON.stringify(sent2[0]) === JSON.stringify({ b: '레오야' }), sent2);
}

/* "100일과 기념일" 체크는 처음 만난 날이 있어야 보입니다 / 사진이 없으면 빈 창 없이 바로 고르기 */
{
  run(`state.settings.since = null; fillSettings()`);
  ok('no day you met, no milestones switch', $('s-milestones-row').hidden);
  run(`state.settings.since = '2023-05-14'; fillSettings()`);
  ok('with the day, the switch is there', !$('s-milestones-row').hidden);
  let picked = 0;
  $('s-photo-file').click = () => { picked++; };
  run(`state.photos = []; $('photos').close()`);
  $('s-photos-open').click();
  ok('with no photos yet, "photos" goes straight to picking them', picked === 1 && !$('photos').open);
  run(`state.photos = ['p1']`);
  $('s-photos-open').click();
  ok('with some, it opens the photo box as before', $('photos').open && picked === 1);
  run(`$('photos').close(); state.photos = []`);
  delete $('s-photo-file').click;
}

/* 설정은 자주 쓰는 것부터 — 두 사람·처음 만난 날·알림이 위, 언어·시간대·앱 이름은 아래 (초대는 첫 화면 카드로, 10/27) */
{
  const html = readFileSync('public/index.html', 'utf8');
  const basic = html.slice(html.indexOf('id="s-pane-basic"'), html.indexOf('id="s-pane-design"'));
  const at = (key) => basic.indexOf(`data-i18n="settings.${key}"`);
  const order = ['people', 'since', 'push', 'install', 'language', 'holidays', 'timezone', 'appName', 'greeting', 'account'];
  ok('settings put the everyday things first', order.every((key, i) => at(key) >= 0 && (i === 0 || at(order[i - 1]) < at(key))),
    order.map((key) => [key, at(key)]));
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
