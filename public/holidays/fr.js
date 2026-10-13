'use strict';

/* Public holidays in metropolitan France (jours fériés, Code du travail L3133-1).
 *
 * Returns a Map of 'YYYY-MM-DD' → i18n key; see holidays/kr.js for the shape.
 * Needs holidays/calc.js.
 *
 * Good Friday and St Stephen's Day, kept only in Alsace and Moselle, and the
 * overseas departments' own days are left out. A holiday on a weekend is not
 * moved.
 */

(() => {
  /* [month-day, i18n key] */
  const FIXED_DAYS = [
    ['01-01', 'holiday.newYear'],
    ['05-01', 'holiday.labour'],
    ['05-08', 'holiday.victoryEurope'],
    ['07-14', 'holiday.bastille'],
    ['08-15', 'holiday.assumption'],
    ['11-01', 'holiday.allSaints'],
    ['11-11', 'holiday.armistice'],
    ['12-25', 'holiday.christmas'],
  ];

  /* [days after Easter Sunday, i18n key] */
  const EASTER_DAYS = [
    [1, 'holiday.easterMonday'],
    [39, 'holiday.ascension'],
    [50, 'holiday.whitMonday'],
  ];

  const cache = new Map();

  /** Every holiday in a year, as a Map of date → i18n key. */
  function holidays(year, helpers) {
    if (cache.has(year)) return cache.get(year);
    const { ymd, addDays } = helpers;
    const sunday = window.HOLIDAY_CALC.easter(year);

    const days = new Map();
    for (const [md, key] of FIXED_DAYS) days.set(`${year}-${md}`, key);
    for (const [offset, key] of EASTER_DAYS) {
      const date = ymd(addDays(sunday, offset));
      if (!days.has(date)) days.set(date, key);
    }

    cache.set(year, days);
    return days;
  }

  window.HOLIDAYS = window.HOLIDAYS || {};
  window.HOLIDAYS.fr = { label: 'region.fr', holidays };
})();
