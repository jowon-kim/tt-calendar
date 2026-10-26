'use strict';

/* ── 작은 도구들 ─────────────────────────── */
const $ = (id) => document.getElementById(id);
let WEEK = [];   // 요일 이름. 언어가 정해질 때 Intl에서 채웁니다
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const shortDate = (s) => { const d = parse(s); return `${d.getMonth() + 1}.${d.getDate()}`; }; // "9.15"
const TODAY = ymd(new Date());

/* 기본 아이콘 (owner별 색은 부모 클래스가 배경으로) */
/* ── 달력 사진 ───────────────────────────── */
/* 전부 설정에서 넣은 것들입니다. 한 장도 없으면 기본 아이콘이 대신 나옵니다. */
let photoUrls = [];

/** state.photos가 바뀔 때마다 불러서 다시 맞춥니다. */
function refreshPhotos() {
  photoUrls = state.photos.map((id) => `/api/photos/${id}`);
}

/* 같은 일정은 늘 같은 사진이 나오도록 문자열을 번호로. 사진이 없으면 -1. */
function photoIndex(key) {
  if (!photoUrls.length) return -1;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % photoUrls.length;
}

/* 목록 하나에 달력 사진을 골고루 나눠 주는 사람.
   덜 나온 사진부터 집되, 같은 횟수면 일정마다 다른 순서로 고르고,
   바로 윗줄과는 겹치지 않게 합니다. 6장이 거의 같은 횟수로 나옵니다. */
function photoDealer() {
  const count = photoUrls.length;
  const used = new Array(count).fill(0);
  let prev = -1;
  return (date, item) => {
    if (!count) return -1;
    const seed = photoIndex(`${item.event?.id ?? item.title}|${date}`);
    let pick = -1;
    for (let i = 0; i < count; i++) {
      const n = (seed + i) % count;
      if (n === prev) continue;
      if (pick === -1 || used[n] < used[pick]) pick = n;
    }
    if (pick === -1) pick = (prev + 1) % count; // 사진이 한 장뿐일 때
    used[pick] += 1;
    prev = pick;
    return pick;
  };
}

function budIcon(cls) {
  const span = document.createElement('span');
  span.className = `bud ${cls}`;
  span.innerHTML = cls === 'milestone'
    ? `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 20.8 6.4 18l1.2-5.6L3.4 8.6 9 8z" fill="var(--gold-ink)"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none">
         <path d="M12 4 C10.5 6.2 9.6 7.6 9.4 9" stroke="var(--stem)" stroke-width="1.3" stroke-linecap="round"/>
         <path d="M12 4 C13.5 6.2 14.4 7.6 14.6 9" stroke="var(--stem)" stroke-width="1.3" stroke-linecap="round"/>
         <path d="M12 4.5 C13.8 2.8 16 3 16.6 4 C16.2 6 13.8 6.8 12 4.5Z" fill="var(--leaf)"/>
         <circle cx="9.4" cy="11.5" r="3.4" fill="${cls === 'a' ? 'var(--cherry)' : cls === 'b' ? 'var(--plum)' : 'var(--leaf)'}"/>
         <circle cx="14.6" cy="11.5" r="3.4" fill="${cls === 'a' ? 'var(--cherry)' : cls === 'b' ? 'var(--plum)' : 'var(--leaf)'}"/>
         <circle cx="8.4" cy="10.6" r=".9" fill="var(--on-accent)" opacity=".6"/>
       </svg>`;
  return span;
}

/* 요일 이름은 Intl이 줍니다 — 언어를 하나 더 넣어도 여기 적을 게 없습니다.
   2024-01-07이 일요일이라 거기서 이레를 셉니다. */
function refreshWeekNames() {
  const short = i18n.dateFmt({ weekday: 'short' });
  const sunday = new Date(2024, 0, 7);
  WEEK = Array.from({ length: 7 }, (_, i) => short.format(addDays(sunday, i)));
  document.querySelectorAll('[data-week]').forEach((el) => {
    el.textContent = WEEK[Number(el.dataset.week)];
  });
}

function label(dateStr, withYear = true) {
  const d = parse(dateStr);
  return i18n.dateFmt(withYear
    ? { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
    : { month: 'long', day: 'numeric', weekday: 'long' }).format(d);
}

/* 24시간 "HH:MM" → 그 언어가 쓰는 표기 ("오후 6:30" · "6:30 PM") */
function prettyTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return i18n.dateFmt({ hour: 'numeric', minute: '2-digit' })
    .format(new Date(2000, 0, 1, h, m));
}

/* 시작 시각(+ 끝 시각)을 "오후 6:00" 또는 "오후 6:00 ~ 오후 8:00" 으로 */
function prettyTimeRange(t, endT) {
  if (!t) return null;
  return endT ? `${prettyTime(t)} ~ ${prettyTime(endT)}` : prettyTime(t);
}

/** action을 주면 토스트 안에 단추 하나(예: 되돌리기)를 달고 조금 더 오래 둡니다 */
function toast(message, action) {
  const el = $('toast');
  el.textContent = message;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-action';
    b.textContent = action.label;
    b.addEventListener('click', () => {
      clearTimeout(toast.timer);
      if (el.hidePopover) { try { el.hidePopover(); } catch { /* 이미 닫힘 */ } }
      el.hidden = true;
      action.run();
    });
    el.append(' ', b);
  }
  // 여러 줄이면 알약 모양(999px)이 옆으로만 뚱뚱해져서 모서리를 줄입니다
  el.classList.toggle('multi', message.includes('\n'));
  clearTimeout(toast.timer);
  // 모달 창이 열려 있어도 그 위로 보이게 popover로 띄웁니다 (안 되는 브라우저는 그냥 표시)
  el.hidden = false;
  if (el.showPopover) {
    try { el.hidePopover(); } catch { /* 안 떠 있었으면 그만 */ }
    try { el.showPopover(); } catch { /* popover가 막혀도 화면엔 남음 */ }
  }
  toast.timer = setTimeout(() => {
    if (el.hidePopover) { try { el.hidePopover(); } catch { /* 이미 닫힘 */ } }
    el.hidden = true;
  }, action ? UNDO_MS : 2200);
}

const UNDO_MS = 5000; // 지운 일정을 되돌릴 수 있는 시간

/* 방금 펼쳐진 칸이 화면 밖이면 이것도 "눌러도 아무 일 없네"로 보입니다 */
function bringIntoView(el) {
  if (!el || el.hidden) return;
  el.scrollIntoView({ block: 'nearest' });
}

/* 잘못 적힌 곳을 알려주고, 그 자리로 화면을 옮겨 눈에 띄게 흔들어 줍니다.
   안내가 화면 밖에 있으면 "눌러도 아무 일도 없네"로 보이기 때문입니다.
   칸은 하나만 줘도 되고, 여러 곳이 틀렸으면 배열로 줘도 됩니다. */
function pointOut(message, field) {
  toast(message);
  const marks = [field].flat().filter(Boolean);
  if (!marks.length) return;

  // 앞서 짚어둔 칸을 먼저 지웁니다. 타이머가 하나뿐이라, 다음 안내가 뜨면
  // 앞 칸을 지우기로 한 예약이 취소돼 빨간 테두리가 그대로 눌러앉았습니다.
  clearTimeout(pointOut.timer);
  (pointOut.marked || []).forEach((el) => el.classList.remove('wrong'));

  // 부드러운 스크롤은 화면이 잠깐 가려지기만 해도 그냥 멈춰 버립니다.
  // 그러면 안내가 화면 밖에 남아 "눌러도 아무 일 없네"가 되므로 즉시 옮깁니다.
  // 'start'라 이미 보이던 칸도 위로 끌어올려, 화면이 움직인 게 눈에 보입니다.
  // 라벨('무슨 일')까지 같이 보이도록 칸을 감싼 덩어리째 옮깁니다.
  // 여러 곳이 틀렸을 땐 안내 문구 첫 줄이 가리키는 칸으로 갑니다.
  const first = marks[0];
  // 다이얼로그 머리말은 sticky라 늘 맨 위에 붙어 있는데 scrollIntoView는 그걸
  // 모릅니다. 그냥 'start'로 옮기면 짚어준 칸이 머리말 뒤로 숨어버려서,
  // 화면은 움직였는데 정작 그 칸은 안 보이고 아래쪽만 보이게 됩니다.
  const scroller = first.closest('.dialog');
  const head = scroller?.querySelector('.dialog-head');
  if (head) scroller.style.scrollPaddingTop = head.offsetHeight + 'px';
  (first.closest('.field, .time-field') || first).scrollIntoView({ block: 'start' });

  marks.forEach((el) => {
    el.classList.remove('wrong');
    void el.offsetWidth;           // 연달아 틀려도 매번 다시 흔들리게
    el.classList.add('wrong');
  });
  pointOut.marked = marks;
  pointOut.timer = setTimeout(() => marks.forEach((el) => el.classList.remove('wrong')), 1100);
  first.focus?.({ preventScroll: true });
}

/* 브라우저 기본 confirm 대신 우리 창으로 물어봅니다.
   password면 "예"의 답은 적은 비밀번호, google이면 "예" 대신 구글 버튼이 뜨고 답은 구글이 준 토큰입니다. */
function ask(message, yesLabel = t('common.yes'), { password = false, google = false } = {}) {
  return new Promise((resolve) => {
    const box = $('ask');
    const yes = $('ask-yes');
    const no = $('ask-no');
    const secret = $('ask-password');
    const withGoogle = $('ask-google');
    $('ask-text').textContent = message;
    yes.textContent = yesLabel;
    yes.hidden = google;
    secret.hidden = !password;
    secret.value = '';
    withGoogle.hidden = !google;

    const done = (answer) => {
      yes.onclick = null;
      no.onclick = null;
      box.oncancel = null;
      box.onclick = null;
      box.close();
      yes.hidden = false;
      withGoogle.hidden = true;
      withGoogle.replaceChildren();
      resolve(answer && password ? secret.value : answer);
      secret.value = '';
    };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
    box.oncancel = (e) => { e.preventDefault(); done(false); };
    box.onclick = (e) => { if (e.target === box) done(false); };
    box.showModal();
    // 구글을 못 불러오면 "예"가 없는 창이 되니, 왜 안 되는지라도 적어둡니다
    if (google) {
      googleButton(withGoogle, (credential) => done(credential))
        .then((shown) => { if (!shown) withGoogle.textContent = t('error.googleOff'); });
    }
    (password ? secret : no).focus();
  });
}

/* 같은 요청이 두 번 나가지 않게 — 처리 중에는 조용히 무시합니다 */
let sending = false;
async function once(button, work) {
  if (sending) return;
  sending = true;
  if (button) button.disabled = true;
  try {
    await work();
  } finally {
    sending = false;
    if (button) button.disabled = false;
  }
}

/* ── 서버 통신 ───────────────────────────── */
/* 로그인은 서버가 심어준 쿠키로 따라다닙니다(HttpOnly라 여기서는 못 읽어요).
   그래서 "로그인해 있는지"는 따로 적어둔 표시로만 압니다 — 인트로 동안 달력을
   미리 받아올지 정하는 데만 씁니다. 틀려도 서버가 401로 바로잡습니다. */
const SIGNED_IN = 'diary_signed_in';
const signedIn = () => localStorage.getItem(SIGNED_IN) === '1';

const api = {
  async call(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      // 인터넷이 끊겼거나 서버에 닿지 못한 경우 — 영어 오류 대신 우리 말로
      throw new Error(t('error.offline'));
    }
    if (res.status === 401) { signOut(); throw new Error(t('error.relogin')); }
    if (!res.ok) {
      const info = await res.json().catch(() => ({}));
      /* 서버는 문구가 아니라 키를 돌려줍니다. 모르는 키는 t()가 그대로
         돌려주니, 옛 서버가 보낸 문장도 그냥 보입니다. */
      throw new Error(info.error ? t(info.error) : t('error.saveFailed'));
    }
    return res.status === 204 ? null : res.json();
  },
};

/* ── 상태 ────────────────────────────────── */
const state = {
  events: [],
  settings: {
    title: '',        // 비어 있으면 그 언어의 기본 이름을 씁니다
    subtitle: '',
    theme: 'peach',
    locale: '',       // 서버가 알려주기 전에는 브라우저 언어를 씁니다
    region: 'none',   // 공휴일 묶음 (public/holidays/)
    timezone: '',     // 오늘 일정 알림의 기준. 비어 있으면 브라우저 것을 씁니다
    names: { a: '', b: '' },
    since: null,
    showMilestones: true,
  },
  cursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  picked: null,
  me: null,       // 'a' | 'b' — 로그인한 계정이 정합니다 (/api/state)
  login: '',
  hasPassword: true, // 구글로만 들어온 사람은 탈퇴할 때 비밀번호 대신 구글로 확인합니다
  paired: true,   // 상대가 들어왔는지. 아니면 설정이 초대 링크를 권합니다
  photos: [], // 설정에서 올린 달력 사진 id
  editing: null,
  formOwner: 'both',
  formColor: null, // null = 누구 일정인지의 색
  formRepeat: 'none',
  formTime: null, // "HH:MM" 또는 null (단일 시각 / 범위 시작)
  formEndTime: null, // "HH:MM" 또는 null (범위 끝, formTimeMode === 'range' 일 때만)
  formTimeMode: 'point', // 'point' | 'range'
};

/** 앱 이름은 설정값입니다. 상단 바·인트로·브라우저 탭·사용법 제목이 같이 따라갑니다. */
function renderTitle() {
  const title = state.settings.title || t('default.title');
  const sub = state.settings.subtitle || t('default.subtitle');
  /* 인트로와 로그인 화면은 서버에 묻기 전에 뜹니다. 다음에 열 때 쓰려고 적어두되,
     직접 정한 이름만 적습니다. 기본 이름까지 적으면 처음 뜬 언어의 이름이 굳어
     나중에 언어를 바꿔도 안 따라옵니다. */
  localStorage.setItem('diary_title', state.settings.title || '');
  localStorage.setItem('diary_sub', state.settings.subtitle || '');
  document.title = title;
  document.querySelectorAll('.app-name').forEach((el) => { el.textContent = title; });
  $('guide-title').textContent = t('guide.titleFor', { name: title });
  document.querySelectorAll('.app-sub').forEach((el) => { el.textContent = sub; });
}

/* 이름을 아직 안 적었으면 "나"와 "너"로 부릅니다. 누가 "나"인지는 보는 사람 기준이라,
   b 자리 사람의 화면에서는 b가 "나"입니다 — 자리마다 고정하면 상대 일정에 "나"가 붙습니다. */
const nameOf = (owner) => {
  if (owner !== 'a' && owner !== 'b') return t('app.both');
  const mine = state.me ? owner === state.me : owner === 'a';
  return state.settings.names[owner] || t(mine ? 'default.nameA' : 'default.nameB');
};

