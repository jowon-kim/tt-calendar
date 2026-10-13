'use strict';

/* National public holidays in Brazil (feriados nacionais).
 *
 * Returns a Map of 'YYYY-MM-DD' → i18n key; see holidays/kr.js for the shape.
 * Needs holidays/calc.js.
 *
 * Carnival and Corpus Christi are optional days off (pontos facultativos), not
 * national holidays, so they are left out along with state and city holidays.
 * A holiday on a weekend is not moved.
 */

(() => {
  /* [month-day, i18n key, first year it applies] */
  const FIXED_DAYS = [
    ['01-01', 'holiday.newYear', 0],
    ['04-21', 'holiday.tiradentes', 0],
    ['05-01', 'holiday.labour', 0],
    ['09-07', 'holiday.brIndependence', 0],
    ['10-12', 'holiday.aparecida', 0],
    ['11-02', 'holiday.allSouls', 0],
    ['11-15', 'holiday.republic', 0],
    ['11-20', 'holiday.blackConsciousness', 2024],   // Lei 14.759/2023
    ['12-25', 'holiday.christmas', 0],
  ];

  const cache = new Map();

  /** Every holiday in a year, as a Map of date → i18n key. */
  function holidays(year, helpers) {
    if (cache.has(year)) return cache.get(year);
    const { ymd, addDays } = helpers;

    const days = new Map();
    for (const [md, key, since] of FIXED_DAYS) if (year >= since) days.set(`${year}-${md}`, key);
    const goodFriday = ymd(addDays(window.HOLIDAY_CALC.easter(year), -2));
    if (!days.has(goodFriday)) days.set(goodFriday, 'holiday.goodFriday');

    cache.set(year, days);
    return days;
  }

  window.HOLIDAYS = window.HOLIDAYS || {};
  window.HOLIDAYS.br = { label: 'region.br', holidays };
})();
