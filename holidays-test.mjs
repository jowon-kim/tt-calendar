/**
 * Tests for the holiday sets (public/holidays/).
 *
 *   npm test
 *
 * The expected dates come from outside this repository: the Japanese Cabinet
 * Office's holiday list, the Hong Kong Observatory's lunar calendar tables,
 * and the published federal calendars. Each set is checked on the days its own
 * rules are most likely to get wrong — substitutes, observed days, Easter, and
 * lunar dates that differ between Seoul and Beijing.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

globalThis.window = globalThis;

/* Every set loads into one page, so load them the way index.html does — that
   also catches two files that declare the same top-level name. */
const scripts = [...readFileSync('public/index.html', 'utf8').matchAll(/<script src="\/(holidays\/[^"]+)"><\/script>/g)]
  .map((m) => m[1]);
for (const file of scripts) {
  vm.runInThisContext(readFileSync(`public/${file}`, 'utf8'), { filename: file });
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const helpers = { ymd, parse, addDays };

const on = (code, date) => window.HOLIDAYS[code].holidays(Number(date.slice(0, 4)), helpers).get(date);
const count = (code, year) => window.HOLIDAYS[code].holidays(year, helpers).size;

let passed = 0;
let failed = 0;
const ok = (what, cond, saw) => {
  if (cond) { passed++; console.log(`PASS  ${what}`); }
  else { failed++; console.log(`FAIL  ${what}  ${JSON.stringify(saw)}`); }
};
const is = (code, date, key) => ok(`${code} ${date} is ${key}`, on(code, date) === key, on(code, date));
const isNot = (code, date) => ok(`${code} ${date} is not a holiday`, on(code, date) === undefined, on(code, date));

ok('every holiday set in index.html registers itself',
  ['none', 'kr', 'jp', 'cn', 'us', 'de', 'fr', 'es', 'br', 'ru'].every((c) => window.HOLIDAYS[c]),
  Object.keys(window.HOLIDAYS));
ok('the shared rules stay out of the global scope', typeof globalThis.easter === 'undefined', typeof globalThis.easter);

/* South Korea — unchanged by the wrapper */
is('kr', '2026-02-17', 'holiday.seollal');
is('kr', '2025-03-03', 'holiday.substitute');

/* Japan — Cabinet Office list */
is('jp', '2026-01-12', 'holiday.comingOfAge');
is('jp', '2026-03-20', 'holiday.vernalEquinox');
is('jp', '2026-05-06', 'holiday.substitute');       // Constitution Day fell on a Sunday
is('jp', '2026-09-22', 'holiday.citizens');         // between Respect for the Aged and the equinox
is('jp', '2026-09-23', 'holiday.autumnEquinox');
is('jp', '2025-02-24', 'holiday.substitute');       // the Emperor's Birthday on a Sunday
is('jp', '2027-03-21', 'holiday.vernalEquinox');
isNot('jp', '2025-09-22');
ok('jp 2026 has 18 days off', count('jp', 2026) === 18, count('jp', 2026));

/* China — lunar dates are Beijing's, not Seoul's */
is('cn', '2027-02-06', 'holiday.springFestival');   // Seoul's Seollal is a day later
is('kr', '2027-02-07', 'holiday.seollal');
is('cn', '2028-05-28', 'holiday.dragonBoat');       // not the leap month's day
is('cn', '2026-02-16', 'holiday.springFestivalEve');
is('cn', '2025-05-02', 'holiday.labour');
isNot('cn', '2024-05-02');                          // Labour Day was one day before 2025
isNot('cn', '2024-02-09');                          // and New Year's Eve was not statutory
is('cn', '2031-10-01', 'holiday.cnNational');       // Mid-Autumn shares the day

/* United States — observed days */
is('us', '2026-07-03', 'holiday.substitute');       // 4 July on a Saturday
is('us', '2027-12-24', 'holiday.substitute');       // Christmas on a Saturday
is('us', '2027-12-31', 'holiday.substitute');       // New Year's Day 2028 on a Saturday
is('us', '2026-11-26', 'holiday.thanksgiving');
is('us', '2027-05-31', 'holiday.usMemorial');       // the last Monday, in a five-Monday May
ok('us 2026 has 12 days off', count('us', 2026) === 12, count('us', 2026));

/* Easter-based days */
is('de', '2026-04-03', 'holiday.goodFriday');
is('de', '2026-05-14', 'holiday.ascension');
is('de', '2026-05-25', 'holiday.whitMonday');
is('fr', '2025-04-21', 'holiday.easterMonday');
isNot('fr', '2025-04-18');                          // Good Friday only in Alsace-Moselle
is('es', '2027-03-26', 'holiday.goodFriday');
is('br', '2024-03-29', 'holiday.goodFriday');
is('br', '2024-11-20', 'holiday.blackConsciousness');
isNot('br', '2023-11-20');                          // national only from 2024

/* Russia — statutory days only */
is('ru', '2026-01-07', 'holiday.orthodoxChristmas');
is('ru', '2026-11-04', 'holiday.ruUnity');
isNot('ru', '2025-02-24');                          // the decree moved it to 8 May instead

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