/* ── 일정 펼치기 (반복 / 여러 날) ─────────── */
function expand(from, to) {
  const map = new Map();
  const put = (dateStr, item) => {
    if (dateStr < from || dateStr > to) return;
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr).push(item);
  };

  for (const event of state.events) {
    const span = event.endDate ? diffDays(event.date, event.endDate) : 0;
    const start = parse(event.date);
    const starts = [];

    if (event.repeat === 'none') {
      starts.push(start);
    } else {
      const fromYear = parse(from).getFullYear();
      const toYear = parse(to).getFullYear();
      if (event.repeat === 'yearly') {
        for (let y = fromYear - 1; y <= toYear + 1; y++) {
          if (y < start.getFullYear()) continue;
          starts.push(new Date(y, start.getMonth(), start.getDate()));
        }
      } else {
        let cursor = new Date(parse(from).getFullYear(), parse(from).getMonth() - 1, 1);
        const stop = parse(to);
        while (cursor <= stop) {
          const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), start.getDate());
          if (candidate.getMonth() === cursor.getMonth() && candidate >= start) starts.push(candidate);
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        }
      }
    }

    for (const s of starts) {
      for (let i = 0; i <= span; i++) {
        put(ymd(addDays(s, i)), {
          event,
          owner: event.owner,
          color: event.color || null, // 고른 색이 있으면 누구 일정인지의 색 대신 (paintColor)
          title: event.title,
          time: span > 0 ? null : event.time,
          endTime: span > 0 ? null : event.endTime,
          part: span > 0 ? t('item.part', { i: i + 1, total: span + 1 }) : null,
          // 여러 날 일정이 이번에 시작하고 끝나는 날 — 달력 띠와 목록 한 줄이 씁니다
          start: span > 0 ? ymd(s) : null,
          end: span > 0 ? ymd(addDays(s, span)) : null,
          sortKey: (span > 0 || !event.time) ? '00:00' : event.time,
        });
      }
    }
  }

  // 100일 단위 / 매년 기념일
  if (state.settings.showMilestones && state.settings.since) {
    const since = state.settings.since;
    const startGap = Math.max(0, diffDays(since, from));
    for (let n = Math.floor(startGap / 100) * 100; n <= diffDays(since, to) + 100; n += 100) {
      if (n <= 0) continue;
      // 만난 날이 1일째 — 100일은 만난 날 + 99일
      put(ymd(addDays(parse(since), n - 1)), {
        milestone: true, owner: 'milestone', title: t('milestone.days', { n, count: n }), sortKey: '00:00',
      });
    }
    const sinceDate = parse(since);
    for (let y = parse(from).getFullYear(); y <= parse(to).getFullYear(); y++) {
      const years = y - sinceDate.getFullYear();
      if (years <= 0) continue;
      put(ymd(new Date(y, sinceDate.getMonth(), sinceDate.getDate())), {
        milestone: true, owner: 'milestone', title: t('milestone.years', { n: years, count: years }), sortKey: '00:00',
      });
    }
  }

  for (const list of map.values()) {
    list.sort((x, y) => x.sortKey.localeCompare(y.sortKey) || x.title.localeCompare(y.title));
  }
  return map;
}

/* ── 공휴일 ──────────────────────────────── */
/* 어느 나라 공휴일을 쓸지는 설정입니다. 묶음 하나가 public/holidays/ 파일
   하나이고, 날짜 → 문구 키를 돌려줍니다. 새 나라를 넣으려면 그 폴더를 보세요. */
/**
 * 달력에 빨갛게 뜨는 날들. 서버에 묻지 않고 여기서 셉니다.
 *
 * 양력 공휴일은 날짜가 고정이지만 설날·추석·부처님 오신 날은 음력이라
 * 계산으로 못 구합니다 — 한국천문연구원이 발표한 양력 날짜를 적어뒀어요.
 * 표에 없는 해는 양력 공휴일만 뜹니다.
 */
/** 그날의 공휴일 이름, 아니면 null. */
function holidayOn(dateStr) {
  const set = window.HOLIDAYS[state.settings.region] || window.HOLIDAYS.none;
  const key = set.holidays(Number(dateStr.slice(0, 4)), { ymd, parse, addDays }).get(dateStr);
  return key ? t(key) : null;
}

/* ── 달력 그리기 ─────────────────────────── */

/* 여러 날 일정은 칸마다 점을 찍지 않고 칸을 이어 띠로 그립니다. 열하루짜리가
   점 열한 개가 되면 달력이 그걸로 도배됩니다. 한 칸에 띠는 이만큼까지 쌓고,
   넘치는 것은 +n에 셉니다. */
const SPAN_LANES = 5;
/* 띠가 이 줄 수를 넘는 주는 띠를 얇게 그려서, 다섯 줄이 쌓여도 그 주만 너무 길어지지 않게 */
const SPAN_DENSE = 3;
const spanKey = (item) => `${item.event.id}|${item.start}`;

/**
 * 띠마다 몇 번째 줄에 놓일지. 먼저 시작하는 것, 같이 시작하면 긴 것부터 비어 있는
 * 가장 윗줄을 잡습니다. 주마다 따로 부릅니다 — 한 주 안에서는 줄이 그대로라 띠가
 * 꺾이지 않고, 다음 주에는 앞서 끝난 띠가 비운 윗줄로 올라가 빈 줄이 남지 않아요.
 */
function spanLanes(map) {
  const spans = new Map();
  for (const list of map.values()) {
    for (const item of list) if (item.start && !spans.has(spanKey(item))) spans.set(spanKey(item), item);
  }
  const taken = new Map();
  const lanes = new Map();
  [...spans.values()]
    .sort((x, y) => x.start.localeCompare(y.start) || y.end.localeCompare(x.end))
    .forEach((item) => {
      const days = [...map.keys()].filter((d) => d >= item.start && d <= item.end);
      let lane = 0;
      while (days.some((d) => taken.get(d)?.has(lane))) lane++;
      days.forEach((d) => { if (!taken.has(d)) taken.set(d, new Set()); taken.get(d).add(lane); });
      lanes.set(spanKey(item), lane);
    });
  return lanes;
}

/* 한 칸의 띠 조각들. 같은 주의 칸은 모두 같은 줄 수를 그려야 띠 높이가 맞습니다. */
function spanBars(date, key, items, lanes, rowLanes) {
  const box = document.createElement('span');
  box.className = rowLanes >= SPAN_DENSE ? 'spans dense' : 'spans';
  const byLane = [];
  items.forEach((item) => { byLane[lanes.get(spanKey(item))] = item; });

  for (let lane = 0; lane < rowLanes; lane++) {
    const bar = document.createElement('span');
    const item = byLane[lane];
    if (!item) { bar.className = 'bar vacant'; box.append(bar); continue; }
    bar.className = `bar ${item.owner}`;
    paintColor(bar, item);
    if (key === item.start) bar.classList.add('from');
    if (key === item.end) bar.classList.add('to');
    // 제목은 시작하는 칸과, 주가 바뀌어 새 줄이 시작되는 칸에만 답니다
    if (key === item.start || date.getDay() === 0) {
      const text = document.createElement('span');
      text.className = 'bar-label';
      text.textContent = item.title;
      text.style.setProperty('--run', Math.min(diffDays(key, item.end), 6 - date.getDay()) + 1);
      bar.append(text);
    }
    box.append(bar);
  }
  return box;
}

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const month = first.getMonth(); // monthIndex가 -1이나 12처럼 범위를 벗어나도 정규화됨
  const gridStart = addDays(first, -first.getDay());
  const daysInMonth = new Date(first.getFullYear(), month + 1, 0).getDate();
  const cells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const gridEnd = addDays(gridStart, cells - 1);

  const map = expand(ymd(gridStart), ymd(gridEnd));
  const frag = document.createDocumentFragment();

  // 주마다 띠 줄을 새로 잡고, 그 주에 몇 줄이 필요한지 셉니다
  const weeks = [];
  for (let w = 0; w < cells / 7; w++) {
    const days = new Map();
    for (let d = 0; d < 7; d++) {
      const key = ymd(addDays(gridStart, w * 7 + d));
      days.set(key, map.get(key) || []);
    }
    const lanes = spanLanes(days);
    weeks.push({ lanes, rows: lanes.size ? Math.min(Math.max(...lanes.values()) + 1, SPAN_LANES) : 0 });
  }

  for (let i = 0; i < cells; i++) {
    const date = addDays(gridStart, i);
    const key = ymd(date);
    const items = map.get(key) || [];
    const spanning = items.filter((item) => item.start);
    const dotted = items.filter((item) => !item.start);

    const holiday = holidayOn(key);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day';
    cell.dataset.date = key;
    if (date.getMonth() !== month) cell.classList.add('out');
    if (date.getDay() === 0) cell.classList.add('sun');
    if (date.getDay() === 6) cell.classList.add('sat');
    if (holiday) cell.classList.add('holiday');
    if (key === TODAY) cell.classList.add('today');
    if (key === state.picked) cell.classList.add('picked');
    cell.setAttribute('aria-label', holiday
      ? t('app.cellLabelHoliday', { day: label(key), holiday, count: items.length })
      : t('app.cellLabel', { day: label(key), count: items.length }));

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = date.getDate();
    cell.append(num);

    if (holiday) {
      const name = document.createElement('span');
      name.className = 'holi';
      name.textContent = holiday;
      cell.append(name);
    }

    const { lanes, rows } = weeks[Math.floor(i / 7)];
    if (spanning.length) cell.append(spanBars(date, key, spanning, lanes, rows));

    const branch = document.createElement('span');
    branch.className = 'branch';
    const hidden = Math.max(0, dotted.length - 3)
      + spanning.filter((item) => lanes.get(spanKey(item)) >= SPAN_LANES).length;
    dotted.slice(0, 3).forEach((item, index) => {
      const dot = document.createElement('span');
      dot.className = `cherry-dot ${item.milestone ? 'milestone' : item.owner}`;
      paintColor(dot, item);
      dot.style.animationDelay = `${index * 50}ms`;
      branch.append(dot);
    });
    if (hidden) {
      const more = document.createElement('span');
      more.className = 'more';
      more.textContent = `+${hidden}`;
      branch.append(more);
    }
    cell.append(branch);

    cell.addEventListener('click', () => openSheet(key));
    frag.append(cell);
  }

  return frag;
}

function fillGrid(id, year, monthIndex) {
  $(id).replaceChildren(buildMonthCells(year, monthIndex));
}

function render() {
  const year = state.cursor.getFullYear();
  const month = state.cursor.getMonth();
  const lbl = $('month-label');
  lbl.replaceChildren();
  lbl.append(document.createTextNode(
    t('app.monthLabel', { month: i18n.dateFmt({ month: 'long' }).format(state.cursor) })));
  const yr = document.createElement('span');
  yr.className = 'yr';
  yr.textContent = year;
  lbl.append(yr);

  fillGrid('grid', year, month);
  fillGrid('grid-prev', year, month - 1);
  fillGrid('grid-next', year, month + 1);

  renderUpcoming();
  renderDday();
}

function renderDday() {
  const el = $('dday');
  // 처음 만난 날이 없으면 셀 것도 없습니다. 정하는 곳은 옆 톱니바퀴 안입니다.
  if (!state.settings.since) { el.hidden = true; return; }
  const days = diffDays(state.settings.since, TODAY) + 1;
  const next = Math.ceil((days + 1) / 100) * 100;
  el.hidden = false;
  el.textContent = t('app.dday', {
    days: days.toLocaleString(i18n.getLocale()), next, left: next - days,
  });
}

function renderUpcoming() {
  const from = TODAY;
  const to = ymd(addDays(new Date(), 45));
  const map = expand(from, to);
  const list = $('upcoming-list');
  list.replaceChildren();
  // 다음 할 일 하나를 첫 화면 맨 위에 — 혼자면 상대 부르기, 둘이 됐는데 처음 만난 날이 없으면 그 날 넣기.
  // 같은 자리, 같은 모양이고 한 번에 하나만 섭니다
  const nudge = nextNudge();
  if (nudge) list.append(nudge);

  /* 여러 날 일정은 처음 보이는 날에 한 줄만 — 날마다 한 줄씩이면 열하루짜리 하나가
     목록을 다 차지해서 다른 일정이 밀려납니다. 이미 시작했으면 오늘 줄에 섭니다.
     반복 일정도 가장 가까운 한 번만 — 다음 달 것은 "매달"이라고 적어두면 압니다. */
  const listed = new Set();
  const once = (item) => (item.event && item.event.repeat !== 'none' ? `every|${item.event.id}`
    : item.start ? spanKey(item) : null);
  const rows = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => [date, items.filter((item) => {
      const key = once(item);
      if (!key) return true;
      if (listed.has(key)) return false;
      listed.add(key);
      return true;
    })])
    .filter(([, items]) => items.length)
    .slice(0, 12);
  if (!rows.length) {
    // 카드가 서 있으면 그것 하나만 — "+ 로 심어볼까요"까지 같이 두면 할 일이 둘이 됩니다
    if (!nudge) list.append(emptyState(t('upcoming.emptyTitle'), t('upcoming.emptyHint'), TODAY));
    return;
  }

  const deal = photoDealer();
  for (const [date, items] of rows) {
    for (const item of items) list.append(entryRow(date, item, true, deal(date, item)));
  }
}

/** 첫 화면 맨 위에 설 카드 하나, 없으면 null */
function nextNudge() {
  if (!state.me) return null;
  if (!state.paired) {
    return nudgeCard('home-invite', t('home.inviteTitle'), t('home.inviteHint'), t('home.inviteGo'), sendInvite);
  }
  if (!state.settings.since) {
    // 누르면 바로 연도 고르기 — 비어 있으면 datePicker가 연도부터 엽니다
    return nudgeCard('home-since', t('home.sinceTitle'), t('home.sinceHint'), t('home.sinceGo'), () =>
      datePicker.open('s-since', (key) => saveSetting({ since: key }, 0)));
  }
  return null;
}

/** 할 일 카드 — 제목, 한 줄 설명, 단추 하나 */
function nudgeCard(id, titleText, hintText, label, onTap) {
  const li = document.createElement('li');
  li.className = 'invite-card';
  const text = document.createElement('div');
  text.className = 'invite-card-text';
  const title = document.createElement('strong');
  title.textContent = titleText;
  const hint = document.createElement('span');
  hint.textContent = hintText;
  text.append(title, hint);
  const go = document.createElement('button');
  go.type = 'button';
  go.id = id;
  go.className = 'btn btn-solid';
  go.textContent = label;
  go.addEventListener('click', () => onTap(go));
  li.append(text, go);
  return li;
}

function emptyState(line1, line2, key) {
  const li = document.createElement('li');
  li.className = 'empty';
  const at = photoIndex(key ?? TODAY);
  const box = document.createElement('div');
  box.className = 'empty-line';
  box.append(document.createTextNode(line1));
  if (line2) { box.append(document.createElement('br')); box.append(document.createTextNode(line2)); }

  if (at >= 0) {
    const img = document.createElement('img');
    img.className = 'empty-photo';
    img.src = photoUrls[at];
    img.alt = '';
    li.append(img);
  }
  li.append(box);
  return li;
}

function entryRow(date, item, showDate, photoNo) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'entry';

  const kind = item.milestone ? 'milestone' : item.owner;
  const tag = document.createElement('span');
  tag.className = `tag ${kind}`;
  paintColor(tag, item);
  const photoAt = photoNo ?? photoIndex(`${item.event?.id ?? item.title}|${date}`);
  if (photoAt < 0) {
    tag.append(budIcon(kind));
  } else {
    const photo = document.createElement('img');
    photo.className = 'tag-photo';
    photo.src = photoUrls[photoAt];
    photo.alt = '';
    photo.width = 34;
    photo.height = 34;
    photo.loading = 'lazy';
    photo.decoding = 'async';
    tag.append(photo);
  }

  const body = document.createElement('div');
  body.className = 'entry-body';
  const title = document.createElement('div');
  title.className = 'entry-title';
  title.textContent = item.title;
  const meta = document.createElement('div');
  meta.className = 'entry-meta';
  const bits = [];
  if (item.milestone) bits.push(t('item.milestone'));
  else bits.push(nameOf(item.owner));
  // 목록엔 반복 일정이 한 번만 서니까 돌아온다는 걸 적어줍니다
  if (showDate && item.event?.repeat === 'monthly') bits.push(t('editor.monthly'));
  if (showDate && item.event?.repeat === 'yearly') bits.push(t('editor.yearly'));
  if (item.time) bits.push(prettyTimeRange(item.time, item.endTime));
  // 목록에서는 한 줄로 합쳐 기간을, 하루 보기에서는 그날이 며칠째인지를 적습니다
  if (item.start && showDate) bits.push(`${shortDate(item.start)} ~ ${shortDate(item.end)}`);
  else if (item.part) bits.push(item.part);
  if (item.event?.memo) bits.push(item.event.memo.split('\n')[0].slice(0, 20));
  meta.textContent = bits.join(' · ');
  body.append(title, meta);

  button.append(tag, body);

  if (showDate) {
    const when = document.createElement('span');
    when.className = 'entry-when';
    const gap = diffDays(TODAY, date);
    if (gap === 0) when.textContent = t('when.today');
    else if (gap === 1) when.textContent = t('when.tomorrow');
    else {
      when.innerHTML = shortDate(date)
      + `<small>${t('when.inDays', { n: gap, count: gap })}</small>`;
    }
    button.append(when);
  }

  button.addEventListener('click', () => {
    if (item.milestone) { openSheet(date); return; }
    openEditor(item.event, date);
  });

  li.append(button);
  return li;
}

