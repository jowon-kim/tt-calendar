/**
 * 일정 알림의 규칙. 언제 무엇을 보낼지만 정하고, 보내지는 않습니다.
 *
 *   시간이 있는 일정 → 시작 1시간 안으로 들어온 첫 두드림에 "곧 시작" 한 번
 *   아침 8시 → 종일 일정과 8시부터의 일정을 묶어서 "오늘 일정" 한 번
 *
 * 바깥 시계가 하루 종일 30분마다 두드립니다. 그래서 "곧 시작"은 보통 30~60분 전에
 * 닿고, 한 번 늦게 두드려도 시작 전이면 그다음 두드림에 나갑니다. 더 자주 두드리면
 * DB가 잠들 틈이 없어 Neon 무료 한도를 넘깁니다 — Neon은 5분 놀아야 잠들어요.
 *
 * "오늘"과 "아침 8시"가 어디 기준인지는 설정의 시간대를 따릅니다. 서버는
 * UTC로 돌기 때문에, 여기서 옮기지 않으면 자정 근처에서 날짜가 밀립니다.
 *
 * 시각 계산이 전부 순수 함수라, 테스트에서 아무 시각이나 넣어볼 수 있습니다.
 */

export const DIGEST = 8 * 60;  // 오늘 일정을 묶어 보내는 시각 (08:00)
const DIGEST_WINDOW = 30;      // 두드림 간격만큼 — 8시 반 전에 오는 첫 두드림이 아침 알림을 보냅니다
const LEAD = 60;               // 시작 이만큼 전부터 알릴 수 있습니다
const DAY = 24 * 60;
export const LOOK_AHEAD = DAY - LEAD; // 이 시각부터는 내일 이른 일정도 봅니다 (23:00)

/** 'HH:MM' -> 자정부터 흐른 분. */
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** 아는 시간대면 그대로, 모르면 UTC. 낯선 값에 알림이 통째로 죽지 않게요. */
export function resolveZone(zone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone || 'UTC' });
    return zone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** 그 시간대에서 지금 — 날짜와 자정부터 흐른 분. */
export function localNow(zone, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveZone(zone),
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23', // hour12:false는 런타임에 따라 자정을 24시로 줍니다
  }).formatToParts(at);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/**
 * 지금 보낼 알림들. 보낼 게 없으면 빈 배열입니다.
 *
 * today·tomorrow는 그날 시작하는 일정들(반복은 이미 펼쳐진 상태). 여러 날짜에 걸친
 * 일정은 시작하는 날에만 들어옵니다. tomorrow는 밤 11시 넘어서만 넘겨받아요 —
 * 새벽 0시 20분 일정은 전날 밤에 알려야 하니까요.
 *
 * 같은 알림이 여러 두드림에 걸리는 건 부른 쪽이 기록(reminders_sent)으로 막습니다.
 */
export function plan(today, minutes, tomorrow = []) {
  const ahead = (e, offset) => toMinutes(e.time) + offset - minutes;
  const soon = (events, offset, next) => events
    .filter((e) => e.time && ahead(e, offset) > 0 && ahead(e, offset) <= LEAD)
    .map((event) => ({ kind: 'soon', event, tomorrow: next }));

  const out = [...soon(today, 0, false), ...soon(tomorrow, DAY, true)];

  // 8시 전 일정은 이미 "곧 시작"이 나갔으니 아침 모음에서는 뺍니다
  const rest = today.filter((e) => !e.time || toMinutes(e.time) >= DIGEST);
  if (rest.length && minutes >= DIGEST && minutes < DIGEST + DIGEST_WINDOW) {
    out.push({ kind: 'today', events: rest });
  }
  return out;
}

/** 'YYYY-MM-DD'의 다음 날. 달력 날짜라 시간대와 상관없이 UTC로 셉니다. */
export function nextDate(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
