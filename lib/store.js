import { sql } from './db.js';

/* 날짜는 to_char로 문자열로 꺼냅니다. Date 객체로 받으면 시간대 때문에 하루씩 밀립니다. */
export async function listEvents(coupleId) {
  return sql`
  select
    id,
    title,
    to_char(start_date, 'YYYY-MM-DD') as date,
    to_char(end_date,   'YYYY-MM-DD') as "endDate",
    at_time     as time,
    end_time    as "endTime",
    memo,
    owner,
    repeat_rule as repeat,
    color,
    created_at  as "createdAt",
    updated_at  as "updatedAt"
  from events
  where couple_id = ${coupleId}
  order by start_date, at_time nulls first, title
`;
}

export async function findEvent(coupleId, id) {
  const rows = await sql`
    select
      id,
      title,
      to_char(start_date, 'YYYY-MM-DD') as date,
      to_char(end_date,   'YYYY-MM-DD') as "endDate",
      at_time     as time,
      end_time    as "endTime",
      memo,
      owner,
      repeat_rule as repeat,
      color
    from events
    where id = ${id} and couple_id = ${coupleId}
  `;
  return rows[0] || null;
}

export async function insertEvent(coupleId, e) {
  const rows = await sql`
    insert into events (couple_id, title, start_date, end_date, at_time, end_time, memo, owner, repeat_rule, color)
    values (${coupleId}, ${e.title}, ${e.date}, ${e.endDate}, ${e.time}, ${e.endTime}, ${e.memo}, ${e.owner}, ${e.repeat}, ${e.color})
    returning
      id,
      title,
      to_char(start_date, 'YYYY-MM-DD') as date,
      to_char(end_date,   'YYYY-MM-DD') as "endDate",
      at_time     as time,
      end_time    as "endTime",
      memo,
      owner,
      repeat_rule as repeat,
      color,
      created_at  as "createdAt",
      updated_at  as "updatedAt"
  `;
  return rows[0];
}

export async function updateEvent(coupleId, id, e) {
  const rows = await sql`
    update events set
      title       = ${e.title},
      start_date  = ${e.date},
      end_date    = ${e.endDate},
      at_time     = ${e.time},
      end_time    = ${e.endTime},
      memo        = ${e.memo},
      owner       = ${e.owner},
      repeat_rule = ${e.repeat},
      color       = ${e.color},
      updated_at  = now()
    where id = ${id} and couple_id = ${coupleId}
    returning
      id,
      title,
      to_char(start_date, 'YYYY-MM-DD') as date,
      to_char(end_date,   'YYYY-MM-DD') as "endDate",
      at_time     as time,
      end_time    as "endTime",
      memo,
      owner,
      repeat_rule as repeat,
      color,
      created_at  as "createdAt",
      updated_at  as "updatedAt"
  `;
  return rows[0] || null;
}

/** 지운 일정을 돌려줍니다 — 알림에 제목·날짜가 필요해서요. 없으면 null. */
export async function removeEvent(coupleId, id) {
  const rows = await sql`
    delete from events
    where id = ${id} and couple_id = ${coupleId}
    returning
      id,
      title,
      to_char(start_date, 'YYYY-MM-DD') as date,
      to_char(end_date,   'YYYY-MM-DD') as "endDate",
      at_time  as time,
      end_time as "endTime",
      memo
  `;
  return rows[0] || null;
}

const FALLBACK = {
  title: '',        // 비워두면 화면이 그 언어의 기본 이름을 씁니다
  subtitle: '',
  theme: 'peach',
  locale: '',       // 비어 있으면 화면이 브라우저 언어를 쓰고, 처음 연 기기가 채웁니다
  region: 'none',   // 공휴일 묶음 (public/holidays/)
  timezone: 'UTC',  // 오늘 일정 알림이 "오늘"과 "아침 8시"를 재는 기준
  names: { a: '', b: '' },
  since: null,
  showMilestones: true,
  icon: null,       // 홈 화면 아이콘 사진 id (purpose='icon'). 없으면 기본 아이콘
};