/* ── 하루 보기 ───────────────────────────── */
function openSheet(date) {
  state.picked = date;
  const items = expand(date, date).get(date) || [];

  $('sheet-date').textContent = label(date, parse(date).getFullYear() !== new Date().getFullYear());
  const gap = diffDays(TODAY, date);
  const holiday = holidayOn(date);
  const when = gap === 0 ? t('day.today')
    : gap > 0 ? t('day.daysLeft', { n: gap, count: gap })
      : t('day.daysAgo', { n: -gap, count: -gap });
  $('sheet-note').textContent = holiday ? `${holiday} · ${when}` : when;

  const list = $('sheet-list');
  list.replaceChildren();
  if (!items.length) {
    list.append(emptyState(t('day.empty'), null, date));
  } else {
    const deal = photoDealer();
    items.forEach((item) => list.append(entryRow(date, item, false, deal(date, item))));
  }

  $('sheet').hidden = false;
  $('sheet-backdrop').hidden = false;
  render();
}

function closeSheet() {
  $('sheet').hidden = true;
  $('sheet-backdrop').hidden = true;
  state.picked = null;
  render();
}

/* ── 일정 색 ─────────────────────────────
   고른 색이 있으면 data-color를 달고, style.css가 누구 일정인지의 색 위에 덮어 칠합니다.
   기념일처럼 일정이 아닌 것엔 색이 없어요. */
function paintColor(el, item) {
  if (item.color && !item.milestone) el.dataset.color = item.color;
}

/** 제목 칸 오른쪽 동그라미에 지금 고른 색을 칠합니다 */
function showFormColor() {
  const button = $('f-color-btn');
  if (state.formColor) button.dataset.color = state.formColor;
  else delete button.dataset.color;
  button.setAttribute('aria-expanded', String(!$('f-color').hidden));
}

/** 색 고르기 — 맨 앞은 "기본"(누구 일정인지의 색), 나머지는 limits.js의 목록 */
function colorPicker(container, current, onPick) {
  container.replaceChildren();
  [null, ...globalThis.DIARY_LIMITS.eventColors].forEach((color) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'color-opt';
    if (color) option.dataset.color = color;
    option.setAttribute('role', 'radio');
    option.setAttribute('aria-checked', String(color === current));
    option.setAttribute('aria-label', t(color ? `color.${color}` : 'color.none'));
    option.title = option.getAttribute('aria-label');
    option.addEventListener('click', () => {
      onPick(color);
      [...container.children].forEach((c) => c.setAttribute('aria-checked', String(c === option)));
    });
    container.append(option);
  });
}

/* ── 누구/반복 세그먼트 ──────────────────── */
/** owners를 주면 그 항목만 보여줍니다 ("지금 나는"에는 '우리'가 없어야 해서). */
function ownerPicker(container, current, onPick) {
  container.replaceChildren();
  ['a', 'b', 'both'].forEach((owner) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'owner-opt';
    option.dataset.owner = owner;
    option.setAttribute('role', 'radio');
    option.setAttribute('aria-checked', String(owner === current));
    option.append(budIcon(owner));
    const text = document.createElement('span');
    text.textContent = nameOf(owner);
    option.append(text);
    option.addEventListener('click', () => {
      onPick(owner);
      [...container.children].forEach((c) => c.setAttribute('aria-checked', String(c.dataset.owner === owner)));
    });
    container.append(option);
  });
}

function bindRepeat() {
  const seg = $('f-repeat');
  [...seg.children].forEach((btn) => {
    btn.onclick = () => {
      state.formRepeat = btn.dataset.repeat;
      [...seg.children].forEach((c) => c.setAttribute('aria-checked', String(c === btn)));
      renderRepeatSummary();
    };
  });
  // 체크해야 아래에 매달/매년이 나옵니다
  $('f-repeat-on').addEventListener('change', (e) => {
    setRepeat(e.target.checked ? (markedRepeat() || 'monthly') : 'none');
    if (e.target.checked) bringIntoView($('f-repeat-wrap'));
  });
}
/* 지금 골라둔 주기 (체크를 껐다 켜도 기억) */
function markedRepeat() {
  const marked = [...$('f-repeat').children].find((c) => c.getAttribute('aria-checked') === 'true');
  return marked?.dataset.repeat || null;
}
function setRepeat(value) {
  const on = value !== 'none';
  state.formRepeat = value;
  $('f-repeat-on').checked = on;
  $('f-repeat-wrap').hidden = !on;
  const marked = on ? value : (markedRepeat() || 'monthly');
  [...$('f-repeat').children].forEach((c) =>
    c.setAttribute('aria-checked', String(c.dataset.repeat === marked)));
  renderRepeatSummary();
}

/**
 * 반복을 켜면 위에서 고른 날짜를 풀어 씁니다 — "매달 15일 ~ 25일", "매년 9월 15일".
 * 매달/매년 단추만 봐서는 여러 날 일정이 달마다 통째로 돌아온다는 게 안 보여서요.
 */
function renderRepeatSummary() {
  const summary = $('f-repeat-summary');
  const date = $('f-date').value;
  const repeat = state.formRepeat;
  summary.hidden = repeat === 'none' || !date;
  if (summary.hidden) return;

  const end = $('f-multi').checked && $('f-end').value > date ? $('f-end').value : null;
  const day = (s) => i18n.dateFmt({ day: 'numeric' }).format(parse(s));
  const monthDay = (s) => i18n.dateFmt({ month: 'long', day: 'numeric' }).format(parse(s));

  if (repeat === 'yearly') {
    summary.textContent = end
      ? t('editor.everyYearSpan', { start: monthDay(date), end: monthDay(end) })
      : t('editor.everyYear', { date: monthDay(date) });
    return;
  }
  if (!end) {
    summary.textContent = t('editor.everyMonth', { day: day(date) });
    return;
  }
  // 28일 ~ 다음 달 3일처럼 달을 넘기면 그렇다고 써줍니다. 한 달을 넘게 이어지면 날수로.
  const s = parse(date);
  const e = parse(end);
  const months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth();
  summary.textContent = months === 0 ? t('editor.everyMonthSpan', { start: day(date), end: day(end) })
    : months === 1 ? t('editor.everyMonthSpanNext', { start: day(date), end: day(end) })
    : t('editor.everyMonthLong', { start: day(date), days: diffDays(date, end) + 1 });
}

/* ── 커스텀 시간 고르기 ──────────────────── */
/* 시/분 릴 + 오전오후 한 벌을 만듭니다. 시작 시각과 끝 시각에 각각 하나씩 씁니다. */
function makeReelSet(hourReelId, minReelId, ampmId) {
  const r = {
    selHour: 6, selMin: 0, ampm: 'pm',
    hourReel: null, minReel: null,
    onChange() {},
    buildReels() {
      const hourReel = $(hourReelId);
      const minReel = $(minReelId);
      r.hourReel = hourReel;
      r.minReel = minReel;
      hourReel.replaceChildren();
      minReel.replaceChildren();
      const padTop = document.createElement('div'); padTop.className = 'reel-pad'; hourReel.append(padTop);
      for (let h = 1; h <= 12; h++) {
        const it = document.createElement('div');
        it.className = 'reel-item'; it.dataset.hour = h; it.textContent = h;
        it.onclick = () => { r.selHour = h; r.onChange(); r.scrollTo(hourReel, it); };
        hourReel.append(it);
      }
      hourReel.append(padTop.cloneNode());

      const padTopM = document.createElement('div'); padTopM.className = 'reel-pad'; minReel.append(padTopM);
      for (let m = 0; m < 60; m += 5) {
        const it = document.createElement('div');
        it.className = 'reel-item'; it.dataset.min = m; it.textContent = pad(m);
        it.onclick = () => { r.selMin = m; r.onChange(); r.scrollTo(minReel, it); };
        minReel.append(it);
      }
      minReel.append(padTopM.cloneNode());

      $(ampmId).querySelectorAll('button').forEach((b) => {
        b.onclick = () => { r.ampm = b.dataset.ampm; r.onChange(); };
      });

      r.watchScroll(hourReel, 'hour', 'selHour');
      r.watchScroll(minReel, 'min', 'selMin');
    },
    /* 굴리다 멈추면 한가운데 온 숫자가 골라집니다 (콕 집어 누르지 않아도 되게) */
    watchScroll(reel, dataKey, field) {
      let timer = null;
      reel.addEventListener('scroll', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const center = reel.scrollTop + reel.clientHeight / 2;
          let best = null;
          let bestGap = Infinity;
          for (const it of reel.querySelectorAll('.reel-item')) {
            const gap = Math.abs(it.offsetTop + it.clientHeight / 2 - center);
            if (gap < bestGap) { bestGap = gap; best = it; }
          }
          if (!best) return;
          const value = Number(best.dataset[dataKey]);
          if (r[field] === value) return;   // 눌러서 고른 값과 같으면 조용히 넘어감
          r[field] = value;
          r.onChange();
        }, 90);
      }, { passive: true });
    },
    scrollTo(reel, item) {
      reel.scrollTo({ top: item.offsetTop - reel.clientHeight / 2 + item.clientHeight / 2, behavior: 'smooth' });
    },
    scrollToSelected() {
      requestAnimationFrame(() => {
        const hi = r.hourReel.querySelector('.reel-item.sel');
        const mi = r.minReel.querySelector('.reel-item.sel');
        if (hi) r.hourReel.scrollTop = hi.offsetTop - r.hourReel.clientHeight / 2 + hi.clientHeight / 2;
        if (mi) r.minReel.scrollTop = mi.offsetTop - r.minReel.clientHeight / 2 + mi.clientHeight / 2;
      });
    },
    highlight() {
      r.hourReel.querySelectorAll('.reel-item').forEach((it) =>
        it.classList.toggle('sel', Number(it.dataset.hour) === r.selHour));
      r.minReel.querySelectorAll('.reel-item').forEach((it) =>
        it.classList.toggle('sel', Number(it.dataset.min) === r.selMin));
      $(ampmId).querySelectorAll('button').forEach((b) =>
        b.classList.toggle('on', b.dataset.ampm === r.ampm));
    },
    value() {
      let h = r.selHour % 12;
      if (r.ampm === 'pm') h += 12;
      return `${pad(h)}:${pad(r.selMin)}`;
    },
    fromValue(t) {
      if (t) {
        const [h, m] = t.split(':').map(Number);
        r.ampm = h < 12 ? 'am' : 'pm';
        r.selHour = h % 12 === 0 ? 12 : h % 12;
        r.selMin = Math.round(m / 5) * 5 % 60;
      } else {
        r.ampm = 'pm'; r.selHour = 6; r.selMin = 0;
      }
    },
  };
  return r;
}

const timeUI = {
  open: false,
  start: makeReelSet('reel-hour', 'reel-min', 'ampm'),
  end: makeReelSet('reel-hour-end', 'reel-min-end', 'ampm-end'),
  buildReels() {
    timeUI.start.buildReels();
    timeUI.end.buildReels();
    timeUI.start.onChange = () => {
      state.formTime = timeUI.start.value();
      timeUI.start.highlight();
      timeUI.renderToggle();
    };
    timeUI.end.onChange = () => {
      state.formEndTime = timeUI.end.value();
      timeUI.end.highlight();
      timeUI.renderToggle();
    };
  },
  renderToggle() {
    const text = $('time-text');
    const clear = $('time-clear');
    const shown = prettyTimeRange(state.formTime, state.formTimeMode === 'range' ? state.formEndTime : null);
    if (shown) {
      text.textContent = shown;
      text.classList.remove('placeholder');
      clear.hidden = false;
      $('time-toggle').classList.add('on');
    } else {
      text.textContent = t('editor.allDay');
      text.classList.add('placeholder');
      clear.hidden = true;
      $('time-toggle').classList.remove('on');
    }
  },
  setMode(mode) {
    state.formTimeMode = mode;
    const isRange = mode === 'range';
    $('time-group-end').hidden = !isRange;
    $('time-start-label').hidden = !isRange;
    $('time-chips').hidden = isRange;
    [...$('time-mode').children].forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.mode === mode)));

    if (isRange) {
      if (!state.formEndTime) {
        const [h, m] = timeUI.start.value().split(':').map(Number);
        state.formEndTime = `${pad((h + 1) % 24)}:${pad(m)}`;
      }
      timeUI.end.fromValue(state.formEndTime);
      timeUI.end.highlight();
      timeUI.end.scrollToSelected();
    } else {
      state.formEndTime = null;
    }
    timeUI.renderToggle();
  },
  openPanel() {
    timeUI.open = true;
    $('time-panel').hidden = false;
    $('time-toggle').setAttribute('aria-expanded', 'true');
    if (!state.formTime) { timeUI.start.fromValue(null); state.formTime = timeUI.start.value(); }
    else timeUI.start.fromValue(state.formTime);
    timeUI.start.highlight();
    timeUI.setMode(state.formTimeMode);
    timeUI.start.scrollToSelected();
    bringIntoView($('time-panel'));
  },
  closePanel() {
    timeUI.open = false;
    $('time-panel').hidden = true;
    $('time-toggle').setAttribute('aria-expanded', 'false');
  },
  reset(time, endTime) {
    state.formTime = time || null;
    state.formEndTime = state.formTime && endTime ? endTime : null;
    state.formTimeMode = state.formEndTime ? 'range' : 'point';
    timeUI.closePanel();
    timeUI.renderToggle();
  },
};

function bindTime() {
  timeUI.buildReels();
  $('time-toggle').addEventListener('click', (e) => {
    if (e.target.closest('#time-clear')) return;
    timeUI.open ? timeUI.closePanel() : timeUI.openPanel();
  });
  $('time-toggle').addEventListener('keydown', (e) => {
    if (e.target !== e.currentTarget) return;   // 안쪽 '지우기' 버튼은 따로 움직임
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); timeUI.open ? timeUI.closePanel() : timeUI.openPanel(); }
  });
  $('time-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    state.formTime = null;
    state.formEndTime = null;
    timeUI.setMode('point');
    timeUI.renderToggle();
    timeUI.closePanel();
  });
  $('time-mode').querySelectorAll('.time-mode-opt').forEach((b) => {
    b.onclick = () => timeUI.setMode(b.dataset.mode);
  });
  $('time-panel').querySelectorAll('.time-chip').forEach((chip) => {
    chip.onclick = () => {
      state.formTime = chip.dataset.time;
      timeUI.start.fromValue(state.formTime);
      timeUI.start.highlight();
      timeUI.renderToggle();
      timeUI.start.scrollToSelected();
    };
  });
}

