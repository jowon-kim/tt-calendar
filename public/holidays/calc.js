'use strict';

/* Date rules that more than one country needs. Load this before any holiday
 * set that uses it (see index.html).
 *
 * Every function returns a local Date at midnight, the same kind the app's
 * own parse() makes, so the results go straight into the `ymd` helper.
 */

(() => {
  /** Easter Sunday in the Gregorian calendar (anonymous Gregorian algorithm). */
  function easter(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  /**
   * The nth given weekday of a month. month is 1–12, weekday 0 (Sunday) to 6,
   * and n = -1 means the last one.
   */
  function nthWeekday(year, month, weekday, n) {
    if (n < 0) {
      const last = new Date(year, month, 0);
      return new Date(year, month - 1, last.getDate() - ((last.getDay() - weekday + 7) % 7));
    }
    const first = new Date(year, month - 1, 1);
    return new Date(year, month - 1, 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7);
  }

  window.HOLIDAY_CALC = { easter, nthWeekday };
})();
