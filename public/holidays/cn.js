'use strict';

/* Public holidays in mainland China (全国年节及纪念日放假办法).
 *
 * Returns a Map of 'YYYY-MM-DD' → i18n key; see holidays/kr.js for the shape.
 *
 * Only the statutory days are marked. Each year the State Council also
 * publishes a schedule that stretches them into longer breaks by swapping
 * weekends for working days (调休). That schedule cannot be computed, so it is
 * not reproduced here.
 */

(() => {
  /* Lunar festivals and Qingming cannot be computed simply, so the dates from the
     Hong Kong Observatory's Gregorian–Lunar conversion tables are written out.
     Years that are not in the table get the fixed-date holidays only. */
  const LUNAR_DAYS = {
    //    Spring Festival  Qingming  Dragon Boat  Mid-Autumn
    2024: ['02-10', '04-04', '06-10', '09-17'],
    2025: ['01-29', '04-04', '05-31', '10-06'],
    2026: ['02-17', '04-05', '06-19', '09-25'],
    2027: ['02-06', '04-05', '06-09', '09-15'],
    2028: ['01-26', '04-04', '05-28', '10-03'],
    2029: ['02-13', '04-04', '06-16', '09-22'],
    2030: ['02-03', '04-05', '06-05', '09-12'],
    2031: ['01-23', '04-05', '06-24', '10-01'],
    2032: ['02-11', '04-04', '06-12', '09-19'],
    2033: ['01-31', '04-04', '06-01', '09-08'],
    2034: ['02-19', '04-05', '06-20', '09-27'],
    2035: ['02-08', '04-05', '06-10', '09-16'],
    2036: ['01-28', '04-04', '05-30', '10-04'],
  };

  const cache = new Map();

  /**
   * Every holiday in a year, as a Map of date → i18n key.
   *
   * From 2025 the Spring Festival starts on New Year's Eve and Labour Day is two
   * days long. When two holidays share a date, the first one written wins.
   */
  function holidays(year, helpers) {
    if (cache.has(year)) return cache.get(year);
    const { ymd, parse, addDays } = helpers;

    const days = new Map();
    const add = (date, key) => { if (!days.has(date)) days.set(date, key); };

    add(`${year}-01-01`, 'holiday.newYear');
    add(`${year}-05-01`, 'holiday.labour');
    if (year >= 2025) add(`${year}-05-02`, 'holiday.labour');
    for (const d of ['01', '02', '03']) add(`${year}-10-${d}`, 'holiday.cnNational');

    const lunar = LUNAR_DAYS[year];
    if (lunar) {
      const [spring, qingming, dragonBoat, midAutumn] = lunar;
      const first = parse(`${year}-${spring}`);
      if (year >= 2025) add(ymd(addDays(first, -1)), 'holiday.springFestivalEve');
      for (let i = 0; i < 3; i++) add(ymd(addDays(first, i)), 'holiday.springFestival');
      add(`${year}-${qingming}`, 'holiday.qingming');
      add(`${year}-${dragonBoat}`, 'holiday.dragonBoat');
      add(`${year}-${midAutumn}`, 'holiday.midAutumn');
    }

    cache.set(year, days);
    return days;
  }

  window.HOLIDAYS = window.HOLIDAYS || {};
  window.HOLIDAYS.cn = { label: 'region.cn', holidays };
})();