/* ── 커스텀 날짜 고르기 ──────────────────── */
const datePicker = {
  targetId: null,   // 어느 입력에 값을 넣을지
  view: null,       // 보고 있는 달 (Date, 1일)
  selected: null,   // 선택된 'YYYY-MM-DD'
  onPick: null,

  open(targetId, onPick) {
    this.targetId = targetId;
    this.onPick = onPick || null;
    const cur = $(targetId).value;
    this.selected = cur || null;
    const base = cur ? parse(cur) : new Date();
    this.view = new Date(base.getFullYear(), base.getMonth(), 1);
    $('dp-years').hidden = true;
    $('dp-grid').hidden = false;
    document.querySelector('.dp-weekdays').style.display = '';
    this.renderMonth();
    $('datepick').showModal();
    // 처음 만난 날은 대개 몇 년 전이라, 비어 있으면 연도부터 → 월 → 날 (달마다 넘기면 수십 번)
    if (targetId === 's-since' && !cur) this.showYears();
  },
  close() {
    $('datepick').close();
    this.targetId = null;
  },
  renderMonth() {
    const y = this.view.getFullYear();
    const m = this.view.getMonth();
    $('dp-title').textContent = t('datepick.title', {
    year: y, month: i18n.dateFmt({ month: 'long' }).format(new Date(y, m, 1)),
  });

    const first = new Date(y, m, 1);
    const gridStart = addDays(first, -first.getDay());
    const grid = $('dp-grid');
    grid.replaceChildren();

    for (let i = 0; i < 42; i++) {
      const date = addDays(gridStart, i);
      const key = ymd(date);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'dp-cell';
      if (date.getMonth() !== m) cell.classList.add('out');
      if (date.getDay() === 0) cell.classList.add('sun');
      if (date.getDay() === 6) cell.classList.add('sat');
      if (holidayOn(key)) cell.classList.add('holiday');
      if (key === TODAY) cell.classList.add('today');
      if (key === this.selected) cell.classList.add('sel');
      cell.textContent = date.getDate();
      cell.addEventListener('click', () => this.pick(key));
      grid.append(cell);
    }
    // 마지막 줄이 비면 42→35로 줄이기
    const lastWeekEmpty = [...grid.children].slice(35).every((c) => c.classList.contains('out'));
    if (lastWeekEmpty) [...grid.children].slice(35).forEach((c) => c.remove());
  },
  pick(key) {
    this.selected = key;
    const input = $(this.targetId);
    input.value = key;
    // 버튼 라벨 갱신
    setDateLabel(this.targetId);
    if (this.onPick) this.onPick(key);
    this.close();
  },
  showYears() {
    const box = $('dp-years');
    box.replaceChildren();
    document.querySelector('.dp-weekdays').style.display = 'none';
    const cur = this.view.getFullYear();
    // 처음 만난 날에 앞으로 올 해는 필요 없습니다 — 올해에서 끝나야 고를 해가 화면 아래쪽에 모여요
    const last = this.targetId === 's-since' ? new Date().getFullYear() : cur + 10;
    for (let y = cur - 60; y <= last; y++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dp-year' + (y === cur ? ' sel' : '');
      b.textContent = y;
      b.addEventListener('click', () => {
        this.view = new Date(y, this.view.getMonth(), 1);
        this.showMonths();
      });
      box.append(b);
    }
    $('dp-grid').hidden = true;
    box.hidden = false;
    // 선택 연도로 스크롤
    requestAnimationFrame(() => {
      const sel = box.querySelector('.sel');
      if (sel) sel.scrollIntoView({ block: 'center' });
    });
  },
  /** 연도를 고르면 바로 달 — 고른 해의 같은 달로 떨어져 다시 열한 번 넘기지 않게 */
  showMonths() {
    const box = $('dp-years');
    box.replaceChildren();
    const y = this.view.getFullYear();
    $('dp-title').textContent = String(y);
    const name = i18n.dateFmt({ month: 'short' });
    for (let m = 0; m < 12; m++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dp-year dp-month' + (m === this.view.getMonth() ? ' sel' : '');
      b.textContent = name.format(new Date(y, m, 1));
      b.addEventListener('click', () => {
        this.view = new Date(y, m, 1);
        box.hidden = true;
        document.querySelector('.dp-weekdays').style.display = '';
        $('dp-grid').hidden = false;
        this.renderMonth();
      });
      box.append(b);
    }
    $('dp-grid').hidden = true;
    box.hidden = false;
  },
};

/* 숨은 input 값 → 예쁜 버튼 라벨 */
function setDateLabel(inputId) {
  const val = $(inputId).value;
  const text = $(inputId + '-text');
  const btn = $(inputId + '-btn');
  if (!text || !btn) return;
  if (val) {
    const d = parse(val);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    text.textContent = label(val, !sameYear);
    text.classList.remove('placeholder');
    btn.classList.add('on');
  } else {
    text.textContent = t('common.pickDate');
    text.classList.add('placeholder');
    btn.classList.remove('on');
  }
}

function bindDatePicker() {
  document.querySelectorAll('.date-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.dateFor;
      datePicker.open(target, (key) => {
        if (target === 's-since') {
          saveSetting({ since: key }, 0);
          $('s-milestones-row').hidden = false;
        }
        // 시작일 바꾸면 끝나는 날 최소값 보정
        if (target === 'f-date' && $('f-multi').checked && $('f-end').value && $('f-end').value < key) {
          $('f-end').value = key;
          setDateLabel('f-end');
        }
        if (target === 'f-date' || target === 'f-end') renderRepeatSummary();
      });
    });
  });
  $('dp-prev').addEventListener('click', () => {
    datePicker.view = new Date(datePicker.view.getFullYear(), datePicker.view.getMonth() - 1, 1);
    datePicker.renderMonth();
  });
  $('dp-next').addEventListener('click', () => {
    datePicker.view = new Date(datePicker.view.getFullYear(), datePicker.view.getMonth() + 1, 1);
    datePicker.renderMonth();
  });
  $('dp-title').addEventListener('click', () => datePicker.showYears());
  $('dp-today').addEventListener('click', () => datePicker.pick(TODAY));
  // 바깥(백드롭) 클릭으로 닫기
  $('datepick').addEventListener('click', (e) => {
    if (e.target === $('datepick')) datePicker.close();
  });
  // dialog 기본 Esc는 cancel 이벤트로 온다
  $('datepick').addEventListener('cancel', (e) => { e.preventDefault(); datePicker.close(); });
}

/* ── 일정 쓰기 ───────────────────────────── */
function openEditor(event, date) {
  state.editing = event || null;
  $('editor-title').textContent = t(event ? 'editor.edit' : 'editor.new');
  $('editor-error').textContent = '';
  $('f-title').value = event?.title || '';
  $('f-date').value = event?.date || date || state.picked || TODAY;
  setDateLabel('f-date');
  $('f-memo').value = event?.memo || '';
  $('f-multi').checked = !!event?.endDate;
  $('f-end').value = event?.endDate || '';
  syncMultiDay();
  setDateLabel('f-end');
  $('f-delete').hidden = !event;

  state.formOwner = event?.owner || state.me || 'both';
  ownerPicker($('f-owner'), state.formOwner, (owner) => { state.formOwner = owner; });
  state.formColor = event?.color || null;
  $('f-color').hidden = true;
  showFormColor();
  colorPicker($('f-color'), state.formColor, (color) => {
    state.formColor = color;
    showFormColor();
    $('f-color').hidden = true; // 골랐으면 접습니다
  });

  setRepeat(event?.repeat || 'none');
  renderRepeatNote();
  timeUI.reset(event?.time || null, event?.endTime || null);

  $('editor').showModal();
  setTimeout(() => $('f-title').focus(), 40);
}

/**
 * 여러 날 일정은 달력에 하루 종일로만 그려집니다(expand 참고). 시간 칸을
 * 열어두면 넣어도 아무 데도 안 나와서, 아예 감춥니다.
 */
function syncMultiDay() {
  const multi = $('f-multi').checked;
  $('f-end-wrap').hidden = !multi;
  $('f-time-wrap').hidden = multi;
}

/** 반복 일정은 고치면 모든 날짜가 함께 바뀝니다. 그 사실을 미리 알려줍니다. */
function renderRepeatNote() {
  const note = $('f-repeat-note');
  const repeating = state.editing && state.editing.repeat !== 'none';
  note.hidden = !repeating;
  if (repeating) {
    note.textContent = state.editing.repeat === 'monthly'
      ? t('editor.repeatNoteMonthly')
      : t('editor.repeatNoteYearly');
  }
}

/* 잘못 적힌 곳을 전부 모아 [안내 문구, 짚어줄 칸] 목록으로 돌려줍니다.
   앞의 하나만 알려주면, 이름을 안 쓴 채 시간까지 거꾸로 넣었을 때
   "이름을 쓰라"고만 해놓고 그것만 고쳐 다시 저장했다가 또 막힙니다. */
function checkEvent(payload) {
  const problems = [];
  if (!payload.title) problems.push([t('error.needTitle'), $('f-title')]);
  if (!payload.date) problems.push([t('error.needDate'), $('f-date-btn')]);
  if (payload.endDate && payload.endDate < payload.date) {
    problems.push([t('error.endBeforeStart'), $('f-end-btn')]);
  }
  if (payload.endTime && payload.endTime <= payload.time) {
    problems.push([t('error.endTimeBeforeStart'), $('time-toggle')]);
  }
  return problems;
}

async function saveEvent(e) {
  e.preventDefault();
  const payload = {
    title: $('f-title').value.trim(),
    date: $('f-date').value,
    time: $('f-multi').checked ? null : (state.formTime || null),
    endTime: $('f-multi').checked || state.formTimeMode !== 'range' ? null : (state.formEndTime || null),
    endDate: $('f-multi').checked ? ($('f-end').value || null) : null,
    memo: $('f-memo').value,
    owner: state.formOwner,
    repeat: state.formRepeat,
    color: state.formColor,
  };

  const problems = checkEvent(payload);
  if (problems.length) {
    const message = problems.map(([text]) => text).join('\n');
    const fields = problems.map(([, field]) => field);
    $('editor-error').textContent = message;
    // 시간이 거꾸로면 고칠 수 있게 시간 패널을 펼쳐 둡니다
    if (fields.includes($('time-toggle')) && !timeUI.open) timeUI.openPanel();
    pointOut(message, fields);
    return;
  }
  $('editor-error').textContent = '';

  /* 서버를 기다리지 않고 먼저 그립니다. 저장은 Neon을 깨우고 알림까지
     보내느라 2초쯤 걸리는데, 그동안 화면이 멈춰 있을 이유가 없습니다.
     실패하면 되돌리고 무엇이 잘못됐는지 알려줍니다. */
  const editing = state.editing;
  const before = editing ? state.events.map((x) => x) : null;
  const draft = editing
    ? { ...editing, ...payload }
    : { ...payload, id: 'draft-' + Date.now(), createdAt: new Date().toISOString() };

  if (editing) {
    const at = state.events.findIndex((x) => x.id === editing.id);
    if (at !== -1) state.events[at] = draft; else state.events.push(draft);
  } else {
    state.events.push(draft);
  }
  $('editor').close();
  toast(t(editing ? 'toast.edited' : 'toast.saved'));
  if (state.picked) openSheet(state.picked); else render();

  try {
    const saved = editing
      ? await api.call('PATCH', `/api/events/${editing.id}`, payload)
      : await api.call('POST', '/api/events', payload);
    // 서버가 준 진짜 값(id·시각)으로 갈아끼웁니다
    const at = state.events.findIndex((x) => x.id === draft.id);
    if (at !== -1) state.events[at] = saved; else state.events.push(saved);
    rememberState();
  } catch (err) {
    if (before) state.events = before; else state.events = state.events.filter((x) => x.id !== draft.id);
    toast(err.message || t('error.saveFailed'));
  }
  if (state.picked) openSheet(state.picked); else render();
}

/* 지우기는 묻지 않고 바로, 대신 몇 초 동안 "되돌리기"를 줍니다 — 실수로 눌러도 한 번에 되돌아와요.
   서버에는 그 시간이 지나야 보내서, 되돌리면 상대에게 지웠다는 알림도 가지 않습니다.
   매달·매년 돌아오는 일정은 모든 달이 한꺼번에 지워지니 예전처럼 한 번 묻습니다. */
let pendingDelete = null; // { event, timer }

async function deleteEvent() {
  if (!state.editing) return;
  const target = state.editing;
  if (target.repeat === 'monthly' || target.repeat === 'yearly') {
    const every = t(target.repeat === 'monthly' ? 'ask.deleteEveryMonthly' : 'ask.deleteEveryYearly');
    if (!await ask(t('ask.delete', { title: target.title, every }), t('ask.deleteYes'))) return;
  }
  await sendDelete(); // 앞서 지운 게 아직 기다리는 중이면 먼저 보냅니다
  state.events = state.events.filter((x) => x.id !== target.id);
  $('editor').close();
  if (state.picked) openSheet(state.picked); else render();
  pendingDelete = { event: target, timer: setTimeout(() => sendDelete(), UNDO_MS) };
  toast(t('toast.deleted'), { label: t('toast.undo'), run: undoDelete });
}

/** 기다리던 지우기를 서버로 보냅니다. 앱을 떠나는 중이면 응답을 기다리지 않고 보내 둡니다(keepalive). */
async function sendDelete({ leaving = false } = {}) {
  const p = pendingDelete;
  if (!p) return;
  pendingDelete = null;
  clearTimeout(p.timer);
  const url = `/api/events/${p.event.id}`;
  if (leaving) {
    fetch(url, { method: 'DELETE', credentials: 'same-origin', keepalive: true }).catch(() => {});
    return;
  }
  try {
    await api.call('DELETE', url);
    rememberState();
  } catch (err) {
    state.events = [...state.events, p.event];
    toast(err.message || t('error.deleteFailed'));
    if (state.picked) openSheet(state.picked); else render();
  }
}

function undoDelete() {
  const p = pendingDelete;
  if (!p) return;
  pendingDelete = null;
  clearTimeout(p.timer);
  state.events = [...state.events, p.event];
  if (state.picked) openSheet(state.picked); else render();
  toast(t('toast.restored'));
}

addEventListener('pagehide', () => sendDelete({ leaving: true }));

/* ── 설정 ────────────────────────────────── */

/* 기본 설정 / 디자인 두 판. 테마와 사진은 고르는 즉시 저장돼서 저장 버튼과
   상관이 없는데, 한 화면에 섞여 있으면 저장을 눌러야 하는 줄 압니다. */
function showSettingsTab(which) {
  const basic = which !== 'design';
  $('s-pane-basic').hidden = !basic;
  $('s-pane-design').hidden = basic;
  $('s-tab-basic').setAttribute('aria-selected', String(basic));
  $('s-tab-design').setAttribute('aria-selected', String(!basic));
  $('settings').scrollTop = 0;
}

function openSettings() {
  showSettingsTab('basic');
  fillSettings();
  renderPush();
  renderInvite();
  restoreTheme();
  renderPhotoNote();
  $('s-account').textContent = state.login ? t('settings.signedInAs', { name: state.login }) : '';
  $('s-password').hidden = !state.hasPassword; // 구글로만 들어온 사람은 바꿀 비밀번호가 없습니다
  $('settings').showModal();
}

/* ── 상대 부르기 ─────────────────────────── */

/* 상대가 아직 안 들어왔을 때만 보입니다. 링크 주소는 지금 앱이 열린 주소 그대로라
   네이티브 앱 안에서 만들어도 맞는 주소가 나옵니다. */
function renderInvite() {
  $('s-invite-field').hidden = state.paired;
}

/** 초대 링크를 새로 만들어 보냅니다. 설정의 버튼과 첫 화면의 초대 카드가 같이 씁니다. */
async function sendInvite(button) {
  await once(button, async () => {
    try {
      const { code } = await api.call('POST', '/api/invite');
      const url = `${location.origin}/?invite=${encodeURIComponent(code)}`;
      const box = $('s-invite-link');
      box.value = url;
      $('s-invite-row').hidden = false;
      // 폰이면 공유 시트로 바로 보냅니다. 닫아버려도 링크는 칸에 남아 있어요
      if (navigator.share) {
        await navigator.share({ text: t('invite.shareText'), url }).catch(() => {});
        return;
      }
      await copyInvite();
    } catch (err) {
      toast(err.message || t('error.saveFailed'));
    }
  });
}

