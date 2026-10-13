/* 알림 문구. 웹푸시가 제목·본문을 따로 받아서 두 조각으로 돌려줍니다.
   어느 언어로 쓸지는 설정에 담긴 값을 따릅니다 (lib/push.js가 넘겨줍니다). */

import { t, resolveLocale } from './i18n.js';

/* 날짜 표기는 Intl에 맡깁니다 — 언어를 하나 더 넣어도 여기 적을 게 없습니다.
   앱이 담는 날짜는 그 사람들의 현지 날짜라, 서버 시간대에 하루 밀리지 않도록
   UTC로 읽습니다. 시각은 "18:30" 그대로 둡니다 — 어느 언어에서나 읽힙니다. */
const dayLabel = (locale, date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

function whenLabel(locale, event) {
  if (event.endDate && event.endDate !== event.date) {
    return `${dayLabel(locale, event.date)} ~ ${dayLabel(locale, event.endDate)}`;
  }
  if (!event.time) return dayLabel(locale, event.date);
  const time = event.endTime ? `${event.time} ~ ${event.endTime}` : event.time;
  return `${dayLabel(locale, event.date)} ${time}`;
}

/**
 * `kind`는 문구 키입니다 — push.newEvent · push.editedEvent · push.deletedEvent.
 *
 * 이름 뒤에 조사를 안 붙이려고 가운뎃점으로 끊었습니다. 한국어는 받침에 따라
 * 이/가가 갈리고, 다른 언어도 이름에 붙는 말이 제각각이라 안 붙이는 편이 낫습니다.
 */
export function describe(kind, event, who, locale) {
  const name = t(locale, kind);
  return {
    title: who ? `${name} · ${who}` : name,
    body: [whenLabel(locale, event), event.title, event.memo].filter(Boolean).join('\n'),
  };
}

/**
 * 오늘 일정 알림. 오늘 일이라 날짜는 빼고 시간만 적습니다.
 * 둘 다 받는 알림이라 누가 만들었는지도 적지 않습니다.
 */
export function describeSoon(event, locale) {
  return {
    title: t(locale, 'push.soon'),
    body: [`${event.time} ${event.title}`, event.memo].filter(Boolean).join('\n'),
  };
}

/** 아침에 한 번, 남은 일정을 줄줄이. 시간 없는 일정은 '종일'로 적습니다. */
export function describeToday(events, locale) {
  const allDay = t(locale, 'push.allDay');
  return {
    title: t(locale, 'push.today', { count: events.length }),
    body: events.map((e) => `${e.time || allDay} ${e.title}`).join('\n'),
  };
}