/* 아직 없는 컬럼은 조회에서 빠지므로, 온 것만 얹고 나머지는 기본값을 씁니다. */
const shapeSettings = (row) => ({
  ...FALLBACK,
  ...(row.title !== undefined ? { title: row.title } : {}),
  ...(row.subtitle !== undefined ? { subtitle: row.subtitle } : {}),
  ...(row.theme !== undefined ? { theme: row.theme } : {}),
  ...(row.locale !== undefined ? { locale: row.locale } : {}),
  ...(row.region !== undefined ? { region: row.region } : {}),
  ...(row.timezone !== undefined ? { timezone: row.timezone } : {}),
  ...(row.icon !== undefined ? { icon: row.icon } : {}),
  names: { a: row.name_a, b: row.name_b },
  since: row.since,
  showMilestones: row.show_milestones,
});

/**
 * 컬럼을 새로 붙이고 Neon에 alter를 돌리기 전 사이가 있습니다. 그때도 달력은
 * 열려야 하고, **있는 값은 살아남아야** 합니다 — 예전에 subtitle을 붙였다가
 * 달력 이름까지 기본값으로 돌아가버린 적이 있어서요.
 *
 * 그래서 넓은 것부터 좁은 것 순으로 읽습니다. alter를 돌리고 나면 첫 줄에서
 * 끝나고, 아래 갈래는 다시 타지 않습니다.
 */
export async function getSettings(coupleId) {
  const tries = [
    () => sql`select title, subtitle, theme, locale, region, timezone, icon, name_a, name_b, to_char(since,'YYYY-MM-DD') as since, show_milestones from settings where couple_id = ${coupleId}`,
    () => sql`select title, subtitle, theme, locale, region, timezone, name_a, name_b, to_char(since,'YYYY-MM-DD') as since, show_milestones from settings where couple_id = ${coupleId}`,
    () => sql`select title, subtitle, theme, locale, region, name_a, name_b, to_char(since,'YYYY-MM-DD') as since, show_milestones from settings where couple_id = ${coupleId}`,
    () => sql`select title, subtitle, theme,                 name_a, name_b, to_char(since,'YYYY-MM-DD') as since, show_milestones from settings where couple_id = ${coupleId}`,
    () => sql`select title, subtitle,        name_a, name_b, to_char(since,'YYYY-MM-DD') as since, show_milestones from settings where couple_id = ${coupleId}`,
    () => sql`select title,                  name_a, name_b, to_char(since,'YYYY-MM-DD') as since, show_milestones from settings where couple_id = ${coupleId}`,
    () => sql`select                         name_a, name_b, to_char(since,'YYYY-MM-DD') as since, show_milestones from settings where couple_id = ${coupleId}`,
  ];

  for (let i = 0; i < tries.length; i++) {
    try {
      const rows = await tries[i]();
      const row = rows[0];
      if (!row) return { ...FALLBACK };
      if (i > 0) console.error('settings is missing a column — run the alter statements in schema.sql');
      return shapeSettings(row);
    } catch (e) {
      if (i === tries.length - 1) throw e;
    }
  }
}


/**
 * 보내온 칸만 바꾸고, 바뀐 줄을 그 자리에서 돌려줍니다.
 *
 * 예전에는 읽고(select) → JS에서 합치고 → 줄 전체를 쓰고(upsert) → 다시
 * 읽었습니다(select). 왕복이 세 번이라 느렸고, 무엇보다 **두 PATCH가 겹치면
 * 나중에 읽은 쪽이 먼저 쓴 쪽을 통째로 지웠습니다** — 색을 고르고 곧바로
 * 저장을 누르면 색이 없던 일이 됐어요.
 *
 * 이제 한 문장이라 겹쳐도 서로 건드리지 않습니다. 안 보낸 칸은 case-when이
 * 원래 값을 그대로 두거든요. (since는 null이 진짜 값이라 coalesce를 못 씁니다.)
 */