const makeInvite = () => sendInvite($('s-invite'));

/** 칸에 있는 초대 링크를 복사합니다. 클립보드를 못 쓰면 골라 두기만 해서 길게 눌러 복사하게 */
async function copyInvite() {
  const box = $('s-invite-link');
  box.select();
  await navigator.clipboard?.writeText(box.value).then(() => toast(t('invite.copied')), () => {});
}

/** 초대 링크로 들어왔는데 이미 로그인해 있었다면, 지금 달력을 떠나 상대 달력으로 옮겨갑니다. */
async function acceptInvite(code) {
  try {
    await api.call('PUT', '/api/invite', { code });
    toast(t('invite.joined'));
    return true;
  } catch (err) {
    toast(err.message || t('error.badInvite'));
    return false;
  }
}

/* 서버 값을 칸에 다시 적습니다. 열 때도 쓰고, 저장이 실패해 되돌릴 때도 씁니다. */
function fillSettings() {
  $('s-title').value = state.settings.title;
  $('s-subtitle').value = state.settings.subtitle;
  $('s-name-a').value = state.settings.names.a;
  $('s-name-b').value = state.settings.names.b;
  $('s-since').value = state.settings.since || '';
  setDateLabel('s-since');
  $('s-milestones').checked = !!state.settings.showMilestones;
  $('s-milestones-row').hidden = !state.settings.since;
  renderLanguagePickers();
  renderPeople();
}

/* 언어와 공휴일 묶음. 둘 다 설정에 담기니 두 사람이 같은 것을 봅니다.
   고를 수 있는 것은 public/i18n/ 과 public/holidays/ 에 실제로 실린 파일뿐이라,
   언어팩이나 나라를 하나 넣으면 여기 목록에 저절로 나타납니다. */
function renderLanguagePickers() {
  const locale = $('s-locale');
  locale.replaceChildren();
  for (const tag of i18n.locales()) {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = i18n.LOCALE_NAMES[tag];   // 그 언어로 적힌 이름
    locale.append(opt);
  }
  locale.value = i18n.getLocale();

  const region = $('s-region');
  region.replaceChildren();
  for (const [code, set] of Object.entries(window.HOLIDAYS)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = t(set.label);
    region.append(opt);
  }
  region.value = window.HOLIDAYS[state.settings.region] ? state.settings.region : 'none';

  /* 시간대는 브라우저가 아는 것을 그대로 씁니다 — 목록을 우리가 들고 있으면
     여름시간이 바뀔 때마다 따라 고쳐야 합니다. 아주 옛 브라우저는
     supportedValuesOf가 없어서, 그때는 지금 쓰는 값 하나만 보여줍니다. */
  const zone = $('s-timezone');
  const mine = browserZone();
  const all = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [mine];
  const listed = all.includes(state.settings.timezone) || !state.settings.timezone
    ? all
    : [state.settings.timezone, ...all];
  zone.replaceChildren();
  for (const name of listed) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name.replace(/_/g, ' ');
    zone.append(opt);
  }
  zone.value = state.settings.timezone || mine;
}

/** 이 브라우저가 있다고 생각하는 곳. 못 알아내면 UTC. */
function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * 시간대를 한 번도 안 고른 달력이면, 이 브라우저가 있는 곳으로 채워둡니다.
 * 표의 기본값이 UTC라 그냥 두면 한국에서도 아침 요약이 오후 5시에 옵니다.
 *
 * **고른 적이 있으면 건드리지 않습니다.** 여행지에서 앱을 열 때마다 기준이
 * 따라 움직이면, 둘이 다른 곳에 있을 때 서로의 설정을 계속 덮어씁니다.
 */
function seedTimezone() {
  if (state.settings.timezone && state.settings.timezone !== 'UTC') return;
  const mine = browserZone();
  if (mine === 'UTC' || mine === state.settings.timezone) return;
  saveSetting({ timezone: mine }, 0);
}

/**
 * 언어를 한 번도 안 고른 달력이면, 처음 연 사람의 브라우저 언어로 채워둡니다.
 * 비워두면 화면은 브라우저 언어로 뜨지만 알림은 서버가 보내서 영어로 갑니다.
 * 고른 적이 있으면 건드리지 않습니다 — 시간대와 같은 이유입니다.
 */
function seedLocale() {
  if (state.settings.locale) return;
  saveSetting({ locale: i18n.getLocale() }, 0);
}

/** 설정에 담긴 언어를 화면에 입힙니다. 바뀌었으면 true. */
function applyLocale() {
  const want = state.settings.locale || i18n.preferred();
  if (want === i18n.getLocale()) return false;
  i18n.setLocale(want);
  refreshWeekNames();
  return true;
}

/* 카드 두 장 — 이름은 둘이 나눠 쓰고, 어느 쪽이 나인지는 로그인한 계정이 정합니다. */
function renderPeople() {
  document.querySelectorAll('#s-people .person').forEach((card) => {
    const owner = card.dataset.owner;
    card.querySelector('.person-bud').replaceChildren(budIcon(owner));
    card.dataset.me = String(state.me === owner);
  });
  // 상대가 아직 없으면 그 칸은 비워 둡니다 — 미리 적으면 상대에게 "뭐라고 불러 드릴까요?"가 안 뜨고,
  // 먼저 와 있던 사람에게 "들어왔어요" 알림도 가지 않아요. 상대가 들어와 직접 정합니다
  if (!state.me) return;
  const other = $(`s-name-${state.me === 'a' ? 'b' : 'a'}`);
  other.disabled = !state.paired;
  other.placeholder = state.paired ? '' : t('settings.partnerLater');
  $(`s-name-${state.me}`).disabled = false;
}

/* ── 달력 사진 넣고 빼기 ─────────────────── */

/* 서버와 같은 한도(public/limits.js) — 여기서 먼저 걸러서
   30장을 넘겨 고른 날 헛되이 올렸다 퇴짜맞지 않게 합니다. */
const MAX_PHOTOS = globalThis.DIARY_LIMITS.photos;

function openPhotos() {
  // 한 장도 없으면 빈 창을 한 번 더 거치지 않고 바로 사진 고르기로
  if (!state.photos.length) { $('s-photo-file').click(); return; }
  renderPhotos();
  $('photos').showModal();
}

/** 설정의 "사진 설정" 밑줄과, 모달 안 장수 표시를 같이 맞춥니다. */
function renderPhotoNote() {
  const n = state.photos.length;
  $('s-photos-note').textContent = n
    ? t('photos.count', { n, max: MAX_PHOTOS })
    : t('photos.none', { max: MAX_PHOTOS });
  $('s-photos-count').textContent = n
    ? t('photos.count', { n, max: MAX_PHOTOS }) + (n >= MAX_PHOTOS ? t('photos.full') : '')
    : t('photos.hint');
  $('s-photo-add').disabled = n >= MAX_PHOTOS;
}

function renderPhotos() {
  const box = $('s-photos');
  box.replaceChildren();

  state.photos.forEach((id, i) => {
    const cell = document.createElement('div');
    cell.className = 'photo-cell';
    const img = document.createElement('img');
    img.src = photoUrls[i];
    img.alt = '';
    img.loading = 'lazy';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'photo-del';
    del.textContent = '×';
    del.setAttribute('aria-label', t('photos.remove'));
    del.addEventListener('click', () => dropPhoto(id));
    cell.append(img, del);
    box.append(cell);
  });
  renderPhotoNote();
}

/**
 * 폰 사진은 몇 MB씩 되니 보내기 전에 256px 정사각으로 줄입니다.
 * 가운데를 잘라내서 얼굴이 남게 하고, 결과는 10KB 안팎이 됩니다.
 */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = 256;
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(
        img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      // webp를 못 만드는 브라우저는 png로 돌려주는데, 그것도 받아줍니다
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(t('error.photoResize'))),
        'image/webp', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('error.photoRead'))); };
    img.src = url;
  });
}

const asBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(new Error(t('error.photoRead')));
  reader.readAsDataURL(blob);
});

async function addPhotos(files) {
  const room = MAX_PHOTOS - state.photos.length;
  if (room <= 0) { toast(t('toast.photoLimit', { max: MAX_PHOTOS })); return; }
  const picked = files.slice(0, room);

  await once($('s-photo-add'), async () => {
    let added = 0;
    try {
      for (const file of picked) {
        const blob = await shrink(file);
        const { id } = await api.call('POST', '/api/photos', {
          mime: blob.type || 'image/webp',
          data: await asBase64(blob),
        });
        state.photos.push(id);
        added += 1;
      }
      afterPhotoChange(picked.length < files.length
        ? t('toast.photosPartial', { max: MAX_PHOTOS, n: added })
        : added > 1 ? t('toast.photosAdded', { n: added, count: added }) : t('toast.photoAdded'));
    } catch (err) {
      // 여러 장 중에 실패한 게 있어도, 들어간 것까지는 화면에 반영합니다
      refreshPhotos();
      renderPhotos();
      render();
      toast(err.message);
    }
  });
}

async function dropPhoto(id) {
  if (!await ask(t('ask.removePhoto'), t('ask.removePhotoYes'))) return;
  // 일정·설정과 같은 이유로 먼저 빼고, 실패하면 도로 넣습니다
  const before = state.photos;
  state.photos = state.photos.filter((x) => x !== id);
  afterPhotoChange(t('toast.photoRemoved'));
  try {
    await api.call('DELETE', `/api/photos/${id}`);
  } catch (err) {
    state.photos = before;
    afterPhotoChange(err.message || t('error.photoRemove'));
  }
}

function afterPhotoChange(message) {
  refreshPhotos();
  renderPhotos();
  render();
  toast(message);
}

/* ── 휴대폰 알림 (웹푸시) ─────────────────── */

/* 이 기기의 구독. 켜져 있으면 객체, 꺼져 있으면 null. */
let pushSub = null;

const pushable = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/* 아이폰은 홈 화면에 추가한 앱에서만 알림을 내줍니다. 사파리 탭에서는 안 돼요. */
const safariTab = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  navigator.standalone !== true &&
  !matchMedia('(display-mode: standalone)').matches;

