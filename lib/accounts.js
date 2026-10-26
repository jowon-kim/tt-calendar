/**
 * 계정·커플·세션·초대를 DB에 적고 읽습니다. 달력 자체(일정·설정·사진)는 lib/store.js.
 *
 * 여러 표를 한꺼번에 바꾸는 일(가입, 초대 받기)은 **한 문장**으로 씁니다.
 * Neon HTTP 드라이버는 문장마다 따로 가서, 두 문장으로 나누면 가운데서 끊겼을 때
 * 사람만 있고 달력은 없는 계정이 남습니다. 한 문장은 통째로 되거나 통째로 안 됩니다.
 */
import { sql } from './db.js';
import { newToken, hashToken } from './auth.js';

export const SESSION_DAYS = 60;
const INVITE_DAYS = 7;

/** 이미 있는 값에 부딪혔을 때 Postgres가 주는 코드. */
const clash = (e) => e?.code === '23505';

/* ── 가입 ──────────────────────────────────── */

/* 누구로 가입하나: { username, passwordHash } 아니면 구글로 { googleSub, email }. */
const who = ({ username = null, passwordHash = null, googleSub = null, email = null }) =>
  ({ username, passwordHash, googleSub, email });

/** 새 사람 + 새 달력(그 사람이 a) + 빈 설정 한 줄. 이미 있는 아이디(구글 계정)면 null. */
export async function signUpAlone(person) {
  const { username, passwordHash, googleSub, email } = who(person);
  try {
    const rows = await sql`
      with u as (
        insert into users (username, password_hash, google_sub, email)
        values (${username}, ${passwordHash}, ${googleSub}, ${email}) returning id
      ), c as (
        insert into couples default values returning id
      ), m as (
        insert into couple_members (couple_id, user_id, slot) select c.id, u.id, 'a' from c, u
      ), s as (
        insert into settings (couple_id) select id from c
      )
      select u.id as "userId", c.id as "coupleId" from u, c
    `;
    return rows[0];
  } catch (e) {
    if (clash(e)) return null;
    throw e;
  }
}

/**
 * 초대 링크로 가입합니다 — 새 사람을 만들어 그 달력에 바로 넣어요.
 * 자리는 초대한 쪽이 a면 b, b면 a. 둘 다 차 있으면 'b'가 나와 기본키에 부딪히고
 * 문장째 무너집니다(초대 코드도 지워지지 않은 채로).
 * 결과: { userId, coupleId } · 'taken'(이미 있는 아이디·구글 계정) · 'invalid'(없거나 지난 링크, 이미 둘인 달력)
 */
export async function signUpInvited(person, code) {
  const { username, passwordHash, googleSub, email } = who(person);
  const codeHash = hashToken(code);
  try {
    const rows = await sql`
      with inv as (
        delete from invites where code_hash = ${codeHash} and expires_at > now() returning couple_id
      ), u as (
        insert into users (username, password_hash, google_sub, email)
        select ${username}, ${passwordHash}, ${googleSub}, ${email} where exists (select 1 from inv)
        returning id
      ), m as (
        insert into couple_members (couple_id, user_id, slot)
        select inv.couple_id, u.id,
          case when exists (select 1 from couple_members cm where cm.couple_id = inv.couple_id and cm.slot = 'a')
               then 'b' else 'a' end
        from inv, u
      )
      select u.id as "userId", inv.couple_id as "coupleId" from u, inv
    `;
    if (rows[0]) await freshSeat(rows[0].coupleId, rows[0].userId);
    return rows[0] || 'invalid';
  } catch (e) {
    if (!clash(e)) throw e;
    // 아이디(구글 계정)가 겹쳤는지, 달력이 이미 둘인지는 문장이 무너진 뒤라 따로 봅니다
    const [{ taken }] = await sql`
      select exists (select 1 from users where username = ${username} or google_sub = ${googleSub}) as taken
    `;
    return taken ? 'taken' : 'invalid';
  }
}

