/**
 * 서버 쪽 문구. 알림에 쓰입니다.
 *
 * 화면과 똑같은 언어팩(public/i18n/*.js)을 그대로 씁니다 — 표를 두 벌로 두면
 * 반드시 한쪽만 고쳐지는 날이 옵니다. 언어팩은 전역에 자기를 등록하는 스크립트라
 * 불러오기만 하면 됩니다. 여기서 static import로 적어두어야 배포할 때
 * 번들에 같이 실립니다.
 *
 * 새 언어를 넣었다면 이 파일에도 import 한 줄을 더해주세요.
 */
import '../public/i18n/en.js';
import '../public/i18n/ko.js';
import '../public/i18n/ja.js';
import '../public/i18n/zh-CN.js';
import '../public/i18n/es.js';
import '../public/i18n/fr.js';
import '../public/i18n/de.js';
import '../public/i18n/pt-BR.js';
import '../public/i18n/ru.js';

const FALLBACK = 'en';

const packs = () => globalThis.I18N || {};

/** 아는 언어면 그대로, 모르면 영어. */
export function resolveLocale(tag) {
  if (!tag) return FALLBACK;
  const have = Object.keys(packs());
  const want = String(tag).toLowerCase();
  return have.find((n) => n.toLowerCase() === want)
    || have.find((n) => want.split('-')[0] === n.split('-')[0])
    || FALLBACK;
}

/**
 * 문구 하나. 없는 키는 영어로, 영어에도 없으면 키를 그대로 돌려줍니다 —
 * 반쯤 번역된 언어팩이 알림을 빈칸으로 만들지 않게요.
 */
export function t(locale, key, vars) {
  const all = packs();
  const name = resolveLocale(locale);
  const mine = all[name] || {};
  const en = all[FALLBACK] || {};

  /* {count}가 있으면 이 언어의 복수형을 먼저 찾습니다 (화면 쪽 t()와 같은 순서).
     이 언어의 밋밋한 키가 영어 복수형보다 앞섭니다 — 그 순서를 뒤집으면 수를
     영어처럼 세지 않는 언어에 영어 복수형이 새어 들어갑니다. */
  const keys = vars && vars.count != null
    ? [`${key}.${new Intl.PluralRules(name).select(vars.count)}`, key]
    : [key];

  let value = key;
  outer: for (const pack of [mine, en]) {
    for (const k of keys) if (pack[k] != null) { value = pack[k]; break outer; }
  }
  if (!vars) return value;
  return String(value).replace(/\{(\w+)\}/g, (whole, name) => (
    vars[name] != null ? vars[name] : whole
  ));
}
