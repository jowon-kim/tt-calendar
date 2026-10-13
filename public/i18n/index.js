'use strict';

/* Minimal i18n. No library, no build step.
 *
 * Markup opts in with attributes:
 *   data-i18n="key"                    replaces textContent
 *   data-i18n-html="key"               replaces innerHTML (values may contain <b>)
 *   data-i18n-attr="placeholder:key"   sets attributes; separate pairs with ";"
 *
 * Strings live in i18n/<locale>.js and register themselves on globalThis.I18N.
 * Values interpolate {name} from the second argument of t().
 *
 * Plurals: give a key the suffixes ".one" / ".other" (whatever categories the
 * language uses) and pass {count}. Languages without plurals just use ".other".
 *
 * To add a language: copy en.js, translate the values, add a <script> for it in
 * index.html, and add it to LOCALE_NAMES below.
 */

/* Languages offered in settings. Key is the BCP 47 tag, value is the name of
   the language written in that language — never translate these. */
const LOCALE_NAMES = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  'zh-CN': '简体中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  'pt-BR': 'Português (Brasil)',
  ru: 'Русский',
};

const FALLBACK = 'en';

let locale = FALLBACK;
let strings = {};
let plural = new Intl.PluralRules(FALLBACK);

/** Every locale that actually loaded, in the order LOCALE_NAMES lists them. */
function locales() {
  return Object.keys(LOCALE_NAMES).filter((name) => globalThis.I18N && globalThis.I18N[name]);
}

/** The best match for a BCP 47 tag: exact, then the base language, then null. */
function resolve(tag) {
  if (!tag) return null;
  const have = locales();
  const want = String(tag).toLowerCase();
  return have.find((n) => n.toLowerCase() === want)
    || have.find((n) => want.split('-')[0] === n.split('-')[0])
    || null;
}

/** What to show before the server tells us: the last choice, then the browser. */
function preferred() {
  let saved = null;
  try { saved = localStorage.getItem('diary_locale'); } catch { /* private mode */ }
  return resolve(saved)
    || (navigator.languages || [navigator.language]).map(resolve).find(Boolean)
    || FALLBACK;
}

/**
 * Look a key up, most wanted first, and return null when nothing has it.
 *
 * This language always wins over English — including its plain key over an
 * English plural form. Get that order wrong and English plurals leak into
 * languages that don't count things the way English does.
 */
function lookup(keys) {
  const en = (globalThis.I18N && globalThis.I18N[FALLBACK]) || {};
  for (const pack of [strings, en]) {
    for (const key of keys) if (pack[key] != null) return pack[key];
  }
  return null;
}

function t(key, vars) {
  /* With a {count}: this language's plural form, then its plain key. A language
     that needs only one form writes the plain key and still reads right. */
  const keys = vars && vars.count != null
    ? [key + '.' + plural.select(vars.count), key]
    : [key];
  const value = lookup(keys) ?? key;   // 아무 데도 없으면 키 그대로 — 빈칸보다 낫습니다
  if (!vars) return value;
  return String(value).replace(/\{(\w+)\}/g, (whole, name) => (
    vars[name] != null ? vars[name] : whole
  ));
}

/** Rewrite every data-i18n* attribute under root. Safe to call repeatedly. */
function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

/** Switch language and repaint. Returns the locale that actually took effect. */
function setLocale(tag, options) {
  const name = resolve(tag) || FALLBACK;
  locale = name;
  strings = (globalThis.I18N && globalThis.I18N[name]) || {};
  plural = new Intl.PluralRules(name);
  document.documentElement.lang = name;
  if (!options || options.remember !== false) {
    try { localStorage.setItem('diary_locale', name); } catch { /* private mode */ }
  }
  applyI18n();
  return name;
}

const getLocale = () => locale;

/* Dates go through Intl so a new language pack gets formatting for free. */
const dateFmt = (opts) => new Intl.DateTimeFormat(locale, opts);

window.i18n = { t, applyI18n, setLocale, getLocale, locales, preferred, dateFmt, LOCALE_NAMES };
window.t = t;