/**
 * 이미 가입한 사람이 초대를 받습니다. 혼자 쓰던 빈 달력은 버리고 상대 달력으로 옮겨가요.
 * 혼자 쓰던 달력에 일정이나 사진이 있으면 옮기지 않습니다 — 조용히 지우면 안 되니까요.
 * 결과: 새 coupleId · 'invalid' · 'paired'(이미 둘) · 'hasData'
 */
export async function joinByInvite(session, code) {
  const [mine] = await sql`
    select
      (select count(*)::int from couple_members where couple_id = ${session.coupleId}) as members,
      exists (select 1 from events where couple_id = ${session.coupleId})
        or exists (select 1 from photos where couple_id = ${session.coupleId}) as "hasData"
  `;
  if (mine.members > 1) return 'paired';
  if (mine.hasData) return 'hasData';

  let rows;
  try {
    rows = await sql`
      with inv as (
        delete from invites
        where code_hash = ${hashToken(code)} and expires_at > now() and couple_id <> ${session.coupleId}
        returning couple_id
      )
      update couple_members set
        couple_id = inv.couple_id,
        slot = case when exists (select 1 from couple_members cm where cm.couple_id = inv.couple_id and cm.slot = 'a')
                    then 'b' else 'a' end
      from inv
      where couple_members.user_id = ${session.userId}
      returning couple_members.couple_id as "coupleId"
    `;
  } catch (e) {
    if (clash(e)) return 'invalid'; // 그새 누가 먼저 들어가 둘이 찼습니다
    throw e;
  }
  if (!rows[0]) return 'invalid';
  await freshSeat(rows[0].coupleId, session.userId);

  // 사람이 빠진 옛 달력. 여기서 실패해도 빈 달력 하나가 남을 뿐이라 기다리지 않아도 됩니다
  await sql`
    delete from couples
    where id = ${session.coupleId}
      and not exists (select 1 from couple_members where couple_id = ${session.coupleId})
  `.catch((e) => console.error('could not drop the empty calendar', e.message));
  return rows[0].coupleId;
}

/**
 * 초대로 막 앉은 자리의 이름을 비웁니다. 빈 자리에 남은 이름은 예전에 나간 사람 것이라
 * (탈퇴하면 비우게 된 2026-10-26 전의 달력들), 두면 새 사람이 그 이름을 물려받고
 * "뭐라고 불러 드릴까요?"도, 먼저 와 있던 사람에게 가는 "들어왔어요" 알림도 건너뜁니다.
 * 들어오는 길(구글·아이디 가입, 이미 가입한 사람의 합류)이 모두 여길 지납니다.
 * 이미 들어온 뒤라, 여기서 실패해도 합류는 그대로 두고 기록만 남깁니다.
 */
async function freshSeat(coupleId, userId) {
  await sql`
    update settings set
      name_a = case when m.slot = 'a' then '' else settings.name_a end,
      name_b = case when m.slot = 'b' then '' else settings.name_b end
    from couple_members m
    where settings.couple_id = ${coupleId} and m.couple_id = ${coupleId} and m.user_id = ${userId}
  `.catch((e) => console.error('could not clear the seat name', e.message));
}

/* ── 초대 ──────────────────────────────────── */

/** 새 초대 코드. 예전 링크는 죽습니다. 이미 둘이면 null. */
export async function createInvite(coupleId) {
  const [{ members }] = await sql`
    select count(*)::int as members from couple_members where couple_id = ${coupleId}
  `;
  if (members > 1) return null;

  const code = newToken();
  await sql`delete from invites where couple_id = ${coupleId}`;
  await sql`
    insert into invites (code_hash, couple_id, expires_at)
    values (${hashToken(code)}, ${coupleId}, now() + make_interval(days => ${INVITE_DAYS}))
  `;
  return code;
}