/* 공개키는 base64url 글자로 오는데 subscribe()는 바이트를 원합니다. */
function keyBytes(base64) {
  const plain = base64.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(plain + '='.repeat((4 - (plain.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** 서비스워커를 등록하고 준비될 때까지 기다립니다. 새 sw.js가 있으면 여기서 갈립니다. */
async function pushWorker() {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

/* ── 스토어 앱(Capacitor) 안에서의 알림 ──────
   스토어 앱은 이 웹페이지를 그대로 띄우고, 네이티브 쪽이 window.Capacitor를 미리
   넣어 둡니다. 거기서는 웹푸시 대신 휴대폰 OS 알림을 씁니다 — iOS 앱의 웹뷰에는
   웹푸시가 아예 없어요.

   플러그인을 부르는 코드(@capacitor/core)는 원래 번들러가 페이지에 넣어 주는데,
   이 앱은 번들러가 없어서 그 파일 하나(public/vendor/capacitor.js)를 앱 안에서만
   불러옵니다. 브라우저로 여는 사람은 이 파일을 받지 않습니다.

   알림을 켠 상태는 웹푸시와 같은 모양(pushSub = { endpoint, unsubscribe })으로
   담아서, 켜고 끄기·로그아웃 코드를 그대로 씁니다. endpoint 자리에 앱 토큰이 들어가요. */
const inApp = () => !!window.Capacitor?.isNativePlatform?.();

let appPush = null;
let appPermission = 'prompt';
let tokenWaiters = [];

/* 앱 다리(capacitor.js)는 한 번만 붙입니다 — 알림과 구글 로그인이 같이 씁니다 */
let bridgeReady = null;
function loadBridge() {
  bridgeReady ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/capacitor.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  return bridgeReady;
}

async function nativePush() {
  if (appPush) return appPush;
  await loadBridge();
  appPush = window.Capacitor.registerPlugin('PushNotifications');
  // register()는 토큰을 돌려주지 않고 이벤트로 알려줍니다. 한 번만 걸어두고 기다리는 쪽에 나눠줘요
  await appPush.addListener('registration', ({ value }) => {
    tokenWaiters.forEach((w) => w.resolve(value));
    tokenWaiters = [];
  });
  await appPush.addListener('registrationError', ({ error }) => {
    tokenWaiters.forEach((w) => w.reject(new Error(error)));
    tokenWaiters = [];
  });
  return appPush;
}

/** OS에 알림 토큰을 받아 서버에 겁니다. 권한은 이미 받아둔 상태여야 합니다. */
async function registerApp() {
  const push = await nativePush();
  const token = await new Promise((resolve, reject) => {
    tokenWaiters.push({ resolve, reject });
    push.register();
  });
  await api.call('POST', '/api/push', { platform: window.Capacitor.getPlatform(), token });
  pushSub = { endpoint: token, unsubscribe: () => push.unregister() };
}

async function syncAppPush() {
  try {
    const push = await nativePush();
    appPermission = (await push.checkPermissions()).receive;
    if (appPermission === 'granted') await registerApp();
  } catch { /* 알림이 안 갈 뿐이라 조용히 넘어갑니다 */ }
  renderPush();
}

async function subscribeApp() {
  const push = await nativePush();
  appPermission = (await push.requestPermissions()).receive;
  if (appPermission !== 'granted') {
    toast(t('push.needPermission'));
    return;
  }
  await registerApp();
  toast(t('push.turnedOn'));
}

/**
 * 앱을 열 때 한 번. 켜둔 기기는 서버에도 남아 있어야 하는데 구독이 만료돼
 * 서버 쪽만 지워졌을 수 있어서, 다시 등록해 둡니다 (같은 기기면 덮어쓰기).
 */
async function syncPush() {
  if (inApp()) return syncAppPush();
  try {
    if (pushable() && Notification.permission === 'granted') {
      const worker = await pushWorker();
      pushSub = await worker.pushManager.getSubscription();

      // 아이폰은 구독을 조용히 버릴 때가 있습니다. 권한은 그대로 남아 있으니
      // (허락을 다시 물을 필요 없이) 여기서 도로 걸어둡니다.
      if (!pushSub) {
        const { publicKey } = await api.call('GET', '/api/push');
        pushSub = await worker.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        });
      }
      // 누구 앞으로 걸지는 서버가 로그인한 계정을 보고 정합니다
      if (pushSub) await api.call('POST', '/api/push', { subscription: pushSub.toJSON() });
    }
  } catch { /* 알림이 안 갈 뿐이라 조용히 넘어갑니다 */ }
  renderPush();
}

/** 알림을 켤 수 없는 이유 한 줄. 켤 수 있으면 null. */
function pushBlocker() {
  if (inApp()) return appPermission === 'denied' ? t('push.denied') : null;
  // 아이폰 사파리 탭에는 알림 API가 아예 없을 수 있어서, "지원 안 함"보다 이 안내가 먼저입니다
  if (safariTab()) return t('push.safariTab');
  if (!pushable()) return t('push.unsupported');
  if (Notification.permission === 'denied') return t('push.denied');
  return null;
}

function renderPush() {
  const button = $('s-push');
  const note = $('s-push-note');
  const blocked = pushBlocker();

  button.textContent = t(pushSub ? 'push.turnOff' : 'push.allow');
  // 아이폰 사파리 탭은 막힌 게 아니라 홈 화면에 두면 되는 것 — 눌러서 그림 안내로 갑니다
  button.disabled = !!blocked && !safariTab();
  note.textContent = blocked || (pushSub
    ? t('push.onNote')
    : t('push.offNote'));
}

/** 권한을 받고 이 기기를 서버에 등록합니다. 설정과 사용법 양쪽에서 부릅니다. */
async function subscribePush() {
  if (inApp()) return subscribeApp();
  // 권한은 누른 직후에 물어야 합니다 — 뜸을 들이면 브라우저가 무시해요
  if (await Notification.requestPermission() !== 'granted') {
    toast(t('push.needPermission'));
    return;
  }
  const { publicKey } = await api.call('GET', '/api/push');
  const worker = await pushWorker();
  const sub = await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  await api.call('POST', '/api/push', { subscription: sub.toJSON() });
  pushSub = sub;
  toast(t('push.turnedOn'));
}

async function togglePush() {
  if (safariTab()) return openInstallGuide('ios');
  // once가 끝나면서 버튼을 다시 켜므로, 화면 맞추기는 그 뒤에 한 번만 합니다
  await once($('s-push'), async () => {
    try {
      if (pushSub) {
        const { endpoint } = pushSub;
        await pushSub.unsubscribe().catch(() => {}); // 브라우저 쪽이 실패해도 서버는 지웁니다
        await api.call('DELETE', `/api/push?endpoint=${encodeURIComponent(endpoint)}`);
        pushSub = null;
        toast(t('push.turnedOff'));
        return;
      }
      await subscribePush();
    } catch (err) {
      toast(err.message || t('error.pushFailed'));
    }
  });
  renderPush();
}

/* 설정에는 저장 버튼이 없습니다. 서버 왕복이 1~2초씩 걸리던 시절엔 모아
   보내려고 버튼이 있었지만, 이제 화면이 서버를 안 기다리니 있을 이유가
   없어졌어요. 글자는 손을 멈추면 한 번, 고르는 것들은 고르는 즉시 담깁니다.
   덕분에 디자인 탭과 규칙이 같아졌습니다. */
let settingsTimer = null;
let settingsPatch = {};
let settingsBefore = null; // 담기 전 값 — 실패하면 여기로 돌아갑니다

function saveSetting(patch, wait = 600) {
  if (settingsBefore === null) settingsBefore = { ...state.settings };
  // 이름은 자리마다 따로 — 바꾼 자리만 모아 보내고, 화면의 다른 자리 이름은 그대로 둡니다
  if (patch.names) {
    settingsPatch.names = { ...settingsPatch.names, ...patch.names };
    state.settings.names = { ...state.settings.names, ...patch.names };
    const { names, ...rest } = patch;
    patch = rest;
  }
  Object.assign(settingsPatch, patch);
  Object.assign(state.settings, patch);
  renderTitle(); // 윗줄 이름은 적는 대로 따라옵니다

  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(sendSettings, wait);
}

/** 모아둔 것을 지금 보냅니다. 창을 닫을 때도 불러서 적다 만 게 없게 합니다. */
async function sendSettings() {
  clearTimeout(settingsTimer);
  const sending = settingsPatch;
  const back = settingsBefore;
  settingsPatch = {};
  settingsBefore = null;
  if (!Object.keys(sending).length) return;

  try {
    const saved = await api.call('PATCH', '/api/settings', sending);
    // 보낸 칸만 서버가 다듬은 값으로 맞춥니다. 테마는 따로 담기니 그대로 둬요.
    for (const key of Object.keys(sending)) {
      state.settings[key] = key === 'names' ? { ...state.settings.names, ...saved.names } : saved[key];
    }
    // 이름이 안 돌아왔으면 조용히 넘기지 않습니다 (DB에 앱 이름 칸이 아직 없을 때)
    if (sending.title && saved.title !== sending.title) toast(t('error.titleOnlyFailed'));
  } catch (err) {
    for (const key of Object.keys(sending)) state.settings[key] = back[key];
    fillSettings();
    toast(err.message || t('error.saveFailed'));
  }
  renderTitle();
  render();
}

/** 둘 다 채워져 있을 때만 보냅니다 — 비면 서버가 '나'/'너'로 바꿔버려요. */
function saveNames(wait) {
  // 바뀐 자리만, 빈 칸은 빼고 보냅니다. 예전엔 둘 다 차 있어야만 보내서, 혼자일 때(상대 칸이 빔)
  // 내 이름을 고쳐도 저장되지 않았습니다. 그새 상대가 고친 자기 이름을 덮지도 않아요
  const typed = { a: $('s-name-a').value.trim(), b: $('s-name-b').value.trim() };
  const changed = Object.fromEntries(Object.entries(typed)
    .filter(([slot, name]) => name && name !== state.settings.names[slot]));
  if (Object.keys(changed).length) saveSetting({ names: changed }, wait);
}

/* ── 테마 ────────────────────────────────── */

/* 색만 바뀝니다. 기기마다 따로 기억해요 — 상대 화면까지 바꿔버리면
   자기 폰을 자기가 못 고르니까요. */
const THEMES = ['peach', 'ocean', 'forest', 'apricot', 'night'];

/* 예전 판은 테마를 한국어 이름으로 담았습니다. 그 값이 든 설정과 기기 기록도
   맞게 읽어서, 쓰던 사람이 색을 잃지 않게 합니다. */
const THEME_ALIASES = {
  '복숭아': 'peach', '바다': 'ocean', '숲': 'forest', '살구': 'apricot', '밤': 'night',
};

/* 색만 칠합니다. 어디에 기억할지는 부르는 쪽이 정해요. */
function paintTheme(name) {
  const id = THEME_ALIASES[name] || name;
  const theme = THEMES.includes(id) ? id : THEMES[0];
  document.documentElement.dataset.theme = theme;
  // 폰 위아래 띠 색도 바탕에 맞춥니다
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (paper && meta) meta.setAttribute('content', paper);
  renderThemes();
  return theme;
}

/**
 * 고를 때: "같이 바꾸기"면 설정에 저장해 둘 다 바뀌고, 아니면 이 기기에만
 * 남깁니다. 기기에 남긴 게 있으면 그게 이깁니다 — 내가 따로 고른 색을
 * 상대가 덮어쓰면 곤란하니까요.
 */
let themeTimer = null;
let themeBefore = null; // 서버에 담겨 있던 색 — 못 담으면 여기로 돌아갑니다

function pickTheme(name) {
  const theme = paintTheme(name);

  if (!$('s-theme-share').checked) {
    localStorage.setItem('diary_theme', theme);
    return;
  }
  // 같이 쓰기로 했으면 내 것만 따로 두던 걸 버립니다
  localStorage.removeItem('diary_theme');
  if (themeBefore === null) themeBefore = state.settings.theme;
  state.settings.theme = theme;

  // 여러 개 눌러보는 동안 매번 서버에 쓰지 않게 잠깐 모읍니다
  clearTimeout(themeTimer);
  themeTimer = setTimeout(async () => {
    const back = themeBefore;
    themeBefore = null;
    try {
      // 색 칸만 받아옵니다 — 통째로 받으면 같이 저장한 이름을 도로 지웁니다
      const saved = await api.call('PATCH', '/api/settings', { theme });
      state.settings.theme = saved.theme;
    } catch {
      // 조용히 두면 다음에 설정을 열 때 옛 색이 돌아와 있어 놀랍니다
      state.settings.theme = back;
      restoreTheme();
      toast(t('error.themeSave'));
    }
  }, 600);
}

/** 앱을 열 때: 내가 따로 고른 게 있으면 그것, 없으면 둘이 같이 쓰는 것. */
function restoreTheme() {
  const mine = localStorage.getItem('diary_theme');
  $('s-theme-share').checked = !mine;
  paintTheme(mine || state.settings.theme);
}

/* 미리보기 조각에 data-theme을 걸면 그 조각만 그 테마 색으로 그려집니다.
   색을 여기에 또 적을 필요가 없어요. */
function renderThemes() {
  const box = $('s-theme');
  const now = document.documentElement.dataset.theme || THEMES[0];
  $('s-theme-note').textContent = $('s-theme-share').checked
    ? t('settings.themeSharedNote')
    : t('settings.themeLocalNote');
  box.replaceChildren();

  THEMES.forEach((name) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'theme-swatch';
    swatch.dataset.theme = name;
    swatch.setAttribute('role', 'radio');
    swatch.setAttribute('aria-checked', String(name === now));

    const paper = document.createElement('span');
    paper.className = 'sw-paper';
    const a = document.createElement('i'); a.className = 'sw-a';
    const b = document.createElement('i'); b.className = 'sw-b';
    paper.append(a, b);

    const label = document.createElement('span');
    label.className = 'sw-name';
    label.textContent = t('theme.' + name);

    swatch.append(paper, label);
    swatch.addEventListener('click', () => pickTheme(name));
    box.append(swatch);
  });
}

/* ── 사용법 ──────────────────────────────── */

/* 본 적이 있으면 이 값이 들어갑니다. 내용을 크게 고치면 숫자를 올려서
   다시 보여줄 수 있습니다. 기기마다 따로 기억되는데, 알림 켜기와 홈 화면
   추가가 기기마다 해야 하는 일이라 그게 맞습니다. */
const GUIDE_VERSION = '4';

function showGuideTab(which) {
  const setup = which === 'setup';
  $('guide-setup').hidden = !setup;
  $('guide-use').hidden = setup;
  $('guide-tab-setup').setAttribute('aria-selected', String(setup));
  $('guide-tab-use').setAttribute('aria-selected', String(!setup));
  $('guide').scrollTop = 0;
}

/* 처음 온 사람은 설정할 게 있고, 다시 찾아온 사람은 쓰는 법이 궁금합니다. */
function openGuide(tab = 'use') {
  renderSetupSteps();
  showGuideTab(tab);
  renderGuideCta();
  $('guide').showModal();
}

/** "처음 설정"은 남은 할 일만 — 상대가 들어왔으면 부르기를, 처음 만난 날이 있으면 그 단계를 숨기고
    보이는 것만 1, 2, 3으로 다시 셉니다. 알림 켜기는 마지막 단추가 그 자리에서 하니 늘 남겨요. */
function renderSetupSteps() {
  const done = { invite: state.paired, since: !!state.settings.since };
  let n = 0;
  for (const step of $('guide-setup').querySelectorAll('.guide-step')) {
    step.hidden = !!done[step.dataset.step];
    if (!step.hidden) step.querySelector('.guide-n').textContent = String(++n);
  }
}

/** 이 기기에서 처음 열었으면 한 번 보여줍니다. */
function maybeGuide() {
  if (localStorage.getItem('diary_guide') === GUIDE_VERSION) return;
  localStorage.setItem('diary_guide', GUIDE_VERSION);
  // 달력이 먼저 자리를 잡고 나서 떠야 덜 놀랍니다
  setTimeout(() => openGuide('setup'), 450);
}

/* 읽고 나가서 설정을 다시 찾아 들어가야 하면 대부분 안 켭니다 —
   그래서 마지막 버튼이 그 자리에서 알림을 켭니다. */
function renderGuideCta() {
  const canTurnOn = !pushBlocker() && !pushSub;
  $('guide-cta').textContent = t(canTurnOn ? 'guide.ctaPush' : 'guide.ctaOk');
}

async function guideCta() {
  if (pushBlocker() || pushSub) { $('guide').close(); return; }

  await once($('guide-cta'), async () => {
    try {
      await subscribePush();
    } catch (err) {
      toast(err.message || t('error.pushFailed'));
    }
  });
  renderPush();
  $('guide').close();
}

/* ── 들어오고 나가기 ─────────────────────── */
function show(view) {
  ['intro', 'gate', 'app'].forEach((id) => { $(id).hidden = id !== view; });
  if (view === 'intro' || view === 'gate') spawnPetals(view);
}

/* 지난번에 본 화면을 적어뒀다가 먼저 그립니다. Neon이 잠들어 있으면 첫
   응답이 1~2초 걸리는데, 그동안 빈 화면을 보고 있을 이유가 없습니다. */
const STATE_KEY = 'diary_state';

function rememberState() {
  const data = {
    events: state.events, settings: state.settings, photos: state.photos,
    me: { slot: state.me, login: state.login, hasPassword: state.hasPassword }, paired: state.paired,
  };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(data)); } catch { /* 꽉 찼으면 그만둡니다 */ }
}

/**
 * 이 기기에서 로그인이 풀렸을 때 — 서버가 401을 줬거나, 직접 로그아웃했거나.
 * 적어둔 달력도 같이 지웁니다. 안 지우면 같은 폰으로 다른 사람이 로그인할 때
 * 그 전 커플의 일정이 잠깐 먼저 그려집니다.
 */
function signOut() {
  localStorage.removeItem(SIGNED_IN);
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem('diary_title');
  localStorage.removeItem('diary_sub');
  state.events = [];
  state.photos = [];
  state.me = null;
  state.login = '';
  showGateNote();
  show('gate');
  offerGoogle();
}

/** 로그아웃 버튼. 이 기기 알림도 서버에서 끕니다 — 넘겨준 폰이 계속 울리면 곤란하니까요. */
async function logOut() {
  const endpoint = pushSub?.endpoint;
  await pushSub?.unsubscribe().catch(() => {});
  pushSub = null;
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => { /* 서버에 못 닿아도 이 기기에서는 나갑니다 */ });
  signOut();
}

function applyState(data) {
  state.events = data.events || [];
  state.settings = data.settings || state.settings;
  state.photos = data.photos || [];
  if (data.me) {
    state.me = data.me.slot;
    state.login = data.me.login || '';
    state.hasPassword = data.me.hasPassword !== false;
  }
  if (typeof data.paired === 'boolean') state.paired = data.paired;
  applyLocale();   // 서버가 정한 언어. 화면 글자는 여기서 다시 칠해집니다
  seedLocale();    // 아직 아무도 안 고른 언어는 이 기기 것으로 채워둡니다
  seedTimezone();  // 아직 아무도 안 고른 시간대는 이 기기 것으로 채워둡니다
  refreshPhotos();
  renderTitle();
  restoreTheme();
}

async function load() {
  // 인트로가 도는 동안 이미 부르기 시작했으면 그걸 씁니다
  const fresh = pendingState || api.call('GET', '/api/state');
  pendingState = null;

  try {
    const seen = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    if (seen && seen.me?.slot) {
      applyState(seen);
      show('app');
      render();
    }
  } catch { /* 적어둔 게 깨졌으면 그냥 기다립니다 */ }

  const data = await fresh;
  localStorage.setItem(SIGNED_IN, '1');
  applyState(data);
  rememberState();
  lastSync = Date.now();
  syncPush(); // 기다리지 않습니다 — 알림 등록이 늦어도 달력은 먼저 떠야죠
  keepShell();
  show('app');
  render();
  firstSteps();
}

/**
 * 앱을 열 때. 서버에 못 닿아도(신호 없음·서버 오류) 지난번 달력이 떠 있으면 그대로 둡니다 —
 * 로그인이 풀린 게 아니니까요. 로그인이 풀렸으면(401) signOut이 이미 로그인 화면으로 보냈습니다.
 */
async function enter() {
  try {
    await load();
  } catch (err) {
    if (signedIn() && !$('app').hidden) { toast(err.message); return; }
    show('gate');
    offerGoogle();
  }
}

/**
 * 신호가 없어도 홈 화면 앱이 열리게 — 화면 파일을 적어 두는 일은 sw.js가 합니다.
 * 알림을 안 켠 사람도 여기서 워커가 등록되고, 지금까지 받은 파일 목록을 불러 줍니다.
 */
async function keepShell() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
    const { active } = await navigator.serviceWorker.ready;
    const urls = [location.pathname, ...performance.getEntriesByType('resource').map((entry) => entry.name)];
    active?.postMessage({ type: 'keep', urls });
  } catch { /* 신호 없을 때 안 열릴 뿐이라 조용히 넘어갑니다 */ }
}

/* ── 로그인 화면 ─────────────────────────────
   구글 하나로 들어옵니다 (2026-10-23). 처음 보는 구글 계정이면 그 자리에서 가입하고,
   초대 링크로 왔으면 그 달력에 바로 앉습니다 (api/_auth/google.js). 아이디·비밀번호 폼은 없습니다. */
