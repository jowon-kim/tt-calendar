'use strict';

/* US federal holidays (5 U.S.C. 6103).
 *
 * Returns a Map of 'YYYY-MM-DD' → i18n key; see holidays/kr.js for the shape.
 * Needs holidays/calc.js.
 *
 * A holiday on a Saturday is observed the Friday before, one on a Sunday the
 * Monday after — so New Year's Day on a Saturday is observed on 31 December of
 * the year before. Inauguration Day and state holidays are left out.
 */

(() => {
  /* [month-day, i18n key] */
  const FIXED_DAYS = [
    ['01-01', 'holiday.newYear'],
    ['06-19', 'holiday.juneteenth'],
    ['07-04', 'holiday.usIndependence'],
    ['11-11', 'holiday.veterans'],
    ['12-25', 'holiday.christmas'],
  ];

  /* [month, weekday (0 = Sunday), which one (-1 = last), i18n key] */
  const WEEKDAYS = [
    [1, 1, 3, 'holiday.mlk'],
    [2, 1, 3, 'holiday.washington'],
    [5, 1, -1, 'holiday.usMemorial'],
    [9, 1, 1, 'holiday.usLabor'],
    [10, 1, 2, 'holiday.columbus'],
    [11, 4, 4, 'holiday.thanksgiving'],
  ];

  const cache = new Map();

  /** Every holiday in a year, as a Map of date → i18n key. */
  function holidays(year, helpers) {
    if (cache.has(year)) return cache.get(year);
    const { ymd, parse, addDays } = helpers;
    const { nthWeekday } = window.HOLIDAY_CALC;

    const days = new Map();
    for (const [md, key] of FIXED_DAYS) days.set(`${year}-${md}`, key);
    for (const [month, weekday, n, key] of WEEKDAYS) {
      days.set(ymd(nthWeekday(year, month, weekday, n)), key);
    }

    /* The observed day. Next year's New Year's Day is checked too, because a
       Saturday one lands on this year's 31 December. */
    const observed = (date) => {
      const week = parse(date).getDay();
      if (week === 6) return ymd(addDays(parse(date), -1));
      if (week === 0) return ymd(addDays(parse(date), 1));
      return null;
    };
    const fixed = [...FIXED_DAYS.map(([md]) => `${year}-${md}`), `${year + 1}-01-01`];
    for (const date of fixed.map(observed)) {
      if (date && date.startsWith(`${year}-`)) days.set(date, 'holiday.substitute');
    }

    cache.set(year, days);
    return days;
  }

  window.HOLIDAYS = window.HOLIDAYS || {};
  window.HOLIDAYS.us = { label: 'region.us', holidays };
})();
