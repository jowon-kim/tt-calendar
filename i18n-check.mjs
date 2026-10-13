/* Compares every language pack against English and reports what is missing.
 *
 *   npm run i18n
 *
 * English is the reference: a key it does not have is a typo, and a key another
 * pack does not have falls back to English at runtime. Neither is fatal — this
 * prints them so a half-finished translation is visible instead of silent.
 *
 * Plural keys (foo.one / foo.other) only need to match on their base name,
 * because languages disagree about how many forms they need. */

import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'public/i18n';
const REFERENCE = 'en';

/* Each pack registers itself on the global object, so importing it is enough —
   the same thing lib/i18n.js does to build push notifications. */
for (const file of readdirSync(DIR)) {
  if (file === 'index.js' || !file.endsWith('.js')) continue;
  await import(`./${DIR}/${file}`);
}

const packs = globalThis.I18N ?? {};

/* A pack the picker doesn't list can never be chosen. It is an easy step to
   forget, and nothing else complains about it, so check it here. */
const declared = readFileSync(`${DIR}/index.js`, 'utf8')
  .match(/const LOCALE_NAMES\s*=\s*\{([\s\S]*?)\}/);
const listed = new Set(
  [...(declared?.[1] ?? '').matchAll(/['"]?([\w-]+)['"]?\s*:/g)].map((m) => m[1]),
);
if (!declared) console.log('⚠ could not find LOCALE_NAMES in i18n/index.js');
for (const name of Object.keys(packs)) {
  if (!listed.has(name)) {
    console.log(`⚠ ${name}.js loads but is not in LOCALE_NAMES — nobody can pick it`);
  }
}
if (!packs[REFERENCE]) {
  console.error(`✗ ${DIR}/${REFERENCE}.js is missing — there is nothing to compare against`);
  process.exit(1);
}

const base = (key) => key.replace(/\.(zero|one|two|few|many|other)$/, '');
const basesOf = (pack) => new Set(Object.keys(pack).map(base));

const reference = basesOf(packs[REFERENCE]);
let problems = 0;

for (const [name, pack] of Object.entries(packs)) {
  if (name === REFERENCE) continue;
  const mine = basesOf(pack);
  const missing = [...reference].filter((k) => !mine.has(k));
  const extra = [...mine].filter((k) => !reference.has(k));

  const total = reference.size;
  const done = total - missing.length;
  const pct = Math.round((done / total) * 100);
  console.log(`${name}  ${done}/${total} keys (${pct}%)`);

  for (const key of missing) console.log(`  · missing: ${key}   (falls back to English)`);
  for (const key of extra) console.log(`  ✗ not in ${REFERENCE}: ${key}`);
  problems += extra.length;
}

console.log(`${REFERENCE}  ${reference.size} keys (reference)`);
if (problems) {
  console.error(`\n✗ ${problems} key(s) exist only outside ${REFERENCE}.js — fix the name or add it there`);
  process.exit(1);
}