let pendingInvite = '';  // ?invite= 로 들어왔을 때

/** 초대 링크로 왔으면 그렇다고 한 줄 알려줍니다 */
function showGateNote() {
  $('gate-note').textContent = pendingInvite ? t('gate.invited') : '';
  $('gate-note').hidden = !pendingInvite;
  $('gate-error').textContent = '';
}

/** 초대 코드를 주소창에서 걷어냅니다. 남겨두면 새로고침할 때마다 다시 쓰려 하고, 화면 기록에도 남아요. */
function readLinkCodes() {
  const params = new URLSearchParams(location.search);
  pendingInvite = params.get('invite') || '';
  // ?signup은 소개 페이지의 "시작하기"가 붙이던 것 — 이제 들어오는 길이 하나라 걷어내기만 합니다
  if (pendingInvite || params.has('signup')) history.replaceState(null, '', location.pathname);
}

async function post(url, method, body) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => { throw new Error(t('error.offline')); });
  const info = await res.json().catch(() => ({}));
  // 서버는 문구가 아니라 키를 돌려줍니다
  if (!res.ok) throw new Error(info.error ? t(info.error) : t('gate.failed'));
  return info;
}

/* ── 구글로 들어오기 ─────────────────────────
   버튼은 구글이 그려주고, 누르면 구글 창이 떠서 구글이 서명한 ID 토큰(credential)을
   돌려줍니다. 서버가 그 서명을 확인합니다 (lib/google.js).
   스토어 앱(WebView) 안에서는 구글이 이 창을 막아서(disallowed_useragent) 폰의 구글 계정 선택 창을 씁니다
   (@capawesome/capacitor-google-sign-in — 안드로이드는 Credential Manager). 웹 클라이언트 ID를 그대로 넘겨서
   ID 토큰이 웹과 같은 앞으로 발급돼요 — 서버는 그대로입니다. 버튼은 우리가 그립니다.
   아이폰 앱은 구글을 넣으면 애플 로그인도 같이 넣어야 해서(심사 4.8) 아직 숨깁니다. */
let googleReady = null;
let onGoogleCredential = null; // 구글이 부르는 곳은 하나뿐이라, 지금 떠 있는 버튼의 할 일을 여기 둡니다
let appGoogle = null;          // 스토어 앱의 구글 플러그인

function loadGoogle() {
  googleReady ??= (async () => {
    const native = inApp();
    if (native && window.Capacitor.getPlatform() !== 'android') return false;
    const res = await fetch('/api/google', { credentials: 'same-origin' }).catch(() => null);
    const clientId = res?.ok ? (await res.json().catch(() => ({}))).clientId : '';
    if (!clientId) return false;
    if (native) {
      await loadBridge();
      appGoogle = window.Capacitor.registerPlugin('GoogleSignIn');
      await appGoogle.initialize({ clientId });
      return true;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => onGoogleCredential?.(credential),
      ux_mode: 'popup',
      auto_select: false,
    });
    return true;
  })().catch(() => false);
  return googleReady;
}

/* text는 구글이 정해둔 문구 중 하나 — 로그인 화면은 가입과 로그인이 한 버튼이라 'continue_with'(Google로 계속하기).
   언어는 화면 언어를 따라 구글이 옮겨줍니다. */
async function googleButton(el, handler, text = 'continue_with') {
  if (!(await loadGoogle())) return false;
  onGoogleCredential = handler;
  if (appGoogle) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-solid';
    button.textContent = t('gate.continueGoogle');
    button.addEventListener('click', async () => {
      let idToken = '';
      try {
        ({ idToken } = await appGoogle.signIn());
      } catch (err) {
        // 계정 선택 창을 그냥 닫은 건 실패가 아닙니다
        if (!/cancel/i.test(`${err?.code} ${err?.message}`)) toast(t('error.googleFailed'));
        return;
      }
      if (idToken) onGoogleCredential?.(idToken);
    });
    el.replaceChildren(button);
    return true;
  }
  el.replaceChildren();
  window.google.accounts.id.renderButton(el, {
    theme: 'outline', size: 'large', shape: 'pill', text, locale: i18n.getLocale(), width: 260,
  });
  return true;
}

/** 로그인 화면에 구글 버튼을 놓습니다. 들어오는 문이 이것뿐이라, 못 놓으면 왜 비었는지 말해줍니다. */
async function offerGoogle() {
  const shown = await googleButton($('gate-google-button'), signInWithGoogle);
  $('gate-google').hidden = !shown;
  if (!shown) $('gate-error').textContent = t('error.googleOff');
}

async function signInWithGoogle(credential) {
  $('gate-error').textContent = '';
  try {
    const info = await post('/api/google', 'POST', { credential, invite: pendingInvite || undefined });
    googleName = givenName(credential);
    // 처음이면 가입하면서 이미 그 달력에 앉았고, 원래 있던 사람이면 들어온 김에 초대를 받습니다
    if (pendingInvite && !info.created) {
      localStorage.setItem(SIGNED_IN, '1');
      await acceptInvite(pendingInvite);
    }
    pendingInvite = '';
    localStorage.setItem(SIGNED_IN, '1');
    await load();
  } catch (err) {
    $('gate-error').textContent = err.message || t('error.googleFailed');
  }
}

/* ── 로그인 꽃잎 ─────────────────────────── */
function spawnPetals(id = 'gate') {
  const gate = $(id);
  if (!gate || gate.hidden || gate.querySelector('.petal')) return;
  const N = 8;
  for (let i = 0; i < N; i++) {
    const p = document.createElement('span');
    p.className = 'petal';
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDuration = `${7 + Math.random() * 6}s`;
    p.style.animationDelay = `${-Math.random() * 10}s`;
    const s = 8 + Math.random() * 8;
    p.style.width = p.style.height = `${s}px`;
    p.style.opacity = 0.35 + Math.random() * 0.3;
    gate.append(p);
  }
}

/* ── 연결 ────────────────────────────────── */

function goToMonth(delta) {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + delta, 1);
  render();
}
$('prev-month').addEventListener('click', () => goToMonth(-1));
$('next-month').addEventListener('click', () => goToMonth(1));

/* ── 달력 옆으로 슬라이드 → 지난달/다음달 ───
   grid-prev/grid/grid-next 세 달을 나란히 두고 트랙을 통째로 밀어서,
   드래그 중에도 옆 달이 하얗게 비지 않고 실제로 보이게 함              */
(() => {
  const wrap = $('grid-wrap');
  const track = $('grid-track');
  const THRESHOLD = 55; // 이 정도는 밀어야 달이 넘어감
  let dragging = false;
  let locked = null; // 'x' | 'y' | null — 방향이 정해지기 전
  let startX = 0, startY = 0, dx = 0, pointerId = null;

  const width = () => wrap.getBoundingClientRect().width || 1;

  wrap.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    locked = null;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    track.classList.remove('settling');
  });

  wrap.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const moveX = e.clientX - startX;
    const moveY = e.clientY - startY;

    if (!locked) {
      if (Math.abs(moveX) < 6 && Math.abs(moveY) < 6) return;
      locked = Math.abs(moveX) > Math.abs(moveY) ? 'x' : 'y';
      // 캡처가 안 되는 상황(포인터가 이미 놓인 뒤 등)에도 스와이프가 죽지 않게
      if (locked === 'x') { try { wrap.setPointerCapture(pointerId); } catch { /* 없어도 됨 */ } }
    }
    if (locked !== 'x') return;

    e.preventDefault();
    dx = moveX;
    track.classList.add('dragging');
    track.style.transform = `translateX(${dx}px)`;
  });

  function settle() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('dragging');

    if (locked !== 'x') { locked = null; return; }
    locked = null;

    const passed = Math.abs(dx) > Math.min(THRESHOLD, width() * 0.18);
    track.classList.add('settling');
    // 드래그 중에는 transition이 꺼져 있어서, 여기서 스타일을 한 번 확정해 두지 않으면
    // 트랜지션이 시작되지 않고 transitionend도 오지 않습니다
    void track.offsetWidth;

    if (!passed) {
      track.style.transform = 'translateX(0)';
      return;
    }

    const dir = dx > 0 ? -1 : 1; // 오른쪽으로 밀면 지난달(-1), 왼쪽으로 밀면 다음달(+1)
    track.style.transform = `translateX(${dir > 0 ? -width() : width()}px)`;

    // transitionend가 안 오는 경우에도 달력이 밀려나간 채 얼지 않도록 대비합니다
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      track.removeEventListener('transitionend', finish);
      goToMonth(dir); // grid-prev/grid/grid-next 내용을 새 달 기준으로 다시 채움
      track.classList.remove('settling'); // 트랜지션 없이 제자리로 순간 복귀
      track.style.transform = 'translateX(0)';
    };
    const timer = setTimeout(finish, 400);
    track.addEventListener('transitionend', finish);
  }

  wrap.addEventListener('pointerup', settle);
  wrap.addEventListener('pointercancel', settle);
})();
$('today-btn').addEventListener('click', () => {
  state.cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  render();
  openSheet(TODAY);
});
$('add-btn').addEventListener('click', () => openEditor(null, state.picked || TODAY));
$('sheet-add').addEventListener('click', () => openEditor(null, state.picked));
$('sheet-close').addEventListener('click', closeSheet);
$('sheet-backdrop').addEventListener('click', closeSheet);
$('editor-form').addEventListener('submit', saveEvent);
$('f-cancel').addEventListener('click', () => $('editor').close());
$('f-color-btn').addEventListener('click', () => {
  $('f-color').hidden = !$('f-color').hidden;
  showFormColor();
});
$('editor-close').addEventListener('click', () => $('editor').close());
$('f-delete').addEventListener('click', deleteEvent);
$('f-multi').addEventListener('change', (e) => {
  syncMultiDay();
  if (e.target.checked && !$('f-end').value) { $('f-end').value = $('f-date').value; setDateLabel('f-end'); }
  renderRepeatSummary();
  if (e.target.checked) bringIntoView($('f-end-wrap'));
});
$('open-settings').addEventListener('click', openSettings);
$('settings-close').addEventListener('click', () => $('settings').close());
$('s-theme-share').addEventListener('change', () => {
  // 켜면 둘이 쓰는 색으로 돌아가고, 끄면 지금 색을 이 기기 것으로 붙듭니다
  pickTheme($('s-theme-share').checked
    ? state.settings.theme
    : document.documentElement.dataset.theme);
});
$('s-tab-basic').addEventListener('click', () => showSettingsTab('basic'));
$('s-tab-design').addEventListener('click', () => showSettingsTab('design'));
/* 적는 동안엔 손을 멈출 때 한 번(input), 칸을 벗어나면 그 자리에서(change).
   창을 닫으면 칸에서 포커스가 빠지며 change가 떠서, 적다 만 게 남지 않습니다. */
const typed = {
  's-title': (wait) => saveSetting({ title: $('s-title').value.trim().slice(0, 12) }, wait),
  's-subtitle': (wait) => saveSetting({ subtitle: $('s-subtitle').value.trim() }, wait),
  's-name-a': saveNames,
  's-name-b': saveNames,
};
Object.entries(typed).forEach(([id, save]) => {
  $(id).addEventListener('input', () => save(600));
  $(id).addEventListener('change', () => { save(0); sendSettings(); });
});
// 비운 채로 자리를 뜨면 담겨 있던 이름으로 되돌립니다
['s-name-a', 's-name-b'].forEach((id) => $(id).addEventListener('blur', () => {
  if ($(id).value.trim()) return;
  fillSettings();
  toast(t('error.nameEmpty'));
}));
$('s-milestones').addEventListener('change', () => saveSetting({ showMilestones: $('s-milestones').checked }, 0));
$('s-locale').addEventListener('change', () => {
  const tag = i18n.setLocale($('s-locale').value);
  refreshWeekNames();
  saveSetting({ locale: tag }, 0);
  // 새 언어로 다시 그려야 하는 것들 — 나머지는 data-i18n이 알아서 바뀝니다
  renderLanguagePickers();
  renderThemes();
  renderPush();
  renderPhotoNote();
  render();
});
$('s-region').addEventListener('change', () => {
  saveSetting({ region: $('s-region').value }, 0);
  render();
});
$('s-timezone').addEventListener('change', () => {
  saveSetting({ timezone: $('s-timezone').value }, 0);
});
// 창이 닫힐 때도 한 번 — 못 미더워도 해로울 건 없습니다. 이게 안 떠도
// 디바운스 타이머는 창과 상관없이 돌아서 결국 담깁니다.
$('settings').addEventListener('close', sendSettings);
$('settings-close').addEventListener('click', sendSettings);
$('s-logout').addEventListener('click', async () => {
  if (!await ask(t('ask.logout'), t('ask.logoutYes'))) return;
  $('settings').close();
  await logOut();
});
$('s-delete').addEventListener('click', async () => {
  const byPassword = state.hasPassword;
  const message = t(state.paired ? 'ask.deleteAccountPaired' : 'ask.deleteAccountAlone')
    + '\n' + t(byPassword ? 'ask.confirmPassword' : 'ask.confirmGoogle');
  const proof = await ask(message, t('ask.deleteAccountYes'), byPassword ? { password: true } : { google: true });
  if (!proof) return;
  try {
    await api.call('DELETE', '/api/account', byPassword ? { password: proof } : { credential: proof });
    // 서버는 내 기기 줄을 이미 지웠습니다. 이 기기 쪽 구독만 마저 끕니다
    await pushSub?.unsubscribe().catch(() => {});
    pushSub = null;
    $('settings').close();
    signOut();
    toast(t('toast.accountDeleted'));
  } catch (err) {
    toast(err.message || t('error.saveFailed'));
  }
});
$('s-password').addEventListener('click', () => {
  $('pw-current').value = '';
  $('pw-new').value = '';
  $('pw').showModal();
  $('pw-current').focus();
});
$('pw-cancel').addEventListener('click', () => $('pw').close());
$('pw-form').addEventListener('submit', (e) => {
  e.preventDefault();
  once($('pw-save'), async () => {
    try {
      await api.call('PATCH', '/api/account', { current: $('pw-current').value, password: $('pw-new').value });
      $('pw').close();
      toast(t('toast.passwordChanged'));
    } catch (err) {
      toast(err.message || t('error.saveFailed'));
    }
  });
});
$('s-push').addEventListener('click', togglePush);

/* ── 홈 화면에 설치 ──
   크롬·엣지는 설치할 수 있을 때 beforeinstallprompt를 한 번 줍니다 — 이미 설치했으면 안 줘요.
   받아 뒀다가 누르면 바로 설치 창을 띄웁니다. 아이폰은 웹페이지가 대신 설치해 줄 길이 애플에 없어서
   공유 시트를 열어 주거나 "공유 → 홈 화면에 추가"를 그림으로 안내해요. 홈 화면에서 연 앱과 스토어 앱은 건너뜁니다.
   권하는 건 처음 들어올 때 한 번(아래 "처음 들어올 때")과 설정의 설치 버튼뿐입니다.
   (공유 시트를 대신 여는 navigator.share는 쓰지 않습니다 — 웹이 연 공유 시트에는 "홈 화면에 추가"가 없어요.
   실기기 확인, docs/IOS_INSTALL_RESEARCH.md) */
let installPrompt = null;
let promptWaiters = []; // 설치 신호를 잠깐 기다리는 쪽 (offerInstall)

const installed = () =>
  navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

/* 카톡·인스타 같은 앱 안의 화면. 홈 화면에 추가 메뉴가 없고, 구글 로그인도 막힙니다(disallowed_useragent).
   초대 링크는 대개 카톡으로 오니까 여기서 바깥 브라우저로 내보내는 게 첫 관문이에요. */