export async function patchSettings(coupleId, p) {
  const has = (k) => k in p;
  const hasName = (slot) => !!p.names && slot in p.names; // 이름은 자리마다 따로 — 한 사람 것만 올 수 있어요
  let rows;
  try {
    rows = await sql`
      insert into settings (couple_id, title, subtitle, theme, locale, region, timezone, icon, name_a, name_b, since, show_milestones)
      values (
        ${coupleId},
        coalesce(${p.title ?? null}::text, ''),
        coalesce(${p.subtitle ?? null}::text, ''),
        coalesce(${p.theme ?? null}::text, 'peach'),
        coalesce(${p.locale ?? null}::text, ''),
        coalesce(${p.region ?? null}::text, 'none'),
        coalesce(${p.timezone ?? null}::text, 'UTC'),
        ${p.icon ?? null}::uuid,
        coalesce(${p.names?.a ?? null}::text, ''),
        coalesce(${p.names?.b ?? null}::text, ''),
        ${p.since ?? null}::date,
        coalesce(${p.showMilestones ?? null}::boolean, true)
      )
      on conflict (couple_id) do update set
        title           = case when ${has('title')}::boolean then excluded.title else settings.title end,
        subtitle        = case when ${has('subtitle')}::boolean then excluded.subtitle else settings.subtitle end,
        theme           = case when ${has('theme')}::boolean then excluded.theme else settings.theme end,
        locale          = case when ${has('locale')}::boolean then excluded.locale else settings.locale end,
        region          = case when ${has('region')}::boolean then excluded.region else settings.region end,
        timezone        = case when ${has('timezone')}::boolean then excluded.timezone else settings.timezone end,
        icon            = case when ${has('icon')}::boolean then excluded.icon else settings.icon end,
        name_a          = case when ${hasName('a')}::boolean then excluded.name_a else settings.name_a end,
        name_b          = case when ${hasName('b')}::boolean then excluded.name_b else settings.name_b end,
        since           = case when ${has('since')}::boolean then excluded.since else settings.since end,
        show_milestones = case when ${has('showMilestones')}::boolean then excluded.show_milestones else settings.show_milestones end
      returning title, subtitle, theme, locale, region, timezone, icon, name_a, name_b, to_char(since,'YYYY-MM-DD') as since, show_milestones
    `;
  } catch (e) {
    console.error('settings is missing a column — run the alter statements in schema.sql', e.message);
    rows = await sql`
      insert into settings (couple_id, name_a, name_b, since, show_milestones)
      values (
        ${coupleId},
        coalesce(${p.names?.a ?? null}::text, ''),
        coalesce(${p.names?.b ?? null}::text, ''),
        ${p.since ?? null}::date,
        coalesce(${p.showMilestones ?? null}::boolean, true)
      )
      on conflict (couple_id) do update set
        name_a          = case when ${hasName('a')}::boolean then excluded.name_a else settings.name_a end,
        name_b          = case when ${hasName('b')}::boolean then excluded.name_b else settings.name_b end,
        since           = case when ${has('since')}::boolean then excluded.since else settings.since end,
        show_milestones = case when ${has('showMilestones')}::boolean then excluded.show_milestones else settings.show_milestones end
      returning name_a, name_b, to_char(since,'YYYY-MM-DD') as since, show_milestones
    `;
  }
  return shapeSettings(rows[0]);
}

/* ── 달력 사진 ───────────────────────────── */

/**
 * 올린 순서대로 id만. 사진 자체는 /api/photos/{id}로 따로 받아갑니다.
 * (2분마다 도는 /api/state에 사진을 실으면 너무 무겁습니다.)
 * 테이블이 아직 없으면 기본 6장만 쓰도록 빈 목록을 돌려줍니다.
 */
export async function listPhotoIds(coupleId) {
  try {
    const rows = await sql`select id from photos where couple_id = ${coupleId} and purpose = 'calendar' order by created_at, id`;
    return rows.map((r) => r.id);
  } catch (e) {
    console.error('could not read photos (does the table exist?)', e.message);
    return [];
  }
}

/** purpose: 'calendar'(설정의 달력 사진) · 'diary'("우리" 탭 일기) — 한도를 따로 셉니다. */
export async function countPhotos(coupleId, purpose = 'calendar') {
  const rows = await sql`select count(*)::int as n from photos where couple_id = ${coupleId} and purpose = ${purpose}`;
  return rows[0].n;
}

