'use strict';

/* Public holidays in Russia (Labour Code, article 112).
 *
 * Returns a Map of 'YYYY-MM-DD' → i18n key; see holidays/kr.js for the shape.
 *
 * Only the holidays themselves are marked. The days off they turn into move
 * every year by government decree — a holiday on a weekend does not simply
 * give the Monday, and New Year days often land in May or on 31 December —
 * so those moves are not reproduced.
 */

(() => {
  /* [month-day, i18n key] */
  const FIXED_DAYS = [
    ['01-01', 'holiday.newYear'],
    ['01-02', 'holiday.newYearHolidays'],
    ['01-03', 'holiday.newYearHolidays'],
    ['01-04', 'holiday.newYearHolidays'],
    ['01-05', 'holiday.newYearHolidays'],
    ['01-06', 'holiday.newYearHolidays'],
    ['01-07', 'holiday.orthodoxChristmas'],
    ['01-08', 'holiday.newYearHolidays'],
    ['02-23', 'holiday.defender'],
    ['03-08', 'holiday.womens'],
    ['05-01', 'holiday.labour'],
    ['05-09', 'holiday.victory'],
    ['06-12', 'holiday.russia'],
    ['11-04', 'holiday.ruUnity'],
  ];

  const cache = new Map();

  /** Every holiday in a year, as a Map of date → i18n key. */
  function holidays(year) {
    if (cache.has(year)) return cache.get(year);
    const days = new Map(FIXED_DAYS.map(([md, key]) => [`${year}-${md}`, key]));
    cache.set(year, days);
    return days;
  }

  window.HOLIDAYS = window.HOLIDAYS || {};
  window.HOLIDAYS.ru = { label: 'region.ru', holidays };
})();
