/**
 * Tests for the i18n runtime (public/i18n/index.js).
 *
 *   npm test
 *
 * This is screen code, so it wants a browser. It needs so little of one — a few
 * elements and a language tag — that stubbing it here beats pulling in a
 * headless browser to run twenty assertions.
 *
 * The thing most worth guarding is the lookup order: this language's plain key
 * has to beat English's plural form, or English plurals leak into languages
 * that don't count the way English does.
 */
import { readFileSync } from 'node:fs';

const els = [];
const make = (dataset) => ({
  dataset, textContent: '', innerHTML: '', attrs: {},
  setAttribute(name, value) { this.attrs[name] = value; },
});

const doc = {
  documentElement: { lang: '', dataset: {} },
  querySelectorAll(selector) {
    if (selector === '[data-i18n]') return els.filter((e) => e.dataset.i18n);
    if (selector === '[data-i18n-html]') return els.filter((e) => e.dataset.i18nHtml);
    if (selector === '[data-i18n-attr]') return els.filter((e) => e.dataset.i18nAttr);
    return [];
  },
};

globalThis.document = doc;
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = globalThis;
// Node 24 ships its own navigator, and it is read-only.
Object.defineProperty(globalThis, 'navigator', {
  value: { languages: ['ko-KR', 'ko'], language: 'ko-KR' }, configurable: true,
});

await import('./public/i18n/en.js');
await import('./public/i18n/ko.js');
new Function(readFileSync('public/i18n/index.js', 'utf8'))();

const { t, setLocale, applyI18n, locales, preferred, dateFmt, LOCALE_NAMES } = globalThis.i18n;

let passed = 0;
let failed = 0;
const ok = (what, cond, saw) => {
  if (cond) { passed++; console.log(`PASS  ${what}`); }
  else { failed++; console.log(`FAIL  ${what}  ${JSON.stringify(saw)}`); }
};

/* 어떤 언어팩이 실려 있나 */
ok('both packs load', locales().join(',') === 'en,ko', locales());
ok('the browser language is honoured', preferred() === 'ko', preferred());

/* 영어 */
setLocale('en');
ok('english reads from its own pack', t('common.cancel') === 'Cancel', t('common.cancel'));
ok('a single thing takes the singular', t('day.daysLeft', { n: 1, count: 1 }) === '1 day to go', t('day.daysLeft', { n: 1, count: 1 }));
ok('several take the plural', t('day.daysLeft', { n: 5, count: 5 }) === '5 days to go', t('day.daysLeft', { n: 5, count: 5 }));
ok('{name} is filled in', t('guide.titleFor', { name: 'Nabi' }) === 'How Nabi works', t('guide.titleFor', { name: 'Nabi' }));
ok('an unknown key comes back as itself', t('nope.nope') === 'nope.nope', t('nope.nope'));
ok('markup inside a value survives', t('settings.autosave').includes('<b>'), t('settings.autosave'));

/* 한국어 — 복수형이 없는 언어 */
setLocale('ko');
ok('korean reads from its own pack', t('common.cancel') === '취소', t('common.cancel'));
ok('a language without plurals keeps its own wording',
  t('day.daysLeft', { n: 5, count: 5 }) === '5일 남았어요', t('day.daysLeft', { n: 5, count: 5 }));
ok('the lang attribute follows', doc.documentElement.lang === 'ko', doc.documentElement.lang);
ok('a key the server sent gets translated too',
  t('error.wrongLogin') === '아이디나 비밀번호가 맞지 않아요', t('error.wrongLogin'));

/* 날짜는 Intl이 언어를 따라갑니다 — 언어팩에 적을 게 없습니다 */
const may = new Date(2025, 4, 18);
setLocale('en');
const inEnglish = dateFmt({ year: 'numeric', month: 'long', day: 'numeric' }).format(may);
setLocale('ko');
const inKorean = dateFmt({ year: 'numeric', month: 'long', day: 'numeric' }).format(may);
ok('dates follow the language without being written down',
  inEnglish.includes('May') && inKorean.includes('5월'), { inEnglish, inKorean });

/* data-i18n 속성 */
els.push(
  make({ i18n: 'common.save' }),
  make({ i18nHtml: 'settings.autosave' }),
  make({ i18nAttr: 'aria-label:common.close' }),
);
setLocale('en');
applyI18n();
ok('data-i18n fills the text', els[0].textContent === 'Save', els[0].textContent);
ok('data-i18n-html fills the markup', els[1].innerHTML.includes('<b>'), els[1].innerHTML);
ok('data-i18n-attr sets the attribute', els[2].attrs['aria-label'] === 'Close', els[2].attrs);

/* 반쯤 옮긴 언어팩도 화면을 비우지 않습니다 */
globalThis.I18N.xx = { 'common.cancel': 'Annuler' };
LOCALE_NAMES.xx = 'Test';                     // 등록해야 고를 수 있습니다
setLocale('xx');
ok('a partial pack uses what it has', t('common.cancel') === 'Annuler', t('common.cancel'));
ok('and falls back to english for the rest', t('common.save') === 'Save', t('common.save'));

/* 등록하지 않은 언어는 없는 것으로 봅니다 */
globalThis.I18N.zz = { 'common.cancel': 'Nope' };
setLocale('zz');
ok('a pack missing from LOCALE_NAMES is ignored', t('common.cancel') === 'Cancel', t('common.cancel'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