/** { mime, data, blobPath } — data와 blobPath 중 하나만 차 있습니다 (lib/blob.js). */
export async function findPhoto(coupleId, id) {
  const rows = await sql`
    select mime, data, blob_path as "blobPath" from photos where id = ${id} and couple_id = ${coupleId}
  `;
  return rows[0] || null;
}

/** 사진은 { data } (DB에 base64로) 또는 { blobPath } (Blob에) 둘 중 하나로 받습니다. */
export async function insertPhoto(coupleId, id, mime, { data = null, blobPath = null, purpose = 'calendar' }) {
  await sql`
    insert into photos (id, couple_id, mime, data, blob_path, purpose)
    values (${id}, ${coupleId}, ${mime}, ${data}, ${blobPath}, ${purpose})
  `;
}

/** 홈 화면 아이콘 사진 — 로그인 없이도 읽힙니다 (폰이 홈 화면에 깔 때 쿠키 없이 받아 갈 수 있어서).
    purpose='icon' 인 줄만 — 달력·일기 사진은 여기로 절대 안 나옵니다 */
export async function findIcon(id) {
  const rows = await sql`
    select mime, data, blob_path as "blobPath" from photos where id = ${id} and purpose = 'icon'
  `;
  return rows[0] || null;
}

/** 그 커플의 아이콘 사진인지 (설정에 걸기 전에 확인) */
export async function ownsIcon(coupleId, id) {
  const rows = await sql`select 1 from photos where id = ${id} and couple_id = ${coupleId} and purpose = 'icon'`;
  return rows.length > 0;
}

/** 새 아이콘을 걸고 나면 예전 아이콘 사진들은 치웁니다. 지운 Blob 자리를 돌려줍니다 */
export async function dropOtherIcons(coupleId, keep) {
  const rows = await sql`
    delete from photos where couple_id = ${coupleId} and purpose = 'icon' and id is distinct from ${keep ?? null}::uuid
    returning blob_path as "blobPath"
  `;
  return rows.map((r) => r.blobPath).filter(Boolean);
}

/** 지운 사진의 Blob 자리를 돌려줍니다(DB에 있던 사진이면 null). 없던 사진이면 false. */
export async function removePhoto(coupleId, id) {
  const rows = await sql`
    delete from photos where id = ${id} and couple_id = ${coupleId} returning blob_path as "blobPath"
  `;
  return rows.length ? rows[0].blobPath : false;
}

/* ── 휴대폰 알림 ─────────────────────────── */

/**
 * 알림을 켜둔 기기들. 한 사람이 폰과 노트북을 켜두면 두 줄이 나옵니다.
 * 테이블이 아직 없으면 아무도 없는 걸로 둡니다 — 알림만 안 갈 뿐 달력은 굴러갑니다.
 */
export async function listPushSubs(coupleId) {
  try {
    return await sql`
      select owner, endpoint, p256dh, auth, platform, questions
      from push_subs
      where couple_id = ${coupleId}
      order by created_at
    `.catch(() => sql`
      select owner, endpoint, p256dh, auth, platform
      from push_subs
      where couple_id = ${coupleId}
      order by created_at
    `); // questions 칸을 붙이기 전이면 전부 받는 걸로
  } catch (e) {
    console.error('could not read push_subs (does the table exist?)', e.message);
    return [];
  }
}

/** endpoint가 그 기기의 주소라, 같은 기기가 다시 켜면 덮어씁니다. */
export async function savePushSub(coupleId, owner, s, platform = 'web', sessionId = null) {
  await sql`
    insert into push_subs (couple_id, owner, endpoint, p256dh, auth, platform, session_id)
    values (${coupleId}, ${owner}, ${s.endpoint}, ${s.p256dh ?? null}, ${s.auth ?? null}, ${platform}, ${sessionId})
    on conflict (endpoint) do update set
      couple_id = excluded.couple_id,
      owner  = excluded.owner,
      p256dh = excluded.p256dh,
      auth   = excluded.auth,
      platform = excluded.platform,
      session_id = excluded.session_id
  `;
  // 다시 걸어도 질문 알림 켜고 끈 건 그대로 — 화면이 그 값을 받아 단추를 맞춥니다
  const rows = await sql`select questions from push_subs where endpoint = ${s.endpoint}`.catch(() => []);
  return { questions: rows[0]?.questions !== false };
}

