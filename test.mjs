/**
 * 실제 핸들러를 진짜 Postgres(PGlite, 인메모리)에 물려서 돌립니다.
 * Neon 대신 PGlite를 끼워 넣는 것 말고는 배포될 코드와 같은 경로를 탑니다.
 */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { useClient } from './lib/db.js';

process.env.DIARY_URL = 'https://diary.test';
process.env.PASSWORD_SIGNIN = 'on'; // 계정을 아이디로 만들어 씁니다. 꺼진 기본값은 맨 아래에서 따로 봅니다
process.env.DATABASE_URL = 'postgres://pglite.test'; // 실제로 붙지는 않습니다 — 아래 useClient가 가로챕니다

/* 표를 미리 만들지 않습니다. Deploy 버튼으로 막 만든 DB처럼 텅 빈 채로 시작해서,
   첫 가입이 표와 열쇠를 만드는지 봅니다. */
const pg = new PGlite();

// 태그드 템플릿 -> $1, $2 ... 로 바꿔서 PGlite에 넘깁니다.
const client = (strings, ...values) => {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  return pg.query(text, values).then((r) => r.rows);
};
let statementsRun = 0;
client.query = (text) => { statementsRun++; return pg.query(text).then((r) => r.rows); };
useClient(client);

/* 계정 창구는 api/auth.js 하나가 나눠 받습니다. vercel.json이 붙여주는 ?op= 그대로 부릅니다. */
const { default: auth } = await import('./api/auth.js');
const viaAuth = (op) => (req, res) => auth({ ...req, query: { ...req.query, op } }, res);
const signup = viaAuth('signup');
const login = viaAuth('login');
const logout = viaAuth('logout');
const invite = viaAuth('invite');
const { default: state } = await import('./api/state.js');
const { default: settings } = await import('./api/settings.js');
const { default: eventsCreate } = await import('./api/events/index.js');
const { default: eventById } = await import('./api/events/[id].js');

/* 최소한의 가짜 req/res. token은 로그인 쿠키로 실립니다 (브라우저가 하는 그대로). */
function call(handler, { method = 'GET', body, token, query = {}, headers = {} } = {}) {
  const req = { method, body, query, headers: { ...headers, ...(token ? { cookie: 'other=1; diary_session=' + token } : {}) } };
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const out = { status: 200, body: undefined, headers: {} };
  const res = {
    status(code) { out.status = code; return res; },
    setHeader(k, v) { out.headers[k] = v; return res; },
    json(payload) { out.body = payload; resolve(out); return res; },
    end(payload) { if (payload !== undefined) out.body = payload; resolve(out); return res; },
  };
  handler(req, res);
  return done;
}

/** 응답이 심어준 로그인 쿠키의 값. */
const cookieOf = (res) => /diary_session=([^;]*)/.exec(res.headers['Set-Cookie'] || '')?.[1] || '';

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

const { keys, forgetKeys } = await import('./lib/setup.js');
const tables = async () =>
  (await pg.query(`select table_name from information_schema.tables where table_schema = 'public' order by 1`))
    .rows.map((row) => row.table_name).join();
const meta = async () =>
  Object.fromEntries((await pg.query('select name, value from app_meta order by name')).rows.map((row) => [row.name, row.value]));

const PW = 'correct horse';
const join = async (username, invitation) =>
  cookieOf(await call(signup, { method: 'POST', body: { username, password: PW, invite: invitation } }));
const coupleOf = async (username) => (await pg.query(
  'select m.couple_id from couple_members m join users u on u.id = m.user_id where u.username = $1', [username],
)).rows[0]?.couple_id;

/* ── 가입 ── */
let r = await call(signup, { method: 'POST', body: { username: 'na', password: PW } });
ok('a username has at least 3 characters', r.status === 400 && r.body.error === 'error.badUsername', JSON.stringify(r.body));
r = await call(signup, { method: 'POST', body: { username: 'na na@x', password: PW } });
ok('and only letters, numbers and . _ -', r.status === 400 && r.body.error === 'error.badUsername', JSON.stringify(r.body));

r = await call(signup, { method: 'POST', body: { username: 'nana', password: 'short' } });
ok('sign-up wants 8 characters of password', r.status === 400 && r.body.error === 'error.shortPassword', JSON.stringify(r.body));

