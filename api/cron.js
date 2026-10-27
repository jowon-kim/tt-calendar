/**
 * 일정 알림. 바깥 시계가 하루 종일 30분마다 두드립니다.
 *
 *   GET /api/cron   Authorization: Bearer <CRON_SECRET>  (헤더를 못 싣는 서비스면 ?key=)
 *
 * 무엇을 언제 보낼지는 lib/remind.js가 정합니다. 여기서는 두드린 시각을 보고
 * 그 규칙을 돌린 뒤, 이미 보낸 건 건너뛰고 남은 것만 보냅니다.
 * "우리" 탭 몫도 여기서 — 아침 모음에 "1년 전 오늘" 일기 한 줄, 저녁 8시 오늘의 질문.
 *
 * Vercel의 cron은 안 씁니다 — 무료 구간에서는 하루 한 번, 그것도 ±59분이라
 * "곧 시작" 알림이 안 됩니다. 이 주소만 있으면 두드리는 쪽은 아무나 돼요.
 *
 * 답에 담기는 문구는 문구 키가 아니라 영어 그대로입니다. 이 답을 읽는 건 앱이
 * 아니라 시계 서비스의 실행 기록이라서요. 같은 이유로 **일정 제목은 싣지 않습니다** —
 * 남의 커플 일정이 바깥 서비스의 기록에 쌓이면 안 되니, 일정 id와 개수만 적어요.
 */
import { guard, methodNotAllowed, requireCron } from '../lib/http.js';
import { listCoupleClocks, listEventsOn, claimReminder, purgeReminders, listDiaryOn, listAnswered } from '../lib/store.js';
import { notifyAll } from '../lib/push.js';
import { describeSoon, describeToday, describeQuestion, describeMemory } from '../lib/message.js';
import { localNow, plan, nextDate, around, yearAgo, LOOK_AHEAD, DIGEST, EVENING } from '../lib/remind.js';
import { questionFor } from '../lib/questions.js';

/** 손으로 확인할 때 쓰는 창구 — ?at=2026-10-05T06:30 이면 모든 달력이 그 현지 시각인 척합니다. */
function pretend(at) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(at || ''));
  return m ? { date: m[1], minutes: Number(m[2]) * 60 + Number(m[3]) } : null;
}

/** 한 달력 몫. 보낸 것들을 돌려줍니다. */
async function remind({ coupleId, locale }, now) {
  const sent = [];
  const tomorrow = nextDate(now.date);
  const today = await listEventsOn(coupleId, now.date);
  const next = now.minutes >= LOOK_AHEAD ? await listEventsOn(coupleId, tomorrow) : [];
  // "우리" 탭의 1년 전 오늘 일기 — 아침 창에서만 읽습니다 (하루 48번 두드림마다 읽을 일은 아니라서)
  const ago = around(now.minutes, DIGEST) && yearAgo(now.date);
  const memory = ago ? (await listDiaryOn(coupleId, ago)).map((r) => r.title) : [];
  let digested = false;
  for (const job of plan(today, now.minutes, next)) {
    // 한 일정이 두 번의 두드림에 걸릴 수 있습니다. 보내기 전에 자리를 잡아요.
    // 기록은 일정이 있는 날로 — 반복 일정은 날마다 따로 알려야 하니까요
    if (job.kind === 'soon') {
      const day = job.tomorrow ? tomorrow : now.date;
      if (!(await claimReminder(coupleId, `${day}:${job.event.id}:soon`))) continue;
      await notifyAll(coupleId, describeSoon(job.event, locale), `soon:${job.event.id}`);
      sent.push(`soon:${job.event.id}`);
    } else {
      digested = true;
      if (!(await claimReminder(coupleId, `${now.date}:today`))) continue;
      const message = describeToday(job.events, locale);
      if (memory.length) {
        const m = describeMemory(memory, locale);
        message.body += `\n${m.title} · ${m.body}`;
      }
      await notifyAll(coupleId, message, `today:${now.date}`);
      sent.push(`today:${job.events.length}`);
    }
  }
  // 일정이 없는 아침에도 1년 전 일기가 있으면 그것만 따로
  if (memory.length && !digested && await claimReminder(coupleId, `${now.date}:memory`)) {
    await notifyAll(coupleId, describeMemory(memory, locale), `memory:${now.date}`);
    sent.push(`memory:${memory.length}`);
  }
  // 저녁 8시, 오늘의 질문에 아직 답 안 한 사람에게만. 둘 다 답했으면 조용히
  if (around(now.minutes, EVENING)) {
    const answered = await listAnswered(coupleId, now.date);
    if (answered.length < 2 && await claimReminder(coupleId, `${now.date}:question`)) {
      const except = answered.length === 1 ? answered[0] : undefined;
      await notifyAll(coupleId, describeQuestion(questionFor(now.date, locale), locale), `question:${now.date}`, { except, question: true });
      sent.push(`question:${2 - answered.length}`);
    }
  }
  return sent;
}

export default guard(async (req, res) => {
  const allowed = ['GET', 'POST'];
  if (!allowed.includes(req.method)) return methodNotAllowed(res, allowed);
  if (!(await requireCron(req, res))) return;

  /* 달력마다 사는 곳이 달라서 "지금 몇 시"도 달력마다 다릅니다. 시간대를 한 번에
     다 읽고, 달력마다 그 현지 시각으로 규칙을 돌립니다. */
  const at = pretend(req.query?.at);
  const clocks = await listCoupleClocks();
  const sent = (await Promise.all(clocks.map((clock) => remind(clock, at || localNow(clock.timezone))))).flat();

  if (sent.length) await purgeReminders().catch(() => {});
  res.status(200).json({ calendars: clocks.length, sent });
});