/* ── 로그인 ────────────────────────────────── */

export async function findUserByLogin(login) {
  const rows = await sql`select id, password_hash as "passwordHash" from users where username = ${login}`;
  return rows[0] || null;
}

export async function findUserByGoogle(sub) {
  const rows = await sql`select id from users where google_sub = ${sub}`;
  return rows[0] || null;
}

export async function recentFailures(login) {
  const [{ n }] = await sql`
    select count(*)::int as n from login_failures
    where email = ${login} and at > now() - interval '15 minutes'
  `;
  return n;
}

export async function recordFailure(login) {
  await sql`insert into login_failures (email) values (${login})`;
  // 오래된 기록은 그때그때 치웁니다 — 따로 청소하는 시계를 두지 않으려고요
  await sql`delete from login_failures where at < now() - interval '1 day'`.catch(() => {});
}

export async function clearFailures(login) {
  await sql`delete from login_failures where email = ${login}`;
}

/* ── 가입 남용 막기 ────────────────────────── */

const SIGNUPS_PER_HOUR = 5; // 한 집에서 둘이 가입하고, 몇 번 다시 해봐도 넉넉하게

/** 이 주소에서 또 계정을 만들어도 되는지. 주소를 모르면(로컬 개발·테스트) 막지 않습니다. */
export async function mayCreateAccount(ip) {
  if (!ip) return true;
  const [{ n }] = await sql`
    select count(*)::int as n from signups where ip_hash = ${hashToken(ip)} and at > now() - interval '1 hour'
  `;
  return n < SIGNUPS_PER_HOUR;
}

export async function recordSignup(ip) {
  if (!ip) return;
  await sql`insert into signups (ip_hash) values (${hashToken(ip)})`;
  await sql`delete from signups where at < now() - interval '1 day'`.catch(() => {});
}

/* ── 세션 ──────────────────────────────────── */