const APP_BROWSER = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|NAVER\(inapp|DaumApps|Line\/|BAND\/|everytimeApp|Twitter|TikTok|musical_ly|Snapchat/i;
const appBrowser = () => !inApp() && APP_BROWSER.test(navigator.userAgent);

/* 초대 코드는 곧 주소창에서 걷어내니(readLinkCodes), 들어온 그대로의 주소를 먼저 적어 둡니다 */
const arrivedAt = location.href;

/** 바깥 브라우저로 여는 주소. 카톡은 공식 주소가 있고(아이폰·안드로이드 둘 다), 라인은 꼬리표로,
    안드로이드의 나머지는 intent로 기본 브라우저를 엽니다. 아이폰의 다른 앱들은 길이 없어서 null. */
function outsideUrl(ua = navigator.userAgent, url = arrivedAt) {
  if (/KAKAOTALK/i.test(ua)) return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  if (/Line\//.test(ua)) {
    const u = new URL(url);
    u.searchParams.set('openExternalBrowser', '1');
    return u.href;
  }
  if (/Android/i.test(ua)) return `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;end`;
  return null;
}

function leaveAppBrowser() {
  const url = outsideUrl();
  if (url) location.href = url;
  return !!url;
}

/** 지금 이 화면에서 설치로 갈 길이 있는지 */
const canInstall = () =>
  !inApp() && !installed() && (!!installPrompt || safariTab() || appBrowser());

/** 설정의 설치 버튼 — 로그인 화면에는 두지 않습니다(구글 버튼 하나만) */
function showInstallButtons() {
  $('s-install-field').hidden = !canInstall();
}

function hideInstall() {
  installPrompt = null; // 한 번 쓴 건 다시 못 띄웁니다
  showInstallButtons();
}

/** 아이폰 사파리는 단계 그림, 앱 안 화면은 "브라우저로 열기" 안내.
    firstRun이면 아래에 "나중에"를 두고, 닫히면 사용법으로 이어집니다 (closeInstallGuide). */
let installGuideFirstRun = false;

function openInstallGuide(mode, { firstRun = false } = {}) {
  const away = mode === 'away';
  installGuideFirstRun = firstRun;
  $('install-guide-later').hidden = !firstRun;
  // 첫 화면에서는 언어를 고르기 전에 열려서, 고른 뒤 applyI18n이 다시 옮기도록 키로 답니다
  $('install-guide-title').dataset.i18n = away ? 'install.awayTitle' : 'install.guideTitle';
  $('install-guide-title').textContent = t($('install-guide-title').dataset.i18n);
  $('install-guide-ios').hidden = away;
  $('install-guide-away').hidden = !away;
  $('install-guide-open').hidden = !away || !outsideUrl();
  // 사파리의 공유 버튼은 화면 아래쪽에 있어서 그쪽을 가리킵니다. 다른 브라우저는 위치가 제각각이라 생략
  $('install-guide').classList.toggle('point-down',
    !away && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent));
  if (!$('install-guide').open) $('install-guide').showModal();
}

/** 설정의 설치 버튼 */
async function install() {
  if (appBrowser()) return openInstallGuide('away');
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    return hideInstall();
  }
  if (safariTab()) return openInstallGuide('ios');
}

async function copyArrivedAt() {
  await navigator.clipboard?.writeText(arrivedAt).then(() => toast(t('install.copied')), () => {});
}

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  showInstallButtons();
  promptWaiters.forEach((fn) => fn());
  promptWaiters = [];
});
addEventListener('appinstalled', hideInstall);
$('s-install').addEventListener('click', install);
$('install-guide-close').addEventListener('click', () => $('install-guide').close());
$('install-guide-later').addEventListener('click', () => $('install-guide').close());
// 처음 들어와 뜬 그림 안내는 어떻게 닫든(나중에·×·Esc) 사용법으로 이어집니다
$('install-guide').addEventListener('close', () => {
  if (!installGuideFirstRun) return;
  installGuideFirstRun = false;
  $('install-guide-later').hidden = true;
  maybeGuide();
});
$('install-guide-open').addEventListener('click', leaveAppBrowser);
$('install-guide-copy').addEventListener('click', copyArrivedAt);
if (appBrowser()) {
  // 먼저 알아서 내보내 보고, 안 되는 앱이면 남은 화면에서 길을 알려줍니다
  leaveAppBrowser();
  openInstallGuide('away');
}
showInstallButtons();

/* ── 처음 들어올 때: 한 번에 한 화면, 한 가지 할 일 ──
   (앱 안 화면이면 바깥 브라우저로) → 구글 로그인 → 내 이름 → 홈 화면 추가 한 번 → 사용법.
   load()가 달력을 그린 뒤 firstSteps()를 부르고, 각 화면이 끝나면 다음 것을 부릅니다.
   이미 지난 단계는 건너뛰니, 앱을 열 때마다 불러도 할 일이 없으면 아무것도 안 뜹니다.

   사용법은 홈 화면 앱(또는 스토어 앱)으로 처음 열 때 띄웁니다. 브라우저에서 설치를 건너뛰었거나
   설치할 길이 없으면 그 자리에서 띄워요. 설치하겠다고 했으면 브라우저에서는 띄우지 않습니다 —
   곧 홈 화면 앱으로 다시 열 테니까요. 기기마다 기억합니다(diary_install_offered · diary_guide). */
const INSTALL_OFFERED = 'diary_install_offered'; // 'taken' | 'skipped'
const PROMPT_WAIT_MS = 2000; // 안드로이드 크롬은 설치 신호를 페이지가 뜬 뒤 조금 있다 줍니다
let googleName = ''; // 방금 구글이 알려준 이름. 이름 칸을 미리 채우는 데만 씁니다

/** 구글 ID 토큰 안의 이름(given_name). 서명 확인은 서버 몫이고, 여기선 칸을 미리 채울 뿐이라 읽기만 합니다. */
function givenName(credential) {
  try {
    const part = String(credential).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    return String(claims.given_name || claims.name || '').trim().slice(0, 12);
  } catch {
    return '';
  }
}

function firstSteps() {
  if (!state.me) return;
  if (!state.settings.names?.[state.me]) return askName();
  offerInstall();
}

/** ① 뭐라고 불러 드릴까요? — 비어 있을 때만. 가입한 사람도, 초대로 들어온 상대도 */
function askName() {
  $('name-ask-input').value = googleName;
  if (!$('name-ask').open) $('name-ask').showModal();
}

async function saveMyName(e) {
  e?.preventDefault();
  const name = $('name-ask-input').value.trim().slice(0, 12);
  if (!name) { $('name-ask-input').focus(); return; }
  await once($('name-ask-go'), async () => {
    try {
      // 내 자리 이름만 보냅니다 — 그새 상대가 고친 이름을 덮지 않게 (lib/http.js normalizeSettings)
      const saved = await api.call('PATCH', '/api/settings', { names: { [state.me]: name } });
      state.settings.names = { ...state.settings.names, ...saved.names };
      googleName = '';
      rememberState();
      render();
      $('name-ask').close();
      offerInstall();
    } catch (err) {
      toast(err.message || t('error.saveFailed'));
    }
  });
}

const promptArrives = (ms) => new Promise((resolve) => {
  if (installPrompt) return resolve();
  const timer = setTimeout(resolve, ms);
  promptWaiters.push(() => { clearTimeout(timer); resolve(); });
});

/** ② 홈 화면에 — 브라우저 탭에서, 이 기기에 한 번만.
    안드로이드는 "둘까요?" 창 → 시스템 설치 창. 아이폰은 묻지 않고 바로 3단계 그림 안내 (창 하나, 할 일 하나) */
async function offerInstall() {
  if (inApp() || installed()) return maybeGuide();
  const offered = localStorage.getItem(INSTALL_OFFERED);
  if (offered === 'taken') return;
  if (offered) return maybeGuide();
  if (!installPrompt && /Android/i.test(navigator.userAgent)) await promptArrives(PROMPT_WAIT_MS);
  const ios = !installPrompt && safariTab();
  if (!installPrompt && !ios) return maybeGuide(); // 설치할 길이 없는 브라우저 — 바로 사용법
  localStorage.setItem(INSTALL_OFFERED, 'skipped'); // 창을 그냥 닫고 떠나도 다시 묻지 않게
  if (ios) return openInstallGuide('ios', { firstRun: true });
  if (!$('install-offer').open) $('install-offer').showModal();
}

/** 안드로이드: 버튼 한 번 → 시스템 설치 창 */
async function takeInstall() {
  $('install-offer').close();
  const prompt = installPrompt;
  if (!prompt) return skipInstall();
  localStorage.setItem(INSTALL_OFFERED, 'taken');
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  hideInstall();
  if (outcome !== 'accepted') skipInstall();
}

/** 나중에 — 설치는 설정에 남아 있고, 사용법은 지금 여기서 */
function skipInstall() {
  localStorage.setItem(INSTALL_OFFERED, 'skipped');
  $('install-offer').close();
  maybeGuide();
}

$('name-ask-form').addEventListener('submit', saveMyName);
$('name-ask').addEventListener('cancel', (e) => e.preventDefault()); // 이름은 건너뛰지 않습니다 — 상대 화면에 뜰 이름이라
$('install-offer-go').addEventListener('click', takeInstall);
$('install-offer-later').addEventListener('click', skipInstall);
$('install-offer').addEventListener('cancel', (e) => { e.preventDefault(); skipInstall(); });
$('s-invite').addEventListener('click', makeInvite);
$('s-invite-copy').addEventListener('click', copyInvite);
$('s-invite-link').addEventListener('focus', (e) => e.target.select()); // 누르면 통째로 골라져서 복사하기 쉽게
$('guide-open').addEventListener('click', () => openGuide('use'));
$('guide-tab-setup').addEventListener('click', () => showGuideTab('setup'));
$('guide-tab-use').addEventListener('click', () => showGuideTab('use'));
$('guide-close').addEventListener('click', () => $('guide').close());
$('guide-cta').addEventListener('click', guideCta);
$('s-photos-open').addEventListener('click', openPhotos);
$('photos-close').addEventListener('click', () => $('photos').close());
$('s-photo-add').addEventListener('click', () => $('s-photo-file').click());
$('s-photo-file').addEventListener('change', (e) => {
  const files = [...e.target.files];
  e.target.value = ''; // 같은 사진을 다시 골라도 change가 뜨게
  if (files.length) addPhotos(files);
});

bindRepeat();
bindTime();
bindDatePicker();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('sheet').hidden) closeSheet();
});

/* ── 다른 기기에서 바뀐 내용 따라오기 ─────────
   Neon은 5분 놀면 잠들고, 깨어 있는 시간만큼 무료 한도를 씁니다.
   그래서 화면을 실제로 보고 있을 때만, 그것도 2분에 한 번만 확인합니다.
   탭으로 돌아오는 순간에는 즉시 한 번 맞춰줍니다.                        */
const IDLE_LIMIT = 10 * 60 * 1000;
let lastTouch = Date.now();

['pointerdown', 'keydown'].forEach((type) => {
  document.addEventListener(type, () => { lastTouch = Date.now(); }, { passive: true });
});

/* 탭이 살아나면 focus와 visibilitychange가 나란히 터집니다. 그대로 두면
   /api/state를 두세 번 연달아 부르는데, Neon이 잠들어 있으면 한 번에
   1~2초라 그게 곧 체감 속도입니다. 방금 받아왔으면 건너뜁니다. */
const SYNC_GAP = 15000;
let syncing = false;
let lastSync = 0;

async function sync(force = false) {
  if (!signedIn() || $('app').hidden) return;
  if (!force && (document.hidden || Date.now() - lastTouch > IDLE_LIMIT)) return;
  if (syncing || Date.now() - lastSync < SYNC_GAP) return;

  syncing = true;
  try {
    const data = await api.call('GET', '/api/state');
    // 되돌리기를 기다리는 일정은 서버엔 아직 있지만 화면에선 지운 것 — 다시 그리지 않습니다
    if (pendingDelete) data.events = data.events.filter((x) => x.id !== pendingDelete.event.id);
    const changed =
      JSON.stringify(data.events) !== JSON.stringify(state.events) ||
      JSON.stringify(data.photos || []) !== JSON.stringify(state.photos) ||
      JSON.stringify(data.settings) !== JSON.stringify(state.settings) ||
      data.paired !== state.paired; // 상대가 막 들어왔으면 초대 칸을 걷어야 합니다
    if (changed) {
      state.events = data.events;
      state.settings = data.settings;
      state.photos = data.photos || [];
      state.paired = data.paired;
      rememberState();
      refreshPhotos();
      renderTitle();
      restoreTheme();
      renderInvite();
      renderPeople(); // 상대가 막 들어왔으면 그 이름 칸을 엽니다
      state.picked ? openSheet(state.picked) : render();
    }
  } catch { /* 조용히 넘어감 */ } finally {
    syncing = false;
    lastSync = Date.now();
  }
}

setInterval(() => sync(), 120000);
document.addEventListener('visibilitychange', () => {
  // 아이폰 홈 화면 앱은 떠날 때 pagehide가 안 올 수 있어서, 숨겨질 때 기다리던 지우기를 보내 둡니다
  if (document.hidden) { sendDelete({ leaving: true }); return; }
  lastTouch = Date.now();
  sync(true);
});
window.addEventListener('focus', () => { lastTouch = Date.now(); sync(true); });

/* 확대 차단 — iOS 사파리는 viewport 설정을 무시하므로 제스처를 막는다 */
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
});

let pendingState = null;

/* 시작 */
(async () => {
  /* 서버에 묻기 전이라 브라우저 언어(또는 지난번 고른 것)로 먼저 씁니다.
     로그인해서 설정을 받으면 applyState가 그쪽으로 맞춥니다. */
  i18n.setLocale(i18n.preferred());
  refreshWeekNames();
  $('gate-about').href = `/${i18n.getLocale()}/`; // 소개 페이지는 언어마다 따로 있어요 (landing.mjs)

  paintTheme(localStorage.getItem('diary_theme') || 'peach');

  readLinkCodes();
  showGateNote();

  /* 인트로가 도는 1초를 그냥 흘려보내지 않고 미리 받아옵니다. 초대를 받으러 왔으면
     곧 다른 달력으로 옮겨가니 지금 달력을 받아둘 필요가 없어요. */
  const goingIn = signedIn();
  if (goingIn && !pendingInvite) {
    pendingState = api.call('GET', '/api/state');
    pendingState.catch(() => {}); // load()가 다시 기다립니다 — 여기선 표시만
  }
  /* 로그인 전이라 서버에 못 묻습니다 — 지난번에 봤던 이름으로 먼저 그립니다.
     이 기기가 로그인된 채일 때만요. 아니면 그 이름은 로그인이 없던 예전 판이나
     다른 커플이 남긴 것이라, 기본 이름을 그리고 renderTitle이 지워버립니다. */
  if (signedIn()) {
    state.settings.title = localStorage.getItem('diary_title') || state.settings.title;
    state.settings.subtitle = localStorage.getItem('diary_sub') || state.settings.subtitle;
  }
  renderTitle();

  show('intro');
  const intro = $('intro');
  // 열 때마다 기다리지 않게 — 짧게 보여주고, 톡 누르면 바로 넘어갑니다
  await new Promise((resolve) => {
    const skip = () => {
      clearTimeout(timer);
      intro.removeEventListener('pointerdown', skip);
      resolve();
    };
    const timer = setTimeout(skip, 550);
    intro.addEventListener('pointerdown', skip);
  });
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    intro.addEventListener('transitionend', finish, { once: true });
    intro.classList.add('is-leaving');
    setTimeout(finish, 500); // transitionend가 안 오는 경우(감소된 모션 등) 대비
  });
  if (!goingIn) {
    show('gate');
    offerGoogle();
    return;
  }
  if (pendingInvite) {
    await acceptInvite(pendingInvite);
    pendingInvite = '';
    showGateNote();
  }
  await enter();
})();
