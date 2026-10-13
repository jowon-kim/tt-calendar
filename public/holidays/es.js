'use strict';

/* National public holidays in Spain (fiestas laborales de ámbito nacional).
 *
 * Returns a Map of 'YYYY-MM-DD' → i18n key; see holidays/kr.js for the shape.
 * Needs holidays/calc.js.
 *
 * Only the days every autonomous community shares. Maundy Thursday, Easter
 * Monday, regional days and the swaps a community makes when a holiday falls
 * on a Sunday are published each year in the BOE and are left out.
 */

(() => {
  /* [month-day, i18n key] */
  const FIXED_DAYS = [
    ['01-01', 'holiday.newYear'],
    ['01-06', 'holiday.epiphany'],
    ['05-01', 'holiday.labour'],
    ['08-15', 'holiday.assumption'],
    ['10-12', 'holiday.hispanidad'],
    ['11-01', 'holiday.allSaints'],
    ['12-06', 'holiday.esConstitution'],
    ['12-08', 'holiday.immaculate'],
    ['12-25', 'holiday.christmas'],
  ];

  const cache = new Map();

  /** Every holiday in a year, as a Map of date → i18n key. */
  function holidays(year, helpers) {
    if (cache.has(year)) return cache.get(year);
    const { ymd, addDays } = helpers;

    const days = new Map();
    for (const [md, key] of FIXED_DAYS) days.set(`${year}-${md}`, key);
    const goodFriday = ymd(addDays(window.HOLIDAY_CALC.easter(year), -2));
    if (!days.has(goodFriday)) days.set(goodFriday, 'holiday.goodFriday');

    cache.set(year, days);
    return days;
  }

  window.HOLIDAYS = window.HOLIDAYS || {};
  window.HOLIDAYS.es = { label: 'region.es', holidays };
})();