r = await call(signup, { method: 'POST', body: { username: '  NaNa ', password: PW } });
let token = cookieOf(r);
ok('sign-up signs you in', r.status === 201 && token.length > 40, JSON.stringify(r.body));
const cookie = r.headers['Set-Cookie'];
ok('the sign-in cookie cannot be read by scripts or sent from other sites',
  /HttpOnly/.test(cookie) && /SameSite=Lax/.test(cookie) && /Secure/.test(cookie) && /Path=\//.test(cookie), cookie);

/* ── 처음 켜질 때 — 설치하는 사람이 표도 열쇠도 만들지 않습니다 ── */
ok('the first sign-up creates the tables',
  (await tables()) === 'app_meta,couple_members,couples,events,invites,login_failures,photos,push_subs,reminders_sent,sessions,settings,signups,users',
  await tables());
const first = await meta();
ok('it makes a clock key', /^[0-9a-f]{48}$/.test(first.cron_secret) && !('diary_secret' in first), JSON.stringify(Object.keys(first)));
const firstVapid = JSON.parse(first.vapid);
ok('it makes a VAPID pair of the right shape',
  /^[A-Za-z0-9_-]{87}$/.test(firstVapid.publicKey) && /^[A-Za-z0-9_-]{43}$/.test(firstVapid.privateKey));

ok('the username is kept in one spelling, and no email is asked for',
  JSON.stringify((await pg.query('select username, email from users')).rows[0]) === '{"username":"nana","email":null}');
ok('the password is not kept as it was typed',
  !(await pg.query('select password_hash from users')).rows[0].password_hash.includes(PW));
ok('the cookie is not kept as it was sent',
  (await pg.query('select count(*)::int as n from sessions where token_hash = $1', [token])).rows[0].n === 0);

r = await call(signup, { method: 'POST', body: { username: 'NANA', password: PW } });
ok('one username signs up once', r.status === 409 && r.body.error === 'error.usernameTaken', JSON.stringify(r.body));

r = await call(state, { token });
ok('a new account gets a calendar of its own', r.status === 200 && r.body.events.length === 0);
ok('and sits in the first seat', r.body.me?.slot === 'a' && r.body.me?.login === 'nana', JSON.stringify(r.body.me));
ok('and waits for the other one', r.body.paired === false);

/* ── 로그인 ── */
r = await call(login, { method: 'POST', body: { username: 'nana', password: 'wrong one' } });
ok('wrong password rejected', r.status === 401 && r.body.error === 'error.wrongLogin');
const wrongPw = r.body;

r = await call(login, { method: 'POST', body: { username: 'nobody', password: PW } });
ok('an unknown username gets the very same answer', r.status === 401 && JSON.stringify(r.body) === JSON.stringify(wrongPw));

r = await call(login, { method: 'POST', body: { username: 'NANA', password: PW } });
const second = cookieOf(r);
ok('login sets a fresh cookie', r.status === 200 && second && second !== token);

r = await call(login, { method: 'GET' });
ok('wrong method 405', r.status === 405);

/* 열 번 틀리면 15분 동안은 맞는 비밀번호도 받지 않습니다 */
for (let i = 0; i < 10; i++) {
  await call(login, { method: 'POST', body: { username: 'nana', password: 'guess ' + i } });
}
r = await call(login, { method: 'POST', body: { username: 'nana', password: PW } });
ok('ten wrong tries lock the door for a while', r.status === 429 && r.body.error === 'error.tooManyTries');
await pg.query('delete from login_failures');

r = await call(logout, { method: 'POST', token: second });
ok('logout answers 204 and drops the cookie',
  r.status === 204 && /Max-Age=0/.test(r.headers['Set-Cookie'] || ''), r.headers['Set-Cookie']);
r = await call(state, { token: second });
ok('a logged-out cookie no longer opens the calendar', r.status === 401);
r = await call(logout, { method: 'POST', token: second });
ok('logging out twice is fine', r.status === 204);
r = await call(state, { token });
ok('other devices stay signed in', r.status === 200);

/* 서버 인스턴스가 새로 떠도 (배포, 콜드 스타트) 로그인이 풀리면 안 됩니다 */
forgetKeys();
statementsRun = 0;
r = await call(state, { token });
ok('a fresh instance keeps you signed in', r.status === 200);
ok('and does not run the schema again', statementsRun === 0, String(statementsRun));
ok('and does not replace any key', JSON.stringify(await meta()) === JSON.stringify(first));

/* schema.sql이 바뀌면(새 컬럼 등) 다음 인스턴스가 다시 돌립니다. 열쇠도 로그인도 그대로. */
await pg.query(`update app_meta set value = 'old' where name = 'schema'`);
forgetKeys();
r = await call(state, { token });
ok('a changed schema.sql is applied again', statementsRun > 0 && (await meta()).schema !== 'old');
ok('without touching the keys or the sign-in', r.status === 200 && (await meta()).vapid === first.vapid);

/* 이메일로 가입하던 때의 계정 — 그 이메일이 아이디가 되어 그대로 들어와야 합니다 */
{
  const { hashPassword } = await import('./lib/auth.js');
  await pg.query('insert into users (email, password_hash) values ($1, $2)', ['old@test.dev', await hashPassword(PW)]);
  await pg.query(`update app_meta set value = 'old' where name = 'schema'`);
  forgetKeys();
  await call(state, { token });
  r = await call(login, { method: 'POST', body: { username: 'Old@Test.dev', password: PW } });
  ok('an account made with an email signs in with that email as its username', r.status === 200, JSON.stringify(r.body));
  await pg.query(`delete from users where email = 'old@test.dev'`);
}

/* 두 인스턴스가 동시에 처음 뜨면 둘 다 열쇠를 만들려 합니다. 한쪽 것만 남아야 해요. */
await pg.query(`delete from app_meta where name in ('cron_secret', 'vapid')`);
forgetKeys();
const racing = await Promise.all([keys(), (forgetKeys(), keys())]);
ok('two instances racing agree on one set of keys',
  JSON.stringify(racing[0]) === JSON.stringify(racing[1]) && racing[0].vapidPublic === JSON.parse((await meta()).vapid).publicKey);

/* 60일짜리 로그인이지만 쓰는 동안은 계속 연장됩니다 — 매일 쓰는 달력이 두 달마다 로그아웃되면 안 되니까요 */
{
  const hash = (await pg.query('select token_hash from sessions order by created_at limit 1')).rows[0].token_hash;
  await pg.query(`update sessions set expires_at = now() + interval '10 days' where token_hash = $1`, [hash]);
  r = await call(state, { token });
  const left = (await pg.query(`select expires_at > now() + interval '59 days' as long from sessions where token_hash = $1`, [hash])).rows[0].long;
  ok('a sign-in in use is stretched again', r.status === 200 && left && cookieOf(r) === token);

  r = await call(state, { token });
  ok('but not on every call', !r.headers['Set-Cookie']);

  await pg.query(`update sessions set expires_at = now() - interval '1 second' where token_hash = $1`, [hash]);
  r = await call(state, { token });
  ok('an expired sign-in is turned away', r.status === 401);
  await pg.query(`update sessions set expires_at = now() + interval '60 days' where token_hash = $1`, [hash]);
}

/* Deploy 화면에서 Neon을 건너뛰면 — 무엇이 빠졌는지 말해줍니다 */
{
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  r = await call(login, { method: 'POST', body: { username: 'nana', password: PW } });
  ok('no database says so', r.status === 500 && r.body.error === 'error.noDatabase', JSON.stringify(r.body));
  r = await call(state, { token });
  ok('and so does every other call', r.status === 500 && r.body.error === 'error.noDatabase');
  process.env.DATABASE_URL = saved;
}

r = await call(state);
ok('no cookie blocked', r.status === 401);

r = await call(state, { token: 'a'.repeat(43) });
ok('wrong cookie blocked', r.status === 401);

/* ── 상대 부르기 ── */
r = await call(invite, { method: 'POST' });
ok('an invite needs a sign-in', r.status === 401);

r = await call(invite, { method: 'POST', token });
const code = r.body?.code;
ok('an invite code is handed out', r.status === 201 && typeof code === 'string' && code.length > 30);

r = await call(signup, { method: 'POST', body: { username: 'neo', password: PW, invite: 'made-up' } });
ok('a made-up invite is refused', r.status === 400 && r.body.error === 'error.badInvite');
ok('and makes no account', (await pg.query(`select count(*)::int as n from users where username = 'neo'`)).rows[0].n === 0);

r = await call(signup, { method: 'POST', body: { username: 'nana', password: PW, invite: code } });
ok('an invite does not let a taken username in', r.status === 409 && r.body.error === 'error.usernameTaken', JSON.stringify(r.body));

const tokenB = await join('neo', code);
r = await call(state, { token: tokenB });
ok('the invited one joins the same calendar',
  (await coupleOf('neo')) === (await coupleOf('nana')));
ok('in the other seat', r.body.me?.slot === 'b', JSON.stringify(r.body.me));
ok('and both see they are two now', r.body.paired === true && (await call(state, { token })).body.paired === true);

r = await call(signup, { method: 'POST', body: { username: 'third', password: PW, invite: code } });
ok('an invite works once', r.status === 400 && r.body.error === 'error.badInvite');

r = await call(invite, { method: 'POST', token });
ok('a full calendar hands out no more invites', r.status === 409 && r.body.error === 'error.alreadyPaired');

/* 링크는 일주일이면 죽습니다 */
{
  const lonely = await join('lonely');
  const old = (await call(invite, { method: 'POST', token: lonely })).body.code;
  await pg.query(`update invites set expires_at = now() - interval '1 second'`);
  r = await call(signup, { method: 'POST', body: { username: 'late', password: PW, invite: old } });
  ok('an old invite is refused', r.status === 400 && r.body.error === 'error.badInvite');

  const fresh = (await call(invite, { method: 'POST', token: lonely })).body.code;
  const again = (await call(invite, { method: 'POST', token: lonely })).body.code;
  r = await call(signup, { method: 'POST', body: { username: 'late', password: PW, invite: fresh } });
  ok('a new invite kills the one before it', r.status === 400 && again !== fresh);

  /* 이미 가입해 혼자 쓰던 사람도 초대를 받을 수 있습니다 — 빈 달력은 버리고 옮겨갑니다 */
  const solo = await join('solo');
  const soloCouple = await coupleOf('solo');
  r = await call(invite, { method: 'PUT', token: solo, body: { code: again } });
  ok('someone already signed up can accept an invite', r.status === 200, JSON.stringify(r.body));
  ok('and moves into that calendar', (await coupleOf('solo')) === (await coupleOf('lonely')));
  ok('leaving the empty one behind',
    (await pg.query('select count(*)::int as n from couples where id = $1', [soloCouple])).rows[0].n === 0);
  r = await call(state, { token: solo });
  ok('seated in the free seat, signed in the whole time', r.status === 200 && r.body.me.slot === 'b' && r.body.paired);

  /* 혼자서도 이미 쓰고 있었다면 옮기지 않습니다 — 그 일정을 조용히 지울 수는 없으니까요 */
  const busy = await join('busy');
  await call(eventsCreate, { method: 'POST', token: busy, body: { title: 'mine', date: '2026-08-01' } });
  const host = await join('host');
  const hostCode = (await call(invite, { method: 'POST', token: host })).body.code;
  r = await call(invite, { method: 'PUT', token: busy, body: { code: hostCode } });
  ok('a calendar already in use is not thrown away', r.status === 409 && r.body.error === 'error.hasOwnCalendar');
  r = await call(invite, { method: 'PUT', token: tokenB, body: { code: hostCode } });
  ok('someone already paired stays put', r.status === 409 && r.body.error === 'error.alreadyPaired');
  r = await call(invite, { method: 'PUT', token: host, body: { code: hostCode } });
  ok('nobody joins their own calendar', r.status === 400 && r.body.error === 'error.badInvite');
}

/* ── 만들기 ── */
r = await call(eventsCreate, {
  method: 'POST', token,
  body: { title: '영화 보기', date: '2026-08-22', time: '19:30', owner: 'both', memo: '메가박스' },
});
const movie = r.body;
ok('create returns 201', r.status === 201);
ok('date not shifted by timezone', movie.date === '2026-08-22', movie.date);
ok('time round-trips', movie.time === '19:30');
ok('memo round-trips', movie.memo === '메가박스');

r = await call(eventsCreate, {
  method: 'POST', token,
  body: { title: '스터디', date: '2026-08-24', time: '10:00', endTime: '12:30', owner: 'both' },
});
const study = r.body;
ok('endTime round-trips', study.time === '10:00' && study.endTime === '12:30');
await call(eventById, { method: 'DELETE', token, query: { id: study.id } });

r = await call(eventsCreate, {
  method: 'POST', token,
  body: { title: '메모만', date: '2026-08-24', endTime: '12:30', owner: 'both' },
});
ok('endTime ignored without time', r.body.time === null && r.body.endTime === null);
await call(eventById, { method: 'DELETE', token, query: { id: r.body.id } });

r = await call(eventsCreate, {
  method: 'POST', token,
  body: { title: '생일', date: '1995-08-25', owner: 'b', repeat: 'yearly' },
});
ok('yearly repeat stored', r.body.repeat === 'yearly' && r.body.owner === 'b');

r = await call(eventsCreate, {
  method: 'POST', token,
  body: { title: '여행', date: '2026-08-28', endDate: '2026-08-30', owner: 'both' },
});
const trip = r.body;
ok('endDate stored', trip.endDate === '2026-08-30', String(trip.endDate));

/* ── 검증 ── */
r = await call(eventsCreate, { method: 'POST', token, body: { title: '   ', date: '2026-08-22' } });
ok('blank title 400', r.status === 400, r.body?.error);

r = await call(eventsCreate, { method: 'POST', token, body: { title: 'x', date: '22/08/2026' } });
ok('bad date 400', r.status === 400);

r = await call(eventsCreate, { method: 'POST', token, body: { title: '거꾸로', date: '2026-08-10', endDate: '2026-08-01' } });
ok('reversed date range 400', r.status === 400, r.body?.error);

r = await call(eventsCreate, { method: 'POST', token, body: { title: '거꾸로', date: '2026-08-10', time: '18:00', endTime: '09:00' } });
ok('reversed time range 400', r.status === 400, r.body?.error);

r = await call(eventsCreate, { method: 'POST', token, body: { title: 'x', date: '2026-08-10', owner: '해커', repeat: 'drop' } });
ok('bad enums fall back', r.body.owner === 'both' && r.body.repeat === 'none');
await call(eventById, { method: 'DELETE', token, query: { id: r.body.id } });

/* 일정마다 색 — 고르지 않으면 null(누구 일정인지의 색), 목록에 없는 색은 버립니다 */
r = await call(eventsCreate, { method: 'POST', token, body: { title: '시험', date: '2026-08-11', color: 'red' } });
ok('a picked color round-trips', r.status === 201 && r.body.color === 'red', r.body);
const colored = r.body.id;
r = await call(eventById, { method: 'PATCH', token, query: { id: colored }, body: { title: '시험 (변경)', date: '2026-08-11' } });
ok('editing something else keeps the color', r.body.color === 'red', r.body.color);
r = await call(eventById, { method: 'PATCH', token, query: { id: colored }, body: { date: '2026-08-11', color: null } });
ok('null takes the color off again', r.body.color === null, r.body.color);
r = await call(eventsCreate, { method: 'POST', token, body: { title: 'x', date: '2026-08-11', color: 'red; background:url(x)' } });
ok('a color not on the list is dropped', r.status === 201 && r.body.color === null, r.body.color);
ok('no color by default', movie.color === null, movie.color);
await call(eventById, { method: 'DELETE', token, query: { id: r.body.id } });
await call(eventById, { method: 'DELETE', token, query: { id: colored } });

r = await call(eventsCreate, { method: 'POST', token, body: { title: 'a'.repeat(200), date: '2026-08-10' } });
ok('long title clipped to 80', r.body.title.length === 80);
await call(eventById, { method: 'DELETE', token, query: { id: r.body.id } });

r = await call(eventsCreate, { method: 'POST', token, body: { title: "Bobby'; drop table events;--", date: '2026-08-10' } });
ok('sql injection is just text', r.status === 201 && r.body.title.includes('drop table'));
await call(eventById, { method: 'DELETE', token, query: { id: r.body.id } });
r = await call(state, { token });
ok('events table survived', Array.isArray(r.body.events));

/* ── 고치기 / 지우기 ── */
r = await call(eventById, {
  method: 'PATCH', token, query: { id: movie.id },
  body: { title: '영화 보기 (변경)', date: '2026-08-23' },
});
ok('patch merges base', r.status === 200 && r.body.owner === 'both' && r.body.memo === '메가박스');
ok('patch applies change', r.body.date === '2026-08-23' && r.body.title.includes('변경'));

r = await call(eventById, { method: 'PATCH', token, query: { id: 'not-a-uuid' }, body: { title: 'x' } });
ok('bad id 404 not 500', r.status === 404);

r = await call(eventById, { method: 'DELETE', token, query: { id: '00000000-0000-0000-0000-000000000000' } });
ok('missing id 404', r.status === 404);

r = await call(eventById, { method: 'DELETE', token, query: { id: trip.id } });
ok('delete 204', r.status === 204);

r = await call(eventById, { method: 'DELETE', token, query: { id: trip.id } });
ok('double delete 404', r.status === 404);

/* ── 설정 ── */
r = await call(settings, {
  method: 'PATCH', token,
  body: { names: { a: '나', b: '너' }, since: '2023-05-14', showMilestones: true },
});
ok('settings saved', r.status === 200 && r.body.names.b === '너');
ok('since is a plain string', r.body.since === '2023-05-14', String(r.body.since));

r = await call(settings, { method: 'PATCH', token, body: { names: { a: '', b: '너' } } });
ok('an empty name stays empty for the language pack to fill', r.body.names.a === '', r.body.names.a);
ok('partial patch keeps since', r.body.since === '2023-05-14');

r = await call(settings, { method: 'PATCH', token, body: { since: null } });
ok('since can be cleared', r.body.since === null);

/* 달력 이름 */
r = await call(settings, { method: 'PATCH', token });
ok('a fresh calendar has no name of its own', r.body.title === '', r.body.title);

await call(settings, { method: 'PATCH', token, body: { names: { a: '나', b: '너' }, since: '2023-05-14' } });
r = await call(settings, { method: 'PATCH', token, body: { title: '우리어리' } });
ok('title saved', r.body.title === '우리어리', r.body.title);
ok('naming the calendar keeps the rest',
  r.body.names.a === '나' && r.body.since === '2023-05-14', JSON.stringify(r.body));

r = await call(settings, { method: 'PATCH', token, body: { title: '   ' } });
ok('a blank title stays blank', r.body.title === '', r.body.title);

r = await call(settings, { method: 'PATCH', token, body: { title: '열두글자를넘기면잘립니다정말로' } });
ok('title clipped to 12', r.body.title.length === 12, r.body.title);

/* 인사말도 따로 고칩니다 — 이름에서 만들어 쓰지 않습니다 */
r = await call(settings, { method: 'PATCH', token });
ok('a fresh calendar has no greeting of its own', r.body.subtitle === '', r.body.subtitle);

r = await call(settings, { method: 'PATCH', token, body: { subtitle: '밥 먹었니' } });
ok('greeting saved', r.body.subtitle === '밥 먹었니', r.body.subtitle);
ok('greeting does not touch the name', r.body.title.length === 12, r.body.title);

r = await call(settings, { method: 'PATCH', token, body: { subtitle: '  ' } });
ok('a blank greeting stays blank', r.body.subtitle === '', r.body.subtitle);

r = await call(settings, { method: 'PATCH', token, body: { subtitle: '스무글자를넘기면잘립니다정말로그렇습니다진짜로' } });
ok('greeting clipped to 20', r.body.subtitle.length === 20, r.body.subtitle);

/* 테마는 둘이 같이 쓸 수 있어야 합니다 */
r = await call(settings, { method: 'PATCH', token });
ok('theme has a default', r.body.theme === 'peach', r.body.theme);

r = await call(settings, { method: 'PATCH', token, body: { theme: 'night' } });
ok('shared theme saved', r.body.theme === 'night', r.body.theme);

r = await call(state, { token });
ok('the other side sees the shared theme', r.body.settings.theme === 'night', r.body.settings.theme);

r = await call(settings, { method: 'PATCH', token, body: { theme: '' } });
ok('blank theme falls back', r.body.theme === 'peach', r.body.theme);
await call(settings, { method: 'PATCH', token, body: { subtitle: '우리 오늘 뭐하지' } });

/* 언어와 공휴일 묶음도 둘이 같이 씁니다 */
r = await call(settings, { method: 'PATCH', token });
ok('language starts unpicked, so the screen uses the browser language', r.body.locale === '', r.body.locale);
ok('no holiday set by default', r.body.region === 'none', r.body.region);

r = await call(settings, { method: 'PATCH', token, body: { locale: 'ko', region: 'kr' } });
ok('language saved', r.body.locale === 'ko', r.body.locale);
ok('holiday set saved', r.body.region === 'kr', r.body.region);

r = await call(state, { token });
ok('the other side sees the language', r.body.settings.locale === 'ko', r.body.settings.locale);

r = await call(settings, { method: 'PATCH', token, body: { showMilestones: true } });
ok('changing another setting keeps the language', r.body.locale === 'ko', r.body.locale);

r = await call(settings, { method: 'PATCH', token, body: { locale: '' } });
ok('a blank language falls back to English', r.body.locale === 'en', r.body.locale);

/* 예전 판은 기본값이 'en'이라 한국어 폰도 로그인하자마자 영어가 됐습니다.
   그 DB는 다음 배포 때 한 번만 비워지고, 그 뒤에 고른 영어는 그대로 남아야 합니다. */
{
  const rerunSchema = async () => {
    await pg.query(`update app_meta set value = 'old' where name = 'schema'`);
    forgetKeys();
    await call(state, { token });
  };
  const localeDefault = async () => (await pg.query(
    `select column_default from information_schema.columns where table_name = 'settings' and column_name = 'locale'`,
  )).rows[0].column_default;

  await pg.query(`alter table settings alter column locale set default 'en'`);
  await pg.query(`update settings set locale = 'en'`);
  await rerunSchema();
  r = await call(state, { token });
  ok('an old database forgets the English it never chose', r.body.settings.locale === '', r.body.settings.locale);
  ok('and its default is blank from now on', (await localeDefault()) === "''::text", await localeDefault());

  await call(settings, { method: 'PATCH', token, body: { locale: 'en' } });
  await rerunSchema();
  r = await call(state, { token });
  ok('English picked afterwards survives the next schema change', r.body.settings.locale === 'en', r.body.settings.locale);

  await pg.query(`alter table settings alter column locale set default 'en'`);
  await pg.query(`update settings set locale = 'ko'`);
  await rerunSchema();
  r = await call(state, { token });
  ok('an old database keeps a language someone did pick', r.body.settings.locale === 'ko', r.body.settings.locale);
  await call(settings, { method: 'PATCH', token, body: { locale: 'en' } });
}

r = await call(state, { token });
ok('state carries the title', r.body.settings.title === r.body.settings.title && r.body.settings.title.length === 12);

/* title 컬럼이 없는 DB에서도 달력은 열려야 합니다 (alter를 아직 안 돌린 경우) */
await pg.query('alter table settings drop column subtitle, drop column theme');
r = await call(state, { token });
ok('a missing column does not wipe the ones that exist',
  r.status === 200 && r.body.settings.title.length === 12 && r.body.settings.subtitle === '' && r.body.settings.theme === 'peach',
  JSON.stringify(r.body.settings));
ok('the rest of the settings survive', r.body.settings.names.b === '너');

r = await call(settings, { method: 'PATCH', token, body: { names: { a: '나', b: '두리' }, since: '2024-01-02' } });
ok('settings still save without the title column', r.status === 200, JSON.stringify(r.body));
ok('the saved values come back', r.body.names.b === '두리' && r.body.since === '2024-01-02');
await pg.query("alter table settings add column subtitle text not null default '우리 오늘 뭐하지'");
await pg.query("alter table settings add column theme text not null default '복숭아'");
await call(settings, { method: 'PATCH', token, body: { title: '우리어리' } });
await call(settings, { method: 'PATCH', token, body: { names: { a: '나', b: '너' }, since: '2023-05-14' } });

/* 색을 고르고 곧바로 저장을 누르면 PATCH 둘이 겹칩니다. 예전에는 읽고-합치고-
   덮어쓰기라, 나중에 읽은 쪽이 먼저 쓴 쪽을 통째로 지웠습니다. */
const [themeSave, basicSave] = await Promise.all([
  call(settings, { method: 'PATCH', token, body: { theme: '바다' } }),
  call(settings, { method: 'PATCH', token, body: { title: '겹쳐도', subtitle: '안 지워져요' } }),
]);
ok('both overlapping saves answer with the theme they set',
  themeSave.body.theme === '바다' && basicSave.body.theme === '바다',
  `${themeSave.body.theme} / ${basicSave.body.theme}`);

r = await call(settings, { method: 'PATCH', token });
ok('overlapping saves do not wipe each other',
  r.body.theme === '바다' && r.body.title === '겹쳐도' && r.body.subtitle === '안 지워져요',
  JSON.stringify(r.body));
ok('the columns nobody touched stay put',
  r.body.names.b === '너' && r.body.since === '2023-05-14',
  JSON.stringify(r.body));

await call(settings, { method: 'PATCH', token, body: { title: '우리어리', subtitle: '우리 오늘 뭐하지', theme: '복숭아' } });

/* ── 최종 상태 ── */
r = await call(state, { token });
ok('state shape', r.status === 200 && Array.isArray(r.body.events) && !!r.body.settings);
ok('remaining events', r.body.events.length === 2, `${r.body.events.length}개`);
ok('sorted by date', r.body.events[0].date <= r.body.events[1].date);
ok('client field names intact',
  Object.keys(r.body.events[0]).includes('endDate') && Object.keys(r.body.events[0]).includes('repeat'));

/* ── 달력 사진 ── */
const { default: photosCreate } = await import('./api/photos/index.js');
const { default: photoById } = await import('./api/photos/[id].js');

// 1x1 투명 webp (진짜 바이트라 mime/크기 검사가 실제로 돌아갑니다)
const TINY = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

r = await call(photosCreate, { method: 'POST', body: { mime: 'image/webp', data: TINY } });
ok('photo upload needs token', r.status === 401);

r = await call(photosCreate, { method: 'POST', token, body: { mime: 'text/html', data: TINY } });
ok('only images accepted', r.status === 400, r.body?.error);

r = await call(photosCreate, { method: 'POST', token, body: { mime: 'image/webp', data: 'not base64!!' } });
ok('junk data rejected', r.status === 400, r.body?.error);

r = await call(photosCreate, {
  method: 'POST', token,
  body: { mime: 'image/webp', data: 'A'.repeat(500_000) },
});
ok('oversized photo rejected', r.status === 400, r.body?.error);

r = await call(photosCreate, { method: 'POST', token, body: { mime: 'image/webp', data: TINY } });
const photoId = r.body?.id;
ok('photo uploaded', r.status === 201 && typeof photoId === 'string');

r = await call(state, { token });
ok('state lists the photo', r.body.photos?.length === 1 && r.body.photos[0] === photoId);

/* 예전엔 <img src>가 헤더를 못 실어서 사진만 주소를 알면 누구나 열렸습니다 */
r = await call(photoById, { method: 'GET', query: { id: photoId } });
ok('a photo needs a sign-in too', r.status === 401);

r = await call(photoById, { method: 'GET', token, query: { id: photoId } });
ok('photo serves the bytes', r.status === 200 && Buffer.isBuffer(r.body));
ok('photo bytes round-trip', r.body?.toString('base64') === TINY);
ok('photo served as webp', r.headers['Content-Type'] === 'image/webp');
ok('photo is cacheable', String(r.headers['Cache-Control']).includes('immutable'), r.headers['Cache-Control']);
ok('but only by the browser, never a shared cache',
  String(r.headers['Cache-Control']).startsWith('private'), r.headers['Cache-Control']);

r = await call(photoById, { method: 'GET', token, query: { id: 'not-a-uuid' } });
ok('bad photo id 404', r.status === 404);

r = await call(photoById, { method: 'GET', token, query: { id: '00000000-0000-0000-0000-000000000000' } });
ok('missing photo 404', r.status === 404);

r = await call(photoById, { method: 'DELETE', query: { id: photoId } });
ok('photo delete needs token', r.status === 401);

r = await call(photoById, { method: 'DELETE', token, query: { id: photoId } });
ok('photo deleted', r.status === 204);

r = await call(photoById, { method: 'DELETE', token, query: { id: photoId } });
ok('double delete 404', r.status === 404);

r = await call(state, { token });
ok('state drops the deleted photo', r.body.photos.length === 0);

/* 30장이 넘으면 안 받습니다 — 달력마다 30장 */
const ours = await coupleOf('nana');
for (let i = 0; i < 29; i++) {
  await pg.query("insert into photos (couple_id, mime, data) values ($1, 'image/webp', $2)", [ours, TINY]);
}
await pg.query("insert into photos (couple_id, mime, data) values ($1, 'image/webp', $2)", [await coupleOf('host'), TINY]);
r = await call(photosCreate, { method: 'POST', token, body: { mime: 'image/webp', data: TINY } });
ok('30th photo still fits', r.status === 201, r.body?.error);

r = await call(photosCreate, { method: 'POST', token, body: { mime: 'image/webp', data: TINY } });
ok('31st photo rejected', r.status === 400, r.body?.error);

await pg.query('delete from photos');
r = await call(state, { token });
ok('photos cleared for the next test', r.body.photos.length === 0);

/* Blob이 붙어 있으면 사진은 DB 밖으로 — 줄에는 자리만 적힙니다 */
{
  const { useBlob } = await import('./lib/blob.js');
  const files = new Map();
  useBlob({
    put: async (path, bytes, mime) => { files.set(path, { bytes, mime }); },
    get: async (path) => files.get(path)?.bytes || null,
    del: async (paths) => paths.forEach((p) => files.delete(p)),
  });

  r = await call(photosCreate, { method: 'POST', token, body: { mime: 'image/webp', data: TINY } });
  const blobbed = r.body?.id;
  const row = (await pg.query('select data, blob_path from photos where id = $1', [blobbed])).rows[0];
  ok('with Blob the photo goes out of the database',
    r.status === 201 && row?.data === null && files.has(row?.blob_path), JSON.stringify(row));
  ok('filed under its own calendar', row?.blob_path === `photos/${ours}/${blobbed}`, row?.blob_path);

  r = await call(photoById, { method: 'GET', token, query: { id: blobbed } });
  ok('and still comes back through the app, bytes intact',
    r.status === 200 && r.body?.toString('base64') === TINY && r.headers['Content-Type'] === 'image/webp');

  r = await call(photoById, { method: 'GET', token: await join('peek'), query: { id: blobbed } });
  ok('another calendar cannot open it', r.status === 404);

  /* 예전에 DB에 담아둔 사진도 그대로 보여야 합니다 */
  await pg.query("insert into photos (id, couple_id, mime, data) values ('11111111-1111-1111-1111-111111111111', $1, 'image/webp', $2)", [ours, TINY]);
  r = await call(photoById, { method: 'GET', token, query: { id: '11111111-1111-1111-1111-111111111111' } });
  ok('a photo kept in the database the old way still shows', r.status === 200 && r.body?.toString('base64') === TINY);

  r = await call(photoById, { method: 'DELETE', token, query: { id: blobbed } });
  ok('deleting it removes the file too', r.status === 204 && files.size === 0);

  files.set('stale', { bytes: Buffer.from(TINY, 'base64'), mime: 'image/webp' });
  await pg.query("insert into photos (id, couple_id, mime, blob_path) values ('22222222-2222-2222-2222-222222222222', $1, 'image/webp', 'gone')", [ours]);
  r = await call(photoById, { method: 'GET', token, query: { id: '22222222-2222-2222-2222-222222222222' } });
  ok('a file that went missing is a 404, not a crash', r.status === 404);

  useBlob(null);
  await pg.query('delete from photos');
}



/* ── 휴대폰 알림 (웹푸시) ── */
const { default: pushApi } = await import('./api/push/index.js');
const { useSender } = await import('./lib/push.js');

/* 진짜로 보내지 않고, 무엇을 어디로 보냈는지만 적어둡니다 */
const pushed = [];
let pushStatus = 0; // 0이면 성공, 아니면 그 코드로 실패시킵니다
useSender(async (target, payload) => {
  if (pushStatus) {
    const e = new Error('푸시 실패');
    e.statusCode = pushStatus;
    throw e;
  }
  pushed.push({ endpoint: target.endpoint, ...JSON.parse(payload) });
});

const PHONE = 'https://web.push.apple.com/aaa1';
const LAPTOP = 'https://fcm.googleapis.com/fcm/send/bbb2';
const device = (endpoint) => ({ endpoint, keys: { p256dh: 'P256DH', auth: 'AUTH' } });
/* 알림 받을 사람은 로그인한 계정이 정합니다 — token이면 a, tokenB면 b */
const subscribe = (who, endpoint) =>
  call(pushApi, { method: 'POST', token: who, body: { subscription: device(endpoint) } });
const countSubs = async () => (await pg.query('select count(*)::int as n from push_subs')).rows[0].n;

r = await call(pushApi, { method: 'GET' });
ok('push key needs token', r.status === 401);

r = await call(pushApi, { method: 'PATCH', token });
ok('push wrong method 405', r.status === 405);

r = await call(pushApi, { method: 'GET', token });
ok('push hands out the public key it made', r.body.publicKey === (await keys()).vapidPublic && r.body.publicKey.length === 87);

/* 예전엔 화면이 보낸 owner를 믿어서, 상대 이름으로 기기를 걸어 상대 알림을 가로챌 수 있었습니다 */
r = await call(pushApi, { method: 'POST', token: tokenB, body: { owner: 'a', subscription: device(PHONE) } });
ok('the account decides whose device it is, not the body',
  r.status === 201 && (await pg.query('select owner from push_subs')).rows[0]?.owner === 'b');
await pg.query('delete from push_subs');

r = await call(pushApi, { method: 'POST', token, body: { subscription: { endpoint: 'http://nope' } } });
ok('push bad subscription 400', r.status === 400, r.body?.error);

r = await subscribe(token, PHONE);
ok('phone subscribed', r.status === 201);

r = await subscribe(token, LAPTOP);
ok('second device subscribed', r.status === 201);

r = await subscribe(token, PHONE);
ok('same device does not pile up', r.status === 201 && (await countSubs()) === 2);

/* b가 일정을 만들면 a의 기기 둘 다 울린다 */
pushed.length = 0;
r = await call(eventsCreate, {
  method: 'POST', token: tokenB,
  body: { title: '치과', date: '2026-09-12', time: '19:00' },
});
const visit = r.body;
ok('both devices get a push', r.status === 201 && pushed.length === 2, String(pushed.length));
ok('push says who changed it', pushed[0]?.title === 'New event · 너', JSON.stringify(pushed[0]?.title));
ok('push says what and when', pushed[0]?.body === 'Sat, September 12 19:00\n치과', JSON.stringify(pushed[0]?.body));
ok('push groups by event', pushed[0]?.tag === visit.id);

/* 내가 바꾼 건 나한테 오지 않는다 — 화면이 actor를 뭐라고 보내든 */
pushed.length = 0;
r = await call(eventsCreate, { method: 'POST', token, body: { title: '혼잣말', date: '2026-09-13', actor: 'b' } });
ok('no push to the one who changed it', pushed.length === 0);
await call(eventById, { method: 'DELETE', token, query: { id: r.body.id } });

/* 고치고 지울 때도 알린다 */
pushed.length = 0;
await call(eventById, {
  method: 'PATCH', token: tokenB, query: { id: visit.id }, body: { title: '치과 (미뤘어요)' },
});
ok('edit pushes', pushed[0]?.title.includes('Event changed'), JSON.stringify(pushed[0]?.title));

pushed.length = 0;
r = await call(eventById, { method: 'DELETE', token: tokenB, query: { id: visit.id } });
ok('delete pushes with the title', r.status === 204 && pushed[0]?.body.includes('치과'));

/* 푸시가 죽어도 일정은 저장된다 */
pushStatus = 500;
r = await call(eventsCreate, { method: 'POST', token: tokenB, body: { title: '푸시 먹통', date: '2026-09-14' } });
ok('event saved even when push fails', r.status === 201 && r.body.title === '푸시 먹통');
ok('a failed push keeps the device', (await countSubs()) === 2);
await call(eventById, { method: 'DELETE', token: tokenB, query: { id: r.body.id } });

/* 410은 앱을 지웠거나 만료된 것 — 그 줄을 치운다 */
pushStatus = 410;
r = await call(eventsCreate, { method: 'POST', token: tokenB, body: { title: '만료', date: '2026-09-15' } });
ok('expired devices are cleaned up', (await countSubs()) === 0);
pushStatus = 0;
await call(eventById, { method: 'DELETE', token: tokenB, query: { id: r.body.id } });

/* 한 기기만 꺼도 다른 기기는 그대로 */
await subscribe(token, PHONE);
await subscribe(token, LAPTOP);

r = await call(pushApi, { method: 'DELETE', token });
ok('unsubscribe needs an endpoint', r.status === 400, r.body?.error);

r = await call(pushApi, { method: 'DELETE', token, query: { endpoint: PHONE } });
ok('one device turned off', r.status === 204 && (await countSubs()) === 1);

pushed.length = 0;
r = await call(eventsCreate, { method: 'POST', token: tokenB, body: { title: '노트북만', date: '2026-09-16' } });
ok('the other device still gets it',
  pushed.length === 1 && pushed[0].endpoint === LAPTOP, JSON.stringify(pushed));
await call(eventById, { method: 'DELETE', token: tokenB, query: { id: r.body.id } });

/* 로그아웃하면서 이 기기 주소를 주면 그 알림도 끕니다 — 넘겨준 폰이 계속 울리면 안 되니까요 */
{
  const spare = cookieOf(await call(login, { method: 'POST', body: { username: 'nana', password: PW } }));
  await call(logout, { method: 'POST', token: spare, body: { endpoint: LAPTOP } });
  ok('logging out turns this device off', (await countSubs()) === 0);
}

/* ── 스토어 앱 알림 (FCM) ── */
{
  const { useNativeSender } = await import('./lib/push.js');
  const toApps = [];
  let appStatus = 0;
  useNativeSender(async (appToken, payload) => {
    if (appStatus) { const e = new Error('fcm'); e.statusCode = appStatus; throw e; }
    toApps.push({ appToken, ...JSON.parse(payload) });
  });
  const ANDROID = 'fcm-token-android-' + 'x'.repeat(120);

  r = await call(pushApi, { method: 'POST', token, body: { platform: 'android', token: ANDROID } });
  ok('the store app registers with its FCM token', r.status === 201, JSON.stringify(r.body));
  ok('kept as an android device of the one signed in',
    JSON.stringify((await pg.query('select owner, platform, p256dh from push_subs')).rows) === '[{"owner":"a","platform":"android","p256dh":null}]');

  r = await call(pushApi, { method: 'POST', token, body: { platform: 'android', token: 'bad token!' } });
  ok('a malformed app token is refused', r.status === 400);
  r = await call(pushApi, { method: 'POST', token, body: { platform: 'windows', token: ANDROID } });
  ok('an unknown platform falls to the browser path and is refused', r.status === 400);

  await subscribe(token, LAPTOP);
  pushed.length = 0;
  r = await call(eventsCreate, { method: 'POST', token: tokenB, body: { title: '영화', date: '2026-09-20', time: '20:00' } });
  ok('a change reaches the app', toApps.length === 1 && toApps[0].appToken === ANDROID, JSON.stringify(toApps));
  ok('with the same words as the browser gets',
    toApps[0]?.title === pushed[0]?.title && toApps[0]?.body === pushed[0]?.body && toApps[0]?.tag === r.body.id);
  ok('and the browser still gets its own', pushed.length === 1 && pushed[0].endpoint === LAPTOP);

  appStatus = 404; // 앱을 지웠거나 토큰이 만료됨
  await call(eventById, { method: 'DELETE', token: tokenB, query: { id: r.body.id } });
  ok('an uninstalled app is cleaned up like an expired browser',
    (await pg.query(`select count(*)::int as n from push_subs where platform = 'android'`)).rows[0].n === 0);
  appStatus = 0;
  useNativeSender(null);
  await pg.query('delete from push_subs');
}

/* iOS 앱은 FCM이 아니라 애플에 바로 갑니다 */
{
  const { useNativeSender } = await import('./lib/push.js');
  const routed = [];
  useNativeSender(async (appToken, payload, platform) => { routed.push({ appToken, platform }); });
  const IPHONE = 'a1b2c3'.repeat(10) + 'abcd'; // APNs 토큰은 64자리 16진수
  r = await call(pushApi, { method: 'POST', token, body: { platform: 'ios', token: IPHONE } });
  ok('an iPhone app registers with its APNs token', r.status === 201);
  r = await call(eventsCreate, { method: 'POST', token: tokenB, body: { title: 'ios', date: '2026-09-21' } });
  ok('and its alerts go out marked for iOS', routed.length === 1 && routed[0].platform === 'ios' && routed[0].appToken === IPHONE,
    JSON.stringify(routed));
  await call(eventById, { method: 'DELETE', token: tokenB, query: { id: r.body.id } });
  useNativeSender(null);
  await pg.query('delete from push_subs');
}

/* lib/apns.js 자체 — 애플이 원하는 모양으로 서명하고 보내는지 */
{
  const crypto = await import('node:crypto');
  const http2 = await import('node:http2');
  const { sendApns, useApnsTransport, http2Request } = await import('./lib/apns.js');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  Object.assign(process.env, {
    APNS_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    APNS_KEY_ID: 'KEY1234567', APNS_TEAM_ID: 'TEAM123456', APNS_BUNDLE_ID: 'app.couplediary',
  });

  /* 진짜 http2 코드를 쓰되, 애플 대신 이 자리에 띄운 서버로 */
  const seen = [];
  let answer = { status: 200, body: '' };
  const server = http2.createServer();
  server.on('stream', (stream, headers) => {
    let text = '';
    stream.on('data', (c) => { text += c; });
    stream.on('end', () => {
      seen.push({ headers, body: text });
      stream.respond({ ':status': answer.status });
      stream.end(answer.body);
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const local = `http://localhost:${server.address().port}`;
  useApnsTransport((origin, headers, body) => { seen.origin = origin; return http2Request(local, headers, body); });

  try {
    await sendApns('abc123', { title: '새 일정', body: '치과', tag: 't'.repeat(90) });
    const h = seen[0]?.headers || {};
    ok('it goes to the production APNs unless told otherwise', seen.origin === 'https://api.push.apple.com', seen.origin);
    ok('to that device, as an alert for this app',
      h[':path'] === '/3/device/abc123' && h['apns-topic'] === 'app.couplediary' && h['apns-push-type'] === 'alert');
    ok('with a grouping id that fits 64 bytes', h['apns-collapse-id']?.length === 64);
    const body = JSON.parse(seen[0]?.body || '{}');
    ok('saying what changed', body.aps?.alert?.title === '새 일정' && body.aps?.alert?.body === '치과');

    const [head, claims, sig] = String(h.authorization).replace('bearer ', '').split('.');
    ok('signed with the .p8 key the way JWT wants (ES256, raw r‖s)',
      crypto.verify('sha256', Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));
    const said = { ...JSON.parse(Buffer.from(head, 'base64url')), ...JSON.parse(Buffer.from(claims, 'base64url')) };
    ok('naming the key and the team', said.kid === 'KEY1234567' && said.iss === 'TEAM123456' && said.alg === 'ES256');

    await sendApns('abc123', { title: 'a', body: 'b', tag: 'x' });
    ok('the same signed token is reused, as Apple asks', seen[1]?.headers.authorization === h.authorization);

    answer = { status: 400, body: '{"reason":"BadDeviceToken"}' };
    let code = 0;
    await sendApns('nope', { title: 'a', body: 'b' }).catch((e) => { code = e.statusCode; });
    ok('a bad device token is treated as gone, so the row gets cleaned up', code === 410);

    answer = { status: 410, body: '{"reason":"Unregistered"}' };
    await sendApns('uninstalled', { title: 'a', body: 'b' }).catch((e) => { code = e.statusCode; });
    ok('so is an uninstalled app', code === 410);

    process.env.APNS_SANDBOX = '1';
    answer = { status: 200, body: '' };
    await sendApns('dev', { title: 'a', body: 'b' });
    ok('a development build goes to the sandbox', seen.origin === 'https://api.sandbox.push.apple.com');
  } finally {
    useApnsTransport(null);
    server.close();
    for (const k of ['APNS_KEY', 'APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_BUNDLE_ID', 'APNS_SANDBOX']) delete process.env[k];
  }
}

/* lib/fcm.js 자체 — 구글에 토큰을 받고 FCM에 보내는 모양이 맞는지. 진짜로 보내지는 않고 fetch를 가로챕니다 */
{
  const crypto = await import('node:crypto');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    project_id: 'our-diary', client_email: 'push@our-diary.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  const realFetch = globalThis.fetch;
  const calls = [];
  let fcmStatus = 200;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'goog-token', expires_in: 3600 }) };
    return { ok: fcmStatus === 200, status: fcmStatus, text: async () => '{"error":{"status":"NOT_FOUND"}}' };
  };
  try {
    const { sendNative } = await import('./lib/fcm.js');
    await sendNative('device-1', { title: 'Hi', body: 'there', tag: 'x'.repeat(80) });
    await sendNative('device-2', { title: 'Hi', body: 'again', tag: 'today:2026-10-05' });

    const tokenCalls = calls.filter((c) => c.url.includes('oauth2'));
    ok('it asks Google for a token once and reuses it', tokenCalls.length === 1, calls.map((c) => c.url));
    const assertion = new URLSearchParams(tokenCalls[0].init.body).get('assertion');
    const [head, claims, sig] = assertion.split('.');
    const verified = crypto.createVerify('RSA-SHA256').update(`${head}.${claims}`).verify(publicKey, sig, 'base64url');
    const said = JSON.parse(Buffer.from(claims, 'base64url').toString());
    ok('signed with the service account key', verified);
    ok('asking only to send messages',
      said.iss === 'push@our-diary.iam.gserviceaccount.com' && said.scope.endsWith('/firebase.messaging') && said.exp - said.iat === 3600);

    const sent = calls.filter((c) => c.url.includes('fcm.googleapis.com'));
    const message = JSON.parse(sent[0].init.body).message;
    ok('it sends to the right project with the token it got',
      sent[0].url === 'https://fcm.googleapis.com/v1/projects/our-diary/messages:send'
      && sent[0].init.headers.Authorization === 'Bearer goog-token');
    ok('the message carries the words and the device',
      message.token === 'device-1' && message.notification.title === 'Hi' && message.notification.body === 'there');
    ok('the grouping tag fits Apple\'s 64-byte limit',
      message.apns.headers['apns-collapse-id'].length === 64 && message.android.notification.tag.length === 80);

    fcmStatus = 404;
    let status = 0;
    await sendNative('gone', { title: 'a', body: 'b', tag: 't' }).catch((e) => { status = e.statusCode; });
    ok('a dead token comes back as 404 so the device gets cleaned up', status === 404);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
  }
}



/* VAPID 연락처 — DIARY_URL이 없다고 알림이 통째로 죽으면 안 됩니다 (2026-09-07 실제로 그랬음) */
const { subject } = await import('./lib/push.js');
const withEnv = (vars, fn) => {
  const saved = { ...process.env };
  for (const k of ['VAPID_SUBJECT', 'DIARY_URL', 'VERCEL_URL']) delete process.env[k];
  Object.assign(process.env, vars);
  try { return fn(); } finally { process.env = saved; }
};

ok('subject prefers VAPID_SUBJECT',
  withEnv({ VAPID_SUBJECT: 'mailto:a@b.c', DIARY_URL: 'https://x' }, subject) === 'mailto:a@b.c');
ok('subject falls back to DIARY_URL',
  withEnv({ DIARY_URL: 'https://diary.test/' }, subject) === 'https://diary.test');
ok('subject survives without DIARY_URL',
  withEnv({ VERCEL_URL: 'diary.vercel.app' }, subject) === 'https://diary.vercel.app');
ok('subject complains when nothing is set',
  withEnv({}, () => { try { subject(); return false; } catch { return true; } }));


/* ── 오늘 일정 알림 (바깥 시계가 두드립니다) ── */
const { default: cron } = await import('./api/cron.js');

/* 열쇠는 운영하는 사람만 압니다. 예전엔 설정 화면이 두 사람에게 보여줬지만,
   여러 커플이 쓰면 그 열쇠 하나로 모든 커플의 알림을 두드릴 수 있습니다 */
const CRON = (await keys()).cronSecret;
r = await call(settings, { method: 'GET', token });
ok('settings no longer hands out the clock key',
  r.status === 405 && !JSON.stringify(r.body || '').includes(CRON), JSON.stringify(r.body));

const DAY = '2026-10-05';
const knock = (at, key = CRON) => call(cron, { method: 'GET', query: { key, at } });
const tick = (hhmm) => knock(`${DAY}T${hhmm}`);

r = await call(cron, { method: 'GET' });
ok('cron needs the key', r.status === 401);

r = await call(cron, { method: 'GET', query: { key: 'wrong' } });
ok('cron rejects a wrong key', r.status === 401);

r = await call(cron, { method: 'DELETE', query: { key: CRON } });
ok('cron wrong method 405', r.status === 405);

/* Vercel Cron은 CRON_SECRET을 Bearer로 실어 보냅니다. 넣어두면 그게 열쇠입니다 */
process.env.CRON_SECRET = 'set-by-the-operator';
r = await knock('2026-01-01T12:00');
ok('CRON_SECRET replaces the key the app made', r.status === 401);
r = await knock('2026-01-01T12:00', 'set-by-the-operator');
ok('and opens the clock', r.status === 200);
delete process.env.CRON_SECRET;

/* 시간대는 설정에 담깁니다 — 아무 값이나 담기면 알림이 엉뚱한 시각에 갑니다 */
r = await call(settings, { method: 'PATCH', token, body: { timezone: 'Asia/Seoul' } });
ok('a time zone is saved', r.body.timezone === 'Asia/Seoul', String(r.body.timezone));

r = await call(settings, { method: 'PATCH', token, body: { timezone: 'Mars/Olympus' } });
ok('an unknown time zone falls back to UTC', r.body.timezone === 'UTC', String(r.body.timezone));

r = await call(settings, { method: 'PATCH', token, body: { locale: 'en', timezone: 'Asia/Seoul' } });
ok('the time zone survives a locale change', r.body.timezone === 'Asia/Seoul');

/* 둘 다 받아야 하는 알림이라 기기를 둘 다 켭니다 */
await subscribe(token, LAPTOP);
await subscribe(tokenB, PHONE);

const plant = async (body) => (await call(eventsCreate, { method: 'POST', token, body })).body;
const dawn = await plant({ title: 'red-eye flight', date: DAY, time: '03:00' });
const airport = await plant({ title: 'leave for airport', date: DAY, time: '06:00', memo: 'passport!' });
await plant({ title: 'overslept', date: DAY, time: '07:00' });
await plant({ title: 'dentist', date: DAY, time: '09:30' });
await plant({ title: 'walk', date: DAY });
await plant({ title: 'rent', date: '2026-04-05', time: '10:00', repeat: 'monthly' });
await plant({ title: 'trip', date: '2026-10-04', endDate: '2026-10-06' });

pushed.length = 0;
r = await tick('01:30');
ok('nothing more than an hour ahead', r.status === 200 && r.body.sent.length === 0);
ok('the answer counts calendars', r.body.calendars >= 2, JSON.stringify(r.body));

r = await tick('02:00');
ok('an hour ahead, the reminder goes — even at 2am', r.body.sent.join() === `soon:${dawn.id}`, JSON.stringify(r.body.sent));
ok('both people get it', pushed.length === 2, String(pushed.length));
ok('the answer never carries what the event is — clock services keep logs',
  !JSON.stringify(r.body).includes('red-eye'), JSON.stringify(r.body));

pushed.length = 0;
r = await tick('02:30');
ok('the same reminder does not go twice', r.body.sent.length === 0 && pushed.length === 0);

r = await tick('05:00');
ok('an event gets its reminder with the first knock inside the hour', r.body.sent.join() === `soon:${airport.id}`, JSON.stringify(r.body.sent));
ok('the reminder says the time and the memo',
  pushed[0]?.title === 'Starting soon' && pushed[0]?.body === '06:00 leave for airport\npassport!', JSON.stringify(pushed[0]));
ok('the reminder groups apart from the event itself', pushed[0]?.tag === `soon:${airport.id}`);

pushed.length = 0;
r = await tick('06:45');
ok('a knock that came late still reminds before the start', r.body.sent.length === 1 && r.body.sent[0].startsWith('soon:'), JSON.stringify(r.body.sent));

pushed.length = 0;
r = await tick('08:00');
ok('the rest come as one digest at 8', r.body.sent.join() === 'today:3', JSON.stringify(r.body.sent));
ok('the digest counts in the title', pushed[0]?.title === '3 events today', JSON.stringify(pushed[0]?.title));
ok('the digest lists all-day first, then by time',
  pushed[0]?.body === 'All day walk\n09:30 dentist\n10:00 rent', JSON.stringify(pushed[0]?.body));
ok('the digest leaves out what already fired', !pushed[0]?.body.includes('airport'));
ok('the digest goes to both too', pushed.length === 2, String(pushed.length));

pushed.length = 0;
r = await tick('08:30');
ok('the digest does not go twice, but later events still get their own reminder',
  !r.body.sent.some((x) => x.startsWith('today')) && r.body.sent.length === 1 && r.body.sent[0].startsWith('soon:'),
  JSON.stringify(r.body.sent));

r = await tick('09:00');
ok('reminders keep coming through the day', r.body.sent.length === 1 && r.body.sent[0].startsWith('soon:'), JSON.stringify(r.body.sent));

pushed.length = 0;
r = await tick('12:00');
ok('a quiet afternoon stays quiet', r.body.sent.length === 0 && pushed.length === 0);

/* 자정 넘어 시작하는 일정은 전날 밤에 알립니다 */
const lateShow = await plant({ title: 'midnight movie', date: '2026-10-06', time: '00:20' });
r = await tick('23:30');
ok('a 00:20 event is announced the night before', r.body.sent.join() === `soon:${lateShow.id}`, JSON.stringify(r.body.sent));
r = await knock('2026-10-06T00:00');
ok('and not again after midnight', !r.body.sent.includes(`soon:${lateShow.id}`), JSON.stringify(r.body.sent));
pushed.length = 0; // 일정을 넣을 때 나간 "새 일정" 알림이 아래 검사에 섞이지 않게

/* 여러 날 일정은 시작하는 날에만 — 걸친 날마다 아침을 울리지 않습니다 */
r = await knock('2026-10-04T08:00');
ok('a trip is announced on the day it starts', r.body.sent.join() === 'today:1', JSON.stringify(r.body.sent));
ok('one event reads as one in the title', pushed[0]?.title === '1 event today', JSON.stringify(pushed[0]?.title));
ok('the trip is not repeated on the days it spans', pushed[0]?.body === 'All day trip', JSON.stringify(pushed[0]?.body));

/* 알림도 두 사람이 고른 언어로 갑니다 */
pushed.length = 0;
r = await knock('2026-10-03T08:00');
ok('a quiet day stays quiet', r.body.sent.length === 0 && pushed.length === 0);

await call(settings, { method: 'PATCH', token, body: { locale: 'ko' } });
await plant({ title: '치과', date: '2026-10-02', time: '09:30' });
await plant({ title: '산책', date: '2026-10-02' });
pushed.length = 0;
r = await knock('2026-10-02T08:00');
ok('the digest speaks the language they picked',
  pushed[0]?.title === '오늘 일정 2개', JSON.stringify(pushed[0]?.title));
ok('and so does the all-day label',
  pushed[0]?.body === '종일 산책\n09:30 치과', JSON.stringify(pushed[0]?.body));
await call(settings, { method: 'PATCH', token, body: { locale: 'en' } });

/* 커플이 여럿이면 '오늘 알림을 보냈다'는 기록이 커플마다 따로여야 합니다.
   하나로 두면 먼저 보낸 커플이 다른 커플의 아침 알림을 막습니다 */
{
  const other = await join('other');
  const otherPhone = 'https://web.push.apple.com/other';
  await subscribe(other, otherPhone);
  await call(settings, { method: 'PATCH', token: other, body: { locale: 'ko' } });
  await call(eventsCreate, { method: 'POST', token: other, body: { title: '우리 산책', date: '2026-10-07' } });
  await plant({ title: 'our walk', date: '2026-10-07' });

  pushed.length = 0;
  r = await knock('2026-10-07T08:00');
  const theirs = pushed.filter((p) => p.endpoint === otherPhone);
  const mine = pushed.filter((p) => p.endpoint !== otherPhone);
  ok('two calendars each get their morning digest on the same day',
    theirs.length === 1 && mine.length === 2, JSON.stringify(pushed));
  ok('each in its own language', theirs[0]?.title === '오늘 일정 1개' && mine[0]?.title === '1 event today',
    JSON.stringify(pushed.map((p) => p.title)));
  ok('each with only its own events', theirs[0]?.body === '종일 우리 산책' && mine[0]?.body === 'All day our walk',
    JSON.stringify(pushed.map((p) => p.body)));
}

/* 시계는 달력마다 그 사람들이 사는 곳의 시각으로 봅니다. 같은 일정이라도
   달력의 시간대가 다르면 "곧 시작"인지가 갈립니다 */
{
  const { localNow: nowIn } = await import('./lib/remind.js');
  const zones = Array.from({ length: 27 }, (_, i) => i - 14)
    .map((o) => `Etc/GMT${o < 0 ? '-' : '+'}${Math.abs(o)}`);
  // 자정에서 멀찍이 떨어진 곳을 골라, 두드리는 사이 날짜가 넘어가도 흔들리지 않게
  const here = zones.find((z) => nowIn(z).minutes >= 10 * 60 && nowIn(z).minutes <= 18 * 60);
  const now = nowIn(here);
  const at = now.minutes + 40;
  const hhmm = `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
  const soonThere = await plant({ title: 'zone check', date: now.date, time: hhmm });
  const elsewhere = zones[(zones.indexOf(here) + 6) % zones.length]; // 여섯 시간 떨어진 곳

  await call(settings, { method: 'PATCH', token, body: { timezone: elsewhere } });
  r = await call(cron, { method: 'GET', query: { key: CRON } });
  ok('six hours away, the same event is not near', !r.body.sent.includes(`soon:${soonThere.id}`), `${elsewhere} ${JSON.stringify(r.body)}`);
  await call(settings, { method: 'PATCH', token, body: { timezone: here } });
  r = await call(cron, { method: 'GET', query: { key: CRON } });
  ok('where they live it is 40 minutes away, so it goes', r.body.sent.includes(`soon:${soonThere.id}`), `${here} ${JSON.stringify(r.body)}`);
  await call(settings, { method: 'PATCH', token, body: { timezone: 'Asia/Seoul' } });
}

/* ── 커플끼리는 서로 안 보입니다 ──
   한 곳이라도 couple_id 거르기를 빠뜨리면 남의 일정이 보입니다. 모든 창구를 두드려 봅니다. */
{
  const stranger = await join('stranger');
  const secret = (await call(eventsCreate, {
    method: 'POST', token: stranger, body: { title: 'their secret', date: '2026-11-01' },
  })).body;
  const theirPhoto = (await call(photosCreate, {
    method: 'POST', token: stranger, body: { mime: 'image/webp', data: TINY },
  })).body.id;
  await call(settings, { method: 'PATCH', token: stranger, body: { title: '남의달력' } });
  const strangerPhone = 'https://web.push.apple.com/stranger';
  await subscribe(stranger, strangerPhone);

  r = await call(state, { token });
  ok("another calendar's events never show", !r.body.events.some((e) => e.id === secret.id));
  ok('nor its photos', !r.body.photos.includes(theirPhoto));
  ok('nor its settings', r.body.settings.title !== '남의달력');

  r = await call(eventById, { method: 'PATCH', token, query: { id: secret.id }, body: { title: 'hijacked' } });
  ok('knowing the id does not let you edit it', r.status === 404);
  r = await call(eventById, { method: 'DELETE', token, query: { id: secret.id } });
  ok('or delete it', r.status === 404);
  r = await call(photoById, { method: 'GET', token, query: { id: theirPhoto } });
  ok('or open their photo', r.status === 404);
  r = await call(photoById, { method: 'DELETE', token, query: { id: theirPhoto } });
  ok('or delete that photo', r.status === 404);
  await call(pushApi, { method: 'DELETE', token, query: { endpoint: strangerPhone } });
  ok('or turn off their phone',
    (await pg.query('select count(*)::int as n from push_subs where endpoint = $1', [strangerPhone])).rows[0].n === 1);

  r = await call(state, { token: stranger });
  ok('and the owner still has all of it',
    r.body.events.some((e) => e.id === secret.id && e.title === 'their secret')
    && r.body.photos.includes(theirPhoto) && r.body.settings.title === '남의달력');

  pushed.length = 0;
  await plant({ title: 'ours only', date: '2026-11-02' });
  await call(eventsCreate, { method: 'POST', token: tokenB, body: { title: 'ours only too', date: '2026-11-02' } });
  ok('our changes never ring their phone',
    pushed.length > 0 && !pushed.some((p) => p.endpoint === strangerPhone), JSON.stringify(pushed));
}

/* ── 가입 남용 막기: 한 주소에서 한 시간에 다섯 개까지 ── */
const BUSY_IP = '203.0.113.9';
{
  const from = (ip) => ({ 'x-forwarded-for': `${ip}, 10.0.0.1` });
  const make = (username, ip = BUSY_IP) =>
    call(signup, { method: 'POST', headers: from(ip), body: { username, password: PW } });
  const made = [];
  for (let i = 1; i <= 5; i++) made.push((await make('bulk-' + i)).status);
  ok('five accounts from one address are fine', made.every((s) => s === 201), made.join());
  r = await make('bulk-6');
  ok('the sixth within the hour is turned away', r.status === 429 && r.body.error === 'error.tooManySignups');
  ok('and makes no account', (await pg.query(`select count(*)::int as n from users where username = 'bulk-6'`)).rows[0].n === 0);
  ok('another address can still sign up', (await make('bulk-7', '198.51.100.4')).status === 201);
  r = await call(login, { method: 'POST', headers: from(BUSY_IP), body: { username: 'bulk-1', password: PW } });
  ok('signing in from the busy address still works', r.status === 200);
  ok('the address is kept only as a hash',
    (await pg.query(`select count(*)::int as n from signups where ip_hash like '%203.0.113%'`)).rows[0].n === 0
    && (await pg.query('select count(*)::int as n from signups')).rows[0].n === 6);
}

/* ── 비밀번호 바꾸기 ── */
{
  const account = viaAuth('account');
  const NEW = 'a brand new one';
  const here = await join('changer');
  const phone = cookieOf(await call(login, { method: 'POST', body: { username: 'changer', password: PW } }));
  const signIn = (password) => call(login, { method: 'POST', body: { username: 'changer', password } });

  r = await call(account, { method: 'PATCH', token: here, body: { current: 'not it', password: NEW } });
  ok('changing the password asks for the current one', r.status === 403 && r.body.error === 'error.wrongPassword');
  ok('and a wrong one is not a sign-out', (await call(state, { token: here })).status === 200);

  r = await call(account, { method: 'PATCH', token: here, body: { current: PW, password: 'short' } });
  ok('the new one needs 8 characters too', r.status === 400 && r.body.error === 'error.shortPassword');
  ok('and a refused change keeps the old one', (await signIn(PW)).status === 200);

  r = await call(account, { method: 'PATCH', token: here, body: { current: PW, password: NEW } });
  ok('the password changes', r.status === 204);
  ok('this device stays signed in', (await call(state, { token: here })).status === 200);
  ok('every other sign-in is cut off', (await call(state, { token: phone })).status === 401);
  ok('the old password no longer opens the door', (await signIn(PW)).status === 401);
  ok('the new one does', (await signIn(NEW)).status === 200);

  for (let i = 0; i < 10; i++) {
    await call(account, { method: 'PATCH', token: here, body: { current: 'guess ' + i, password: NEW } });
  }
  r = await call(account, { method: 'PATCH', token: here, body: { current: NEW, password: PW } });
  ok('guessing the current password is counted like wrong sign-ins', r.status === 429 && r.body.error === 'error.tooManyTries');

  r = await call(account, { method: 'PATCH', body: { current: PW, password: NEW } });
  ok('changing the password needs a sign-in', r.status === 401);
}

/* ── 로그인된 기기 ── */
{
  const devices = viaAuth('devices');
  const { deviceName } = await import('./lib/http.js');
  const named = (ua) => deviceName({ headers: { 'user-agent': ua } });
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
  const GALAXY = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
  ok('a device is named by browser and system, not by the whole user-agent',
    named(IPHONE) === 'Safari · iPhone' && named(EDGE) === 'Edge · Windows' && named(GALAXY) === 'Samsung Internet · Android',
    [named(IPHONE), named(EDGE), named(GALAXY)].join(' / '));
  ok('an unknown one gets no name', named('curl/8.4.0') === '' && named(undefined) === '');

  const signIn = (username, ua) => call(login, { method: 'POST', headers: { 'user-agent': ua }, body: { username, password: PW } });
  const here = await join('roamer');
  const phone = cookieOf(await signIn('roamer', IPHONE));
  const laptop = cookieOf(await signIn('roamer', EDGE));
  const stranger = await join('roamer-neighbor');

  r = await call(devices, { token: phone });
  const list = r.body.devices;
  ok('the list shows every sign-in of this account', r.status === 200 && list.length === 3, JSON.stringify(list));
  ok('this device comes first and is marked', list[0].current && list[0].device === 'Safari · iPhone' && list.filter((d) => d.current).length === 1);
  ok('the others carry their names', list.some((d) => d.device === 'Edge · Windows'));
  ok('nothing in it can be used to sign in',
    list.every((d) => Object.keys(d).sort().join() === 'current,device,id,seenAt') && !JSON.stringify(list).includes(phone));
  ok('only the name is stored, never the user-agent',
    (await pg.query(`select count(*)::int as n from sessions where device like '%Mozilla%'`)).rows[0].n === 0);
  ok('the list needs a sign-in', (await call(devices)).status === 401);

  const edge = list.find((d) => d.device === 'Edge · Windows');
  await call(pushApi, { method: 'POST', token: laptop, body: { subscription: { endpoint: 'https://push.example/laptop', keys: { p256dh: 'P', auth: 'A' } } } });
  await call(pushApi, { method: 'POST', token: phone, body: { subscription: { endpoint: 'https://push.example/phone', keys: { p256dh: 'P', auth: 'A' } } } });
  const subs = async () => (await pg.query(`select endpoint from push_subs where endpoint like 'https://push.example/%' order by 1`)).rows.map((s) => s.endpoint).join();

  r = await call(devices, { method: 'DELETE', token: stranger, body: { id: edge.id } });
  ok('someone else cannot sign my device out', r.status === 404 && (await call(state, { token: laptop })).status === 200);
  r = await call(devices, { method: 'DELETE', token: phone, body: { id: list[0].id } });
  ok('this device is not signed out from the list', r.status === 404 && (await call(state, { token: phone })).status === 200);
  r = await call(devices, { method: 'DELETE', token: phone, body: { id: 'not-a-number' } });
  ok('a made-up number is refused', r.status === 400 && r.body.error === 'error.noDevice');

  r = await call(devices, { method: 'DELETE', token: phone, body: { id: edge.id } });
  ok('signing another device out works', r.status === 204);
  ok('that device is out', (await call(state, { token: laptop })).status === 401);
  ok('the rest stay in', (await call(state, { token: phone })).status === 200 && (await call(state, { token: here })).status === 200);
  ok('and its notifications stop, only its own', (await subs()) === 'https://push.example/phone', await subs());
  ok('the list no longer shows it', (await call(devices, { token: phone })).body.devices.length === 2);
  r = await call(devices, { method: 'DELETE', token: phone, body: { id: edge.id } });
  ok('doing it twice says it is gone', r.status === 404);

  /* 하루에 한 번만 적습니다 — 요청마다 쓰면 DB가 쉴 틈이 없습니다 */
  const seen = async () => (await pg.query('select seen_at, expires_at from sessions where id = $1', [list[0].id])).rows[0];
  const before = await seen();
  r = await call(state, { token: phone });
  ok('a fresh sign-in is not written again on every request',
    !r.headers['Set-Cookie'] && String((await seen()).seen_at) === String(before.seen_at));
  await pg.query(`update sessions set seen_at = now() - interval '2 days' where id = $1`, [list[0].id]);
  r = await call(state, { token: phone });
  const after = await seen();
  ok('after a day the last-used time moves up and the sign-in is extended',
    !!r.headers['Set-Cookie'] && Date.now() - new Date(after.seen_at).getTime() < 60_000 && after.expires_at >= before.expires_at,
    JSON.stringify(after));

  /* 비밀번호를 바꾸면 다른 기기의 알림도 같이 꺼집니다 */
  const account = viaAuth('account');
  const other = cookieOf(await signIn('roamer', GALAXY));
  await call(pushApi, { method: 'POST', token: other, body: { subscription: { endpoint: 'https://push.example/galaxy', keys: { p256dh: 'P', auth: 'A' } } } });
  r = await call(account, { method: 'PATCH', token: phone, body: { current: PW, password: PW + '!' } });
  ok('changing the password also stops the notifications of the devices it signs out',
    r.status === 204 && (await subs()) === 'https://push.example/phone', await subs());
}

/* ── 나가는 문: 탈퇴 ── */
{
  const { useBlob } = await import('./lib/blob.js');
  const account = viaAuth('account');
  const files = new Map();
  useBlob({
    put: async (path, bytes) => { files.set(path, bytes); },
    get: async (path) => files.get(path) || null,
    del: async (paths) => paths.forEach((p) => files.delete(p)),
  });
  const rows = async (table, couple) =>
    (await pg.query(`select count(*)::int as n from ${table} where couple_id = $1`, [couple])).rows[0].n;

  /* 둘이 쓰던 달력 하나를 차려 둡니다 */
  const leaverA = await join('leave-a');
  const inviteCode = (await call(invite, { method: 'POST', token: leaverA })).body.code;
  const leaverB = await join('leave-b', inviteCode);
  const shared = await coupleOf('leave-a');
  await call(eventsCreate, { method: 'POST', token: leaverA, body: { title: 'our trip', date: '2026-12-01' } });
  await call(photosCreate, { method: 'POST', token: leaverA, body: { mime: 'image/webp', data: TINY } });
  await subscribe(leaverA, 'https://web.push.apple.com/leave-a');
  await subscribe(leaverB, 'https://web.push.apple.com/leave-b');

  r = await call(account, { method: 'GET', token: leaverB });
  ok('there is no download any more — only the way out', r.status === 405);


  r = await call(account, { method: 'DELETE', token: leaverA, body: { password: 'not it' } });
  ok('leaving asks for the password again', r.status === 403 && r.body.error === 'error.wrongPassword');
  ok('and a wrong one is not a sign-out (403, not 401)', (await call(state, { token: leaverA })).status === 200);

  r = await call(account, { method: 'DELETE', token: leaverA, body: { password: PW } });
  ok('the first one leaves', r.status === 204 && /Max-Age=0/.test(r.headers['Set-Cookie'] || ''));
  ok('their account and sign-ins are gone',
    (await pg.query(`select count(*)::int as n from users where username = 'leave-a'`)).rows[0].n === 0
    && (await call(state, { token: leaverA })).status === 401);
  ok('their phone stops ringing for this calendar',
    (await pg.query(`select count(*)::int as n from push_subs where endpoint = 'https://web.push.apple.com/leave-a'`)).rows[0].n === 0);
  r = await call(state, { token: leaverB });
  ok('the one who stays keeps the whole calendar',
    r.body.events.some((e) => e.title === 'our trip') && r.body.photos.length === 1 && files.size === 1);
  ok('and can invite someone into the empty seat', r.body.paired === false
    && (await call(invite, { method: 'POST', token: leaverB })).status === 201);

  r = await call(account, { method: 'DELETE', token: leaverB, body: { password: PW } });
  ok('the last one leaves too', r.status === 204);
  const tables = ['events', 'settings', 'photos', 'push_subs', 'reminders_sent', 'invites'];
  const left = {};
  for (const table of tables) left[table] = await rows(table, shared);
  ok('and nothing of that calendar is left anywhere', Object.values(left).every((n) => n === 0), JSON.stringify(left));
  ok('not even the photo files', files.size === 0);
  ok('nor the calendar itself', (await pg.query('select count(*)::int as n from couples where id = $1', [shared])).rows[0].n === 0);

  /* 둘이 동시에 나가도 주인 없는 달력이 남으면 안 됩니다 */
  const both1 = await join('both-1');
  const both2 = await join('both-2', (await call(invite, { method: 'POST', token: both1 })).body.code);
  const racing = await coupleOf('both-1');
  await call(eventsCreate, { method: 'POST', token: both1, body: { title: 'left behind?', date: '2026-12-02' } });
  await Promise.all([
    call(account, { method: 'DELETE', token: both1, body: { password: PW } }),
    call(account, { method: 'DELETE', token: both2, body: { password: PW } }),
  ]);
  ok('two leaving at once leave nothing behind',
    (await pg.query('select count(*)::int as n from couples where id = $1', [racing])).rows[0].n === 0
    && (await rows('events', racing)) === 0);

  r = await call(account, { method: 'DELETE' });
  ok('leaving needs a sign-in', r.status === 401);
  useBlob(null);
}

/* ── 구글로 들어오기 ── */
{
  const crypto = await import('node:crypto');
  const { useGoogleKeys } = await import('./lib/google.js');
  const google = viaAuth('google');
  const account = viaAuth('account');
  const WEB = 'web-client.apps.googleusercontent.com';

  /* 구글 대신 우리가 서명합니다. 공개키만 lib/google.js에 넘겨요 */
  const pair = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    return { privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid: crypto.randomUUID(), alg: 'RS256', use: 'sig' } };
  };
  const googleKey = pair();
  const strangerKey = pair();
  useGoogleKeys(async () => [googleKey.jwk]);

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const idToken = (claims = {}, { key = googleKey, header = {} } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const head = b64({ alg: 'RS256', kid: key.jwk.kid, typ: 'JWT', ...header });
    const body = b64({
      iss: 'https://accounts.google.com', aud: WEB, sub: '1001', email: 'Mina@Gmail.com', email_verified: true,
      iat: now, exp: now + 3600, ...claims,
    });
    const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(key.privateKey, 'base64url');
    return `${head}.${body}.${sig}`;
  };

  delete process.env.GOOGLE_CLIENT_IDS;
  r = await call(google, { method: 'GET' });
  ok('without a client id there is no google button', r.status === 404);
  r = await call(google, { method: 'POST', body: { credential: idToken() } });
  ok('and no google sign-in either', r.status === 404);

  process.env.GOOGLE_CLIENT_IDS = `${WEB}, android-client.apps.googleusercontent.com`;
  r = await call(google, { method: 'GET' });
  ok('the screen is told the web client id', r.status === 200 && r.body.clientId === WEB, JSON.stringify(r.body));

  const refused = async (label, credential) => {
    r = await call(google, { method: 'POST', body: { credential } });
    ok(label, r.status === 400 && r.body.error === 'error.googleFailed' && !cookieOf(r), JSON.stringify(r.body));
  };
  await refused('a token google did not sign is refused', idToken({}, { key: strangerKey }));
  await refused('so is one made out for another app', idToken({ aud: 'someone-else.apps.googleusercontent.com' }));
  await refused('or from another issuer', idToken({ iss: 'https://evil.example' }));
  await refused('or one that has expired', idToken({ exp: Math.floor(Date.now() / 1000) - 3600 }));
  await refused('or one that claims no signature at all', idToken({}, { header: { alg: 'none' } }));
  const [h, p] = idToken().split('.');
  const tampered = `${h}.${b64({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: '666' })}.${idToken().split('.')[2]}`;
  await refused('or one whose contents were changed', tampered);
  await refused('or junk', 'not.a.token');
  const nobodyYet = (await pg.query('select count(*)::int as n from users where google_sub is not null')).rows[0].n;
  ok('none of those made an account', nobodyYet === 0);

  r = await call(google, { method: 'POST', body: { credential: idToken() } });
  const mina = cookieOf(r);
  ok('a first google sign-in makes the account and signs in', r.status === 201 && r.body.created === true && mina.length > 40);
  r = await call(state, { token: mina });
  ok('with a calendar of its own, shown by the google email',
    r.status === 200 && r.body.me?.slot === 'a' && r.body.me?.login === 'mina@gmail.com' && r.body.paired === false, JSON.stringify(r.body.me));
  ok('and no password', r.body.me?.hasPassword === false);
  ok('the google account is known by its number, not its email',
    (await pg.query(`select username, password_hash from users where google_sub = '1001'`)).rows[0]?.username === null);

  r = await call(google, { method: 'POST', body: { credential: idToken({ email: 'renamed@gmail.com' }) } });
  ok('signing in again finds the same account', r.status === 200 && r.body.created === false
    && (await pg.query(`select count(*)::int as n from users where google_sub = '1001'`)).rows[0].n === 1);
  const busy = { 'x-forwarded-for': BUSY_IP };
  r = await call(google, { method: 'POST', headers: busy, body: { credential: idToken({ sub: '1001' }) } });
  ok('a known google account signs in even from a busy address', r.status === 200);
  r = await call(google, { method: 'POST', headers: busy, body: { credential: idToken({ sub: '1009' }) } });
  ok('but a new google account from there waits like any sign-up', r.status === 429 && r.body.error === 'error.tooManySignups'
    && (await pg.query(`select count(*)::int as n from users where google_sub = '1009'`)).rows[0].n === 0);
  ok('the android client id is accepted too',
    (await call(google, { method: 'POST', body: { credential: idToken({ aud: 'android-client.apps.googleusercontent.com' }) } })).status === 200);

  r = await call(google, { method: 'POST', body: { credential: idToken({ sub: '1002', email_verified: false, email: 'fake@gmail.com' }) } });
  const unverified = cookieOf(r);
  ok('an email google has not checked is not kept', r.status === 201
    && (await pg.query(`select email from users where google_sub = '1002'`)).rows[0]?.email === null);

  /* 초대 링크로 구글 가입 */
  const code = (await call(invite, { method: 'POST', token: mina })).body.code;
  r = await call(google, { method: 'POST', body: { credential: idToken({ sub: '1003', email: 'jun@gmail.com' }), invite: code } });
  const jun = cookieOf(r);
  r = await call(state, { token: jun });
  ok('a google sign-up through an invite sits in that calendar', r.body.me?.slot === 'b' && r.body.paired === true, JSON.stringify(r.body));
  r = await call(google, { method: 'POST', body: { credential: idToken({ sub: '1004' }), invite: 'made-up' } });
  ok('a made-up invite makes no google account either', r.status === 400 && r.body.error === 'error.badInvite'
    && (await pg.query(`select count(*)::int as n from users where google_sub = '1004'`)).rows[0].n === 0);

  r = await call(account, { method: 'PATCH', token: unverified, body: { current: '', password: 'a brand new one' } });
  ok('a google-only account has no password to change', r.status === 403
    && (await pg.query(`select password_hash from users where google_sub = '1002'`)).rows[0].password_hash === null);

  /* 구글로 들어온 사람의 탈퇴는 구글로 한 번 더 확인합니다 */
  r = await call(account, { method: 'DELETE', token: unverified, body: { password: '' } });
  ok('leaving with no password needs google again', r.status === 403 && r.body.error === 'error.googleFailed');
  r = await call(account, { method: 'DELETE', token: unverified, body: { credential: idToken({ sub: '1001' }) } });
  ok('and not someone else\'s google', r.status === 403);
  r = await call(account, { method: 'DELETE', token: unverified, body: { credential: idToken({ sub: '1002' }, { key: strangerKey }) } });
  ok('nor a forged one', r.status === 403);
  r = await call(account, { method: 'DELETE', token: unverified, body: { credential: idToken({ sub: '1002' }) } });
  ok('its own google lets it go', r.status === 204
    && (await pg.query(`select count(*)::int as n from users where google_sub = '1002'`)).rows[0].n === 0);

  r = await call(account, { method: 'DELETE', token, body: { credential: idToken({ sub: '1001' }) } });
  ok('a password account cannot be deleted with somebody\'s google', r.status === 403 && r.body.error === 'error.wrongPassword');

  useGoogleKeys(null);
  delete process.env.GOOGLE_CLIENT_IDS;
}

/* 규칙 자체 — 시각 계산은 순수 함수라 따로 봅니다 */
const { plan, localNow, nextDate, resolveZone } = await import('./lib/remind.js');
const soonAt = (time, minutes) => plan([{ time }], minutes).filter((j) => j.kind === 'soon').length;
ok('an hour before is the earliest', soonAt('15:00', 14 * 60) === 1 && soonAt('15:00', 13 * 60 + 59) === 0);
ok('right up to the start, then never', soonAt('15:00', 14 * 60 + 59) === 1 && soonAt('15:00', 15 * 60) === 0);
ok('the 8am digest has all-day and what is left of the day',
  plan([{ time: '07:00' }, { time: '10:00' }, {}], 8 * 60).find((j) => j.kind === 'today')?.events.length === 2);
ok('the digest waits for a knock between 8 and 8:30',
  !plan([{}], 7 * 60 + 59).length && plan([{}], 8 * 60 + 29).length === 1 && !plan([{}], 8 * 60 + 30).length);
ok("tomorrow's 00:20 is seen from 23:30", plan([], 23 * 60 + 30, [{ time: '00:20' }])[0]?.tomorrow === true
  && plan([], 23 * 60 + 30, [{ time: '01:00' }]).length === 0);
ok('the next day rolls over months and years', nextDate('2026-12-31') === '2027-01-01' && nextDate('2028-02-28') === '2028-02-29');
ok('an unknown zone falls back to UTC', resolveZone('Mars/Olympus') === 'UTC' && resolveZone('Asia/Seoul') === 'Asia/Seoul');
ok('the day turns over where they live, not where the server is',
  localNow('Asia/Seoul', new Date('2026-09-14T22:30:00Z')).date === '2026-09-15'
  && localNow('UTC', new Date('2026-09-14T22:30:00Z')).date === '2026-09-14');
ok('midnight is 0 minutes, not 1440',
  localNow('Asia/Seoul', new Date('2026-09-14T15:00:00Z')).minutes === 0);
ok('zones west of UTC read the earlier day',
  localNow('America/New_York', new Date('2026-09-14T02:00:00Z')).date === '2026-09-13');

/* ── 배포 모양: Vercel Hobby는 배포 하나에 함수 12개까지 — 넘으면 배포가 통째로 실패합니다 ── */
{
  const functions = fs.readdirSync('api', { recursive: true })
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => p.endsWith('.js') && !p.split('/').some((part) => part.startsWith('_')));
  ok('the deploy stays within 12 functions', functions.length <= 12, `${functions.length}: ${functions.join(', ')}`);

  const { rewrites = [] } = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const routed = (path) => rewrites.some(({ source, destination }) => {
    const m = /^\/api\/:op\(([^)]+)\)$/.exec(source);
    return m && destination === '/api/auth?op=:op' && m[1].split('|').includes(path.slice('/api/'.length));
  });
  const paths = ['/api/signup', '/api/login', '/api/logout', '/api/invite', '/api/account', '/api/devices'];
  ok('every account address still reaches its handler', paths.every(routed), paths.filter((p) => !routed(p)).join());

  r = await call(auth, { method: 'POST', query: { op: 'toString' } });
  ok('the account door knows only its own', r.status === 404);

  /* 기본은 구글 하나 — 아이디로 새로 가입하거나 들어오는 문은 닫혀 있습니다 */
  delete process.env.PASSWORD_SIGNIN;
  r = await call(signup, { method: 'POST', body: { username: 'closed', password: PW } });
  ok('without PASSWORD_SIGNIN nobody signs up with a username', r.status === 410 && r.body.error === 'error.googleOnly', r);
  ok('and nothing was made', (await pg.query(`select count(*)::int as n from users where username = 'closed'`)).rows[0].n === 0);
  r = await call(login, { method: 'POST', body: { username: 'nana', password: PW } });
  ok('nor signs in with one', r.status === 410 && r.body.error === 'error.googleOnly', r);
  process.env.PASSWORD_SIGNIN = 'on';
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
