-- 달력 스키마. 앱이 처음 켜질 때 스스로 돌립니다 (lib/setup.js). Neon SQL Editor에 붙여넣어 돌려도 됩니다.

-- ── 계정 ──────────────────────────────────
-- 달력 하나 = 커플 하나. 일정·설정·사진·알림이 전부 couple_id로 여기에 매달립니다.
-- 한 쌍만 쓰던 예전 판의 줄은 couple_id가 비어 있습니다. 지우지 않지만 아무에게도
-- 보이지 않아요 — 첫 가입자에게 자동으로 넘기면, 주인보다 먼저 가입한 낯선 사람이
-- 그 달력을 가져갑니다.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique,
  google_sub    text unique,
  email         text,
  password_hash text,
  created_at    timestamptz not null default now()
);

-- 구글로 들어온 사람. sub는 구글 계정마다 변하지 않는 번호라 이걸로 알아봅니다 —
-- 이메일은 바뀔 수 있어 보여주기만 합니다. 그래서 이메일은 더는 겹쳐도 되고,
-- 구글로만 들어온 사람은 비밀번호가 없습니다.
alter table users add column if not exists google_sub text;
create unique index if not exists users_google_sub_idx on users (google_sub);
alter table users drop constraint if exists users_email_key;
alter table users alter column password_hash drop not null;

-- 가입은 아이디로 합니다. 이메일로 가입하던 때의 계정은 그 이메일이 곧 아이디가 되어
-- 그대로 로그인됩니다. 비밀번호가 있는 줄만 옮겨요 — 구글로 들어온 사람은 비밀번호가 없습니다.
alter table users add column if not exists username text;
create unique index if not exists users_username_idx on users (username);
alter table users alter column email drop not null;
update users set username = email where username is null and email is not null and password_hash is not null;

-- 메일로 비밀번호를 되찾던 판의 표. 이메일을 더는 안 받으니 쓸 데가 없습니다.
drop table if exists password_resets;

