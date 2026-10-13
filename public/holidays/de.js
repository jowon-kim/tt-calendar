'use strict';

/* Public holidays observed across all of Germany (bundeseinheitliche Feiertage).
 *
 * Returns a Map of 'YYYY-MM-DD' → i18n key; see holidays/kr.js for the shape.
 * Needs holidays/calc.js.
 *
 * Holidays that only some states keep — Epiphany, Corpus Christi, Reformation
 * Day and the rest — are left out. A holiday on a weekend is not moved.
 */

(() => {
  /* [month-day, i18n key] */
  const FIXED_DAYS = [
    ['01-01', 'holiday.newYear'],
    ['05-01', 'holiday.labour'],
    ['10-03', 'holiday.germanUnity'],
    ['12-25', 'holiday.christmas'],
    ['12-26', 'holiday.christmas2'],
  ];

  /* [days after Easter Sunday, i18n key] */
  const EASTER_DAYS = [
    [-2, 'holiday.goodFriday'],
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
  window.HOLIDAYS.de = { label: 'region.de', holidays };
})();