/** 새 세션의 토큰(쿠키에 담을 원문). DB에는 해시만 갑니다. */
export async function createSession(userId) {
  const token = newToken();
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${hashToken(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))
  `;
  return token;
}

/**
 * 토큰 → { sessionId, userId, login, hasPassword, coupleId, slot, paired, stale }. 없거나 지났으면 null.
 * stale이면 마지막으로 적어 둔 지 하루가 넘은 것 — 부른 쪽이 연장합니다. 쓰는 사람이
 * 60일마다 로그아웃당하지 않게요.
 * (만료가 절반 넘게 지난 것도 stale로 봅니다 — seen_at 칸이 생기기 전의 로그인들.)
 */
export async function findSession(token) {
  if (!token) return null;
  const rows = await sql`
    select
      s.id as "sessionId",
      s.user_id as "userId",
      coalesce(u.username, u.email) as login,
      u.password_hash is not null as "hasPassword",
      m.couple_id as "coupleId",
      m.slot,
      (select count(*)::int from couple_members cm where cm.couple_id = m.couple_id) = 2 as paired,
      (s.expires_at < now() + make_interval(days => ${SESSION_DAYS / 2})
        or s.seen_at < now() - interval '1 day') as stale
    from sessions s
    join users u on u.id = s.user_id
    join couple_members m on m.user_id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()
  `;
  return rows[0] || null;
}

export async function extendSession(token) {
  await sql`
    update sessions set expires_at = now() + make_interval(days => ${SESSION_DAYS}), seen_at = now()
    where token_hash = ${hashToken(token)}
  `;
}

export async function endSession(token) {
  await sql`delete from sessions where token_hash = ${hashToken(token)}`;
}

/* ── 비밀번호 바꾸기 ───────────────────────── */

/**
 * 비밀번호를 바꾸고, 지금 이 기기 말고 다른 곳의 로그인은 모두 끊습니다.
 * 옛 비밀번호를 아는 누군가가 로그인해 있었다면 거기서 쫓겨나야 바꾼 의미가 있어요.
 * 한 문장이라 바뀌기만 하고 안 끊기는 일은 없습니다.
 */
export async function changePassword(userId, passwordHash, keepToken) {
  await sql`
    with u as (
      update users set password_hash = ${passwordHash} where id = ${userId} returning id
    )
    delete from sessions
    where user_id in (select id from u) and token_hash <> ${hashToken(keepToken)}
  `;
}

/* ── 나가는 문 ─────────────────────────────── */

/**
 * 계정을 지웁니다. 상대가 남아 있으면 달력은 상대에게 그대로 두고, 내가 마지막이면
 * 달력째(일정·설정·사진·알림 기기·초대) 지웁니다 — 표마다 on delete cascade라
 * couples 한 줄을 지우면 따라 지워져요.
 *
 * "마지막인지"를 먼저 세고 지우면, 둘이 동시에 탈퇴할 때 둘 다 "상대가 남았다"고 보고
 * 주인 없는 달력이 남습니다. 그래서 사람을 먼저 지우고, 그 뒤에 "아무도 없는 달력이면
 * 지운다"를 한 문장으로 묻습니다. 누가 늦게 오든 둘 중 하나는 이걸 봅니다.
 *
 * 상대가 남으면 내 자리(a/b)를 비웁니다 — 내 이름과 내 일정(owner = 내 자리)을 지우고, "함께" 일정은
 * 남겨요. 자리에 붙은 것이라, 남겨 두면 다음에 초대로 들어온 사람이 남의 이름과 일정을 물려받고
 * "뭐라고 불러 드릴까요?"도 안 뜹니다. 이것도 사람을 지운 **뒤에**, 그 자리가 정말 비어 있을 때만 해서
 * 그새 새 사람이 앉았으면 건드리지 않습니다. 달력이 통째로 지워졌으면 할 일이 없어요.
 *
 * 돌려주는 값: 달력이 사라졌으면 지워야 할 Blob 사진 자리들, 아니면 null.
 */
export async function deleteAccount({ userId, coupleId, slot }) {
  const photos = await sql`
    select blob_path as "blobPath" from photos where couple_id = ${coupleId} and blob_path is not null
  `;
  // 내 폰이 탈퇴한 뒤에도 상대가 바꾼 일정 알림을 받으면 안 되니, 내 기기부터 뗍니다
  await sql`delete from push_subs where couple_id = ${coupleId} and owner = ${slot}`;
  await sql`delete from users where id = ${userId}`; // 세션·자리도 따라 지워집니다
  const gone = await sql`
    delete from couples
    where id = ${coupleId} and not exists (select 1 from couple_members where couple_id = ${coupleId})
    returning id
  `;
  if (gone.length) return photos.map((p) => p.blobPath);

  await sql`
    update settings set
      name_a = case when ${slot} = 'a' then '' else name_a end,
      name_b = case when ${slot} = 'b' then '' else name_b end
    where couple_id = ${coupleId}
      and not exists (select 1 from couple_members where couple_id = ${coupleId} and slot = ${slot})
  `;
  // 지운 일정의 "곧 시작" 알림 기록도 같이 (키: 달력:날짜:일정:soon — api/cron.js)
  await sql`
    with mine as (
      delete from events
      where couple_id = ${coupleId} and owner = ${slot}
        and not exists (select 1 from couple_members where couple_id = ${coupleId} and slot = ${slot})
      returning id
    )
    delete from reminders_sent r using mine
    where r.couple_id = ${coupleId} and r.key like '%:' || mine.id::text || ':soon'
  `;
  return null;
}

/** 탈퇴할 때 본인인지 다시 맞춰보려고 — 비밀번호, 구글로 들어온 사람은 그 구글 계정. */
export async function proofsOf(userId) {
  const rows = await sql`
    select password_hash as "passwordHash", google_sub as "googleSub" from users where id = ${userId}
  `;
  return rows[0] || {};
}