create table if not exists couples (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- 누가 어느 달력의 누구(a/b)인지. 한 사람은 달력 하나에만 속합니다.
create table if not exists couple_members (
  couple_id uuid not null references couples (id) on delete cascade,
  user_id   uuid not null unique references users (id) on delete cascade,
  slot      text not null check (slot in ('a', 'b')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, slot)
);

-- 상대를 부르는 링크. 코드는 해시만 둡니다 — 이 표가 새도 링크를 만들 수 없게.
-- 한 번 쓰면 지워지고, 달력마다 살아 있는 링크는 하나뿐입니다.
create table if not exists invites (
  code_hash  text primary key,
  couple_id  uuid not null references couples (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 로그인 상태. 쿠키에는 토큰을, 여기에는 그 해시만 둡니다.
create table if not exists sessions (
  token_hash text primary key,
  user_id    uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);

-- 설정의 "로그인된 기기" 목록. 토큰 해시를 화면에 내보낼 수는 없어서 줄마다 번호(id)를 따로 둡니다.
-- device는 "Chrome · Windows" 같은 이름만 — 브라우저가 보낸 User-Agent 원문은 두지 않습니다.
-- seen_at은 하루에 한 번쯤만 고칩니다 (lib/accounts.js findSession의 stale).
alter table sessions add column if not exists id uuid not null default gen_random_uuid();
alter table sessions add column if not exists device text not null default '';
alter table sessions add column if not exists seen_at timestamptz not null default now();
create unique index if not exists sessions_id_idx on sessions (id);

-- 틀린 비밀번호 기록. 아이디 하나에 15분 동안 열 번이 넘으면 잠깐 막습니다.
-- (칸 이름은 이메일로 가입하던 때 그대로입니다 — 아이디가 들어갑니다.)
create table if not exists login_failures (
  email text not null,
  at    timestamptz not null default now()
);

create index if not exists login_failures_email_idx on login_failures (email, at);

-- 새로 만든 계정. 한 주소(IP)에서 한 시간에 몇 개까지만 만들게 합니다 — 봇이 계정과 달력을
-- 쏟아내지 못하게. IP는 그대로 두지 않고 해시로만 적어요.
create table if not exists signups (
  ip_hash text not null,
  at      timestamptz not null default now()
);

create index if not exists signups_ip_idx on signups (ip_hash, at);

-- ── 달력 ──────────────────────────────────

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  start_date  date not null,
  end_date    date,
  at_time     text,
  end_time    text,
  memo        text not null default '',
  owner       text not null default 'both' check (owner in ('a', 'b', 'both')),
  repeat_rule text not null default 'none' check (repeat_rule in ('none', 'monthly', 'yearly')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 이미 만들어진 테이블에도 안전하게 반영됩니다 (기존 DB에는 이 줄만 다시 실행하면 됩니다).
alter table events add column if not exists end_time text;

create index if not exists events_start_date_idx on events (start_date);

alter table events add column if not exists couple_id uuid references couples (id) on delete cascade;
create index if not exists events_couple_idx on events (couple_id, start_date);

-- 이름과 인사말이 비어 있으면 화면이 그 언어의 기본값을 씁니다 (public/i18n/).
-- 여기에 값을 박아두면 처음 쓴 언어의 이름이 굳어버립니다.
-- 달력마다 한 줄. 가입할 때 만들어집니다 (lib/accounts.js).
create table if not exists settings (
  couple_id       uuid references couples (id) on delete cascade,
  title           text not null default '',
  subtitle        text not null default '',
  theme           text not null default 'peach',
  locale          text not null default '',
  timezone        text not null default 'UTC',
  region          text not null default 'none',
  name_a          text not null default '',
  name_b          text not null default '',
  since           date,
  show_milestones boolean not null default true
);

-- 한 쌍만 쓰던 판은 설정이 id = 1 한 줄뿐이었습니다. 그 줄은 남기고 칸만 바꿉니다.
alter table settings add column if not exists couple_id uuid references couples (id) on delete cascade;
alter table settings drop column if exists id;
create unique index if not exists settings_couple_idx on settings (couple_id);

-- 이미 만들어진 표에도 안전하게 반영됩니다.
alter table settings add column if not exists title text not null default '';
alter table settings add column if not exists subtitle text not null default '';
alter table settings add column if not exists theme text not null default 'peach';

-- 언어와 공휴일 묶음. 둘 다 두 사람이 같은 것을 봅니다.
alter table settings add column if not exists locale text not null default '';
alter table settings add column if not exists region text not null default 'none';

-- 언어가 비어 있으면 "아직 아무도 안 골랐다"는 뜻이라, 처음 연 사람의 브라우저 언어로 채워집니다.
-- 예전 판은 기본값이 'en'이라 한국어 폰에서도 로그인하자마자 영어가 됐습니다.
-- 그때 들어간 'en'을 한 번만 비웁니다. 컬럼 기본값이 아직 'en'인 DB에서만 돌고,
-- 바로 아래 줄이 기본값을 바꾸므로 다시 돌려도 아무 일도 없습니다.
update settings set locale = ''
where locale = 'en'
  and exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'settings'
      and column_name = 'locale' and column_default like '''en''%'
  );
alter table settings alter column locale set default '';

-- 오늘 일정 알림이 쓰는 시간대. "오늘"과 "아침 8시"가 어디 기준인지 정합니다.
alter table settings add column if not exists timezone text not null default 'UTC';

-- 예전 판은 테마를 한국어 이름으로 담았습니다. 쓰던 색을 잃지 않게 id로 옮깁니다.
update settings set theme = case theme
  when '복숭아' then 'peach'
  when '바다'   then 'ocean'
  when '숲'     then 'forest'
  when '살구'   then 'apricot'
  when '밤'     then 'night'
  else theme
end;

-- 설정에서 올린 달력 사진. 일정 옆과 빈 날에 골고루 나옵니다.
-- 브라우저에서 256px 정사각으로 줄여 올리므로 한 장에 10KB 안팎입니다.
create table if not exists photos (
  id         uuid primary key default gen_random_uuid(),
  mime       text not null,
  data       text not null,
  created_at timestamptz not null default now()
);

alter table photos add column if not exists couple_id uuid references couples (id) on delete cascade;
create index if not exists photos_couple_idx on photos (couple_id, created_at);

-- 사진 자체는 Vercel Blob에 두고 여기엔 그 자리만 적습니다 (lib/blob.js).
-- Blob이 없는 설치는 예전처럼 data에 담으니, 둘 중 하나만 차 있습니다.
alter table photos add column if not exists blob_path text;
alter table photos alter column data drop not null;

-- 휴대폰 알림(웹푸시). 기기마다 한 줄씩 생깁니다 — 폰과 노트북을 둘 다 켜두면 두 줄.
-- endpoint가 곧 그 기기의 주소라서, 같은 기기가 다시 켜면 덮어씁니다.
create table if not exists push_subs (
  owner      text not null check (owner in ('a', 'b')),
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subs_owner_idx on push_subs (owner);

-- 같은 기기에서 다른 커플이 로그인하면 endpoint가 같으니 덮어써서 그 커플 것이 됩니다.
alter table push_subs add column if not exists couple_id uuid references couples (id) on delete cascade;
create index if not exists push_subs_couple_idx on push_subs (couple_id);

-- 네이티브 앱(ios·android)은 FCM 토큰 하나로 받습니다. 토큰을 endpoint 칸에 담고,
-- 웹푸시에만 있는 p256dh·auth는 비워 둡니다 (lib/push.js, lib/fcm.js).
alter table push_subs add column if not exists platform text not null default 'web';
alter table push_subs drop constraint if exists push_subs_platform_check;
alter table push_subs add constraint push_subs_platform_check check (platform in ('web', 'ios', 'android'));
alter table push_subs alter column p256dh drop not null;

-- 어느 로그인에서 켠 알림인지. 그 로그인이 끊기면(다른 기기에서 로그아웃시킴, 비밀번호 변경)
-- 알림 주소도 따라 지워집니다 — 안 그러면 쫓겨난 기기가 열어 보기 전까지 알림을 계속 받습니다.
-- 이 칸이 생기기 전에 켠 알림은 비어 있고, 그 기기가 앱을 다시 열 때 채워집니다.
alter table push_subs add column if not exists session_id uuid references sessions (id) on delete cascade;
alter table push_subs alter column auth drop not null;

-- 오늘 일정 알림을 이미 보냈는지 적어두는 자리.
-- 바깥 시계가 5분마다 두드리기 때문에, 이 표가 없으면 같은 알림이 세 번 갑니다.
-- key는 '커플:날짜:종류' 또는 '커플:날짜:일정id:종류' — 하루가 지나면 새 key라 다시 옵니다.
-- 커플이 key에 없으면 먼저 보낸 커플의 '오늘' 기록이 다른 커플의 알림을 막습니다.
create table if not exists reminders_sent (
  key     text primary key,
  sent_at timestamptz not null default now()
);

alter table reminders_sent add column if not exists couple_id uuid references couples (id) on delete cascade;

-- 앱이 처음 켜질 때 스스로 만드는 열쇠들과, 표를 마지막으로 맞춘 schema.sql의 지문.
-- 설치하는 사람이 키를 만들어 붙여넣지 않아도 되게 여기 둡니다 (lib/setup.js).
-- **줄을 지우지 마세요.** vapid_*가 바뀌면 켜둔 알림이 전부 죽습니다.
-- (diary_secret은 비밀번호 하나로 들어오던 예전 판의 것이라 이제 안 씁니다.)
create table if not exists app_meta (
  name  text primary key,
  value text not null
);
