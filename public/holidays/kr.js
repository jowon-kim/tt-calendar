'use strict';

/* South Korean public holidays.
 *
 * A holiday set returns a Map of 'YYYY-MM-DD' → i18n key, so the calendar shows
 * the names in whatever language the app is running in. Add the keys you use to
 * every language pack (public/i18n/*.js).
 *
 * To add your own country: copy this file, keep the shape below, register it on
 * window.HOLIDAYS under a short code, add a <script> for it in index.html, and
 * add a region.<code> key to the language packs. Pull requests welcome —
 * this is the easiest useful thing to contribute.
 *
 * Keep everything inside the (() => { ... })() wrapper. Every holiday set loads
 * into the same page, so two files with a top-level `const cache` would stop
 * the second one from loading at all.
 */

(() => {
  /* Solar holidays sit on fixed dates. Lunar ones (Lunar New Year, Buddha's
     Birthday, Chuseok) cannot be computed, so the Gregorian dates published by
     the Korea Astronomy and Space Science Institute are written out. Years that
     are not in the table get the solar holidays only. */
  const LUNAR_DAYS = {
    //     Lunar New Year  Buddha's Birthday  Chuseok
    2024: ['02-10', '05-15', '09-17'],
    2025: ['01-29', '05-05', '10-06'],
    2026: ['02-17', '05-24', '09-25'],
    2027: ['02-07', '05-13', '09-15'],
    2028: ['01-27', '05-02', '10-03'],
    2029: ['02-13', '05-20', '09-22'],
    2030: ['02-03', '05-09', '09-12'],
    2031: ['01-23', '05-28', '10-01'],
    2032: ['02-11', '05-16', '09-19'],
    2033: ['01-31', '05-06', '09-08'],
    2034: ['02-19', '05-25', '09-27'],
    2035: ['02-08', '05-15', '09-16'],
    2036: ['01-28', '05-03', '10-04'],
  };

  /* [date, i18n key, does a substitute day follow it?]
     Only New Year's Day and Memorial Day never get one (Regulations on Public
     Holidays for Government Offices, article 3). */
  const SOLAR_DAYS = [
    ['01-01', 'holiday.newYear', false],
    ['03-01', 'holiday.independence', true],
    ['05-05', 'holiday.children', true],
    ['06-06', 'holiday.memorial', false],
    ['08-15', 'holiday.liberation', true],
    ['10-03', 'holiday.foundation', true],
    ['10-09', 'holiday.hangul', true],
    ['12-25', 'holiday.christmas', true],
  ];

  const cache = new Map();

  /**
   * Every holiday in a year, as a Map of date → i18n key.
   *
   * Substitute days: the Lunar New Year and Chuseok stretches only earn one when
   * they land on a Sunday, everything else when it lands on a Saturday or Sunday.
   * Two holidays sharing a weekday also earn one. The substitute goes on the
   * first working day after the run.
   *
   * `helpers` carries the app's date utilities ({ ymd, parse, addDays }) so this
   * file stays independent of the rest of the code.
   */
  function holidays(year, helpers) {
    if (cache.has(year)) return cache.get(year);
    const { ymd, parse, addDays } = helpers;

    // sub: 'weekend' = when it falls on Sat or Sun, 'sunday' = Sunday only, null = never
    const base = [];
    for (const [md, key, replaceable] of SOLAR_DAYS) {
      base.push({ date: `${year}-${md}`, key, sub: replaceable ? 'weekend' : null });
    }
    const lunar = LUNAR_DAYS[year];
    if (lunar) {
      const [seol, buddha, chuseok] = lunar;
      base.push({ date: `${year}-${buddha}`, key: 'holiday.buddha', sub: 'weekend' });
      const runs = [
        { md: seol, day: 'holiday.seollal', around: 'holiday.seollalEve' },
        { md: chuseok, day: 'holiday.chuseok', around: 'holiday.chuseokAround' },
      ];
      for (const run of runs) {
        const day = parse(`${year}-${run.md}`);
        base.push({ date: ymd(addDays(day, -1)), key: run.around, sub: 'sunday' });
        base.push({ date: ymd(day), key: run.day, sub: 'sunday' });
        base.push({ date: ymd(addDays(day, 1)), key: run.around, sub: 'sunday' });
      }
    }

    const days = new Map();
    for (const h of base) if (!days.has(h.date)) days.set(h.date, h.key);

    const needs = new Set();
    for (const h of base) {
      if (!h.sub) continue;
      const week = parse(h.date).getDay();
      const weekend = week === 0 || week === 6;
      if (h.sub === 'weekend' ? weekend : week === 0) needs.add(h.date);
      // A weekday that two holidays share (some years Children's Day meets Buddha's Birthday)
      else if (!weekend && base.filter((x) => x.date === h.date).length > 1) needs.add(h.date);
    }
    for (const date of [...needs].sort()) {
      let d = addDays(parse(date), 1);
      while (days.has(ymd(d)) || d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
      days.set(ymd(d), 'holiday.substitute');
    }

    cache.set(year, days);
    return days;
  }

  window.HOLIDAYS = window.HOLIDAYS || {};
  window.HOLIDAYS.kr = { label: 'region.kr', holidays };
})();
