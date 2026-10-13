'use strict';

/* Japanese national holidays (国民の祝日に関する法律), as the law stands since 2020.
 *
 * Returns a Map of 'YYYY-MM-DD' → i18n key; see holidays/kr.js for the shape.
 * Needs holidays/calc.js.
 *
 * Not reproduced: the days moved for the Tokyo Olympics in 2020 and 2021, and
 * one-off holidays such as imperial ceremonies.
 */

(() => {
  /* [month-day, i18n key] */
  const FIXED_DAYS = [
    ['01-01', 'holiday.newYear'],
    ['02-11', 'holiday.jpFoundation'],
    ['02-23', 'holiday.emperor'],
    ['04-29', 'holiday.showa'],
    ['05-03', 'holiday.jpConstitution'],
    ['05-04', 'holiday.greenery'],
    ['05-05', 'holiday.children'],
    ['08-11', 'holiday.mountain'],
    ['11-03', 'holiday.culture'],
    ['11-23', 'holiday.labourThanks'],
  ];

  /* "Happy Monday" holidays: [month, which Monday, i18n key] */
  const MONDAYS = [
    [1, 2, 'holiday.comingOfAge'],
    [7, 3, 'holiday.marine'],
    [9, 3, 'holiday.respectAged'],
    [10, 2, 'holiday.sports'],
  ];

  /* The equinox days are fixed each February for the following year by the
     National Astronomical Observatory. This is the formula their dates follow
     from 1980 to 2099. */
  function equinox(year, base) {
    const n = year - 1980;
    return Math.floor(base + 0.242194 * n - Math.floor(n / 4));
  }

  const cache = new Map();

  /**
   * Every holiday in a year, as a Map of date → i18n key.
   *
   * Two extra kinds of day off come out of the law:
   * - a holiday on a Sunday moves to the next day that is not itself a holiday
   *   (振替休日, "substitute holiday")
   * - a day with a holiday on both sides becomes one (国民の休日, "citizens'
   *   holiday") — in some years the Tuesday between Respect for the Aged Day
   *   and the Autumnal Equinox
   */
  function holidays(year, helpers) {
    if (cache.has(year)) return cache.get(year);
    const { ymd, parse, addDays } = helpers;
    const { nthWeekday } = window.HOLIDAY_CALC;

    const days = new Map();
    for (const [md, key] of FIXED_DAYS) days.set(`${year}-${md}`, key);
    for (const [month, n, key] of MONDAYS) days.set(ymd(nthWeekday(year, month, 1, n)), key);
    days.set(ymd(new Date(year, 2, equinox(year, 20.8431))), 'holiday.vernalEquinox');
    days.set(ymd(new Date(year, 8, equinox(year, 23.2488))), 'holiday.autumnEquinox');

    const national = [...days.keys()].sort();

    for (const date of national) {
      const between = ymd(addDays(parse(date), 1));
      if (!days.has(between) && days.has(ymd(addDays(parse(date), 2)))) {
        days.set(between, 'holiday.citizens');
      }
    }

    for (const date of national) {
      if (parse(date).getDay() !== 0) continue;
      let d = addDays(parse(date), 1);
      while (days.has(ymd(d))) d = addDays(d, 1);
      days.set(ymd(d), 'holiday.substitute');
    }

    cache.set(year, days);
    return days;
  }

  window.HOLIDAYS = window.HOLIDAYS || {};
  window.HOLIDAYS.jp = { label: 'region.jp', holidays };
})();