/** 이 기기로 오늘의 질문 알림을 받을지 — 다른 알림은 건드리지 않습니다 */
export async function setPushQuestions(coupleId, endpoint, on) {
  const rows = await sql`update push_subs set questions = ${on} where endpoint = ${endpoint} and couple_id = ${coupleId} returning questions`;
  return rows.length ? rows[0].questions : null;
}

export async function removePushSub(coupleId, endpoint) {
  const rows = await sql`delete from push_subs where endpoint = ${endpoint} and couple_id = ${coupleId} returning endpoint`;
  return rows.length > 0;
}

/* ── 오늘 일정 알림 ──────────────────────── */

/**
 * 그날 시작하는 일정. 반복(매달/매년)은 여기서 펼칩니다 — 달력은 public/app.js의
 * expand()가 펼치지만, 서버는 하루치만 있으면 되니 SQL로 끝냅니다.
 *
 * 여러 날에 걸친 일정은 시작하는 날에만 나옵니다 (중간 날마다 알리지 않아요).
 * 매달 31일 같은 건 그 달에 31일이 없으면 저절로 빠집니다 — 달력과 같은 규칙입니다.
 */
export async function listEventsOn(coupleId, date) {
  return sql`
    select id, title, at_time as time, memo
    from events
    where couple_id = ${coupleId}
      and (start_date = ${date}::date
       or (repeat_rule = 'yearly' and start_date <= ${date}::date
           and to_char(start_date, 'MM-DD') = to_char(${date}::date, 'MM-DD'))
       or (repeat_rule = 'monthly' and start_date <= ${date}::date
           and extract(day from start_date) = extract(day from ${date}::date)))
    order by at_time nulls first, title
  `;
}

/**
 * 이 알림을 보낼 자리를 잡습니다. 처음이면 true, 이미 보냈으면 false.
 *
 * 바깥 시계가 5분마다 두드리니 같은 알림이 여러 번 걸립니다. 보내기 **전에**
 * 자리를 잡아서, 겹쳐 들어와도 한 번만 나가게 합니다.
 */
export async function claimReminder(coupleId, key) {
  const rows = await sql`
    insert into reminders_sent (key, couple_id) values (${coupleId + ':' + key}, ${coupleId})
    on conflict (key) do nothing
    returning key
  `;
  return rows.length > 0;
}

/**
 * 바깥 시계가 두드릴 때 도는 목록 — 달력마다 어느 시간대·언어로 알릴지.
 * 커플이 몇이든 한 번에 읽습니다. 커플마다 설정을 따로 읽으면 두드림 한 번이 N번 왕복이에요.
 */
export async function listCoupleClocks() {
  return sql`
    select couple_id as "coupleId", timezone, locale
    from settings
    where couple_id is not null
  `;
}

/** 그날 쓴 일기 ("우리" 탭) — 아침 모음의 "1년 전 오늘". 제목이 비었으면 메모 첫 줄로. */
export async function listDiaryOn(coupleId, day) {
  return sql`
    select coalesce(nullif(title, ''), split_part(memo, chr(10), 1)) as title
    from items
    where couple_id = ${coupleId} and kind = 'diary' and day = ${day}
    order by created_at
  `;
}

/** 그날 질문에 답한 사람들 ('a'·'b') — 저녁 알림은 아직 안 한 사람에게만. */
export async function listAnswered(coupleId, day) {
  const rows = await sql`select member from answers where couple_id = ${coupleId} and qday = ${day}`;
  return rows.map((r) => r.member);
}

/** 지난 기록은 치웁니다. 하루 지나면 key가 달라져서 다시는 쓰이지 않아요. */
export async function purgeReminders() {
  await sql`delete from reminders_sent where sent_at < now() - interval '7 days'`;
}
