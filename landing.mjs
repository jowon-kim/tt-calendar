/**
 * Builds the public pages search engines and AI assistants read:
 *
 *   public/<lang>/index.html                 what TT is, in each language
 *   public/<lang>/days-together/index.html   "how long have we been together" calculator
 *   public/<lang>/compare/index.html         TT next to Google Calendar and TimeTree
 *   public/sitemap.xml, public/robots.txt, public/llms.txt
 *
 *   npm run landing           write them
 *   node landing.mjs --check  fail if they are out of date (npm test runs this)
 *
 * The app itself stays at "/"; these pages send people there with ?signup.
 * The words live in landing-content.mjs. When the site moves to its own domain,
 * change SITE below and run it again.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { COMPARE, COMPARE_CHECKED, CONTENT, LANGS } from './landing-content.mjs';

const SITE = 'https://tt-calendar.vercel.app';
const UPDATED = '2026-09-30'; // shown on the pages and in the sitemap — bump when the words change

/* Same names as the language picker in public/i18n/index.js. */
const NAMES = {
  en: 'English', ko: '한국어', ja: '日本語', 'zh-CN': '简体中文', es: 'Español',
  fr: 'Français', de: 'Deutsch', 'pt-BR': 'Português (Brasil)', ru: 'Русский',
};
const OG_LOCALE = {
  en: 'en_US', ko: 'ko_KR', ja: 'ja_JP', 'zh-CN': 'zh_CN', es: 'es_ES',
  fr: 'fr_FR', de: 'de_DE', 'pt-BR': 'pt_BR', ru: 'ru_RU',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PATHS = { home: '', calc: 'days-together/', compare: 'compare/' };
const path = (lang, kind) => `/${lang}/${PATHS[kind]}`;
const json = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

const STYLE = `
:root{--bg:#fbf3f4;--card:#fff;--ink:#40323a;--soft:#6e5b63;--muted:#a08a91;--line:#ead4d6;--accent:#d96570;--accent-2:#f4a0a8;--plum:#a06cb0;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#1d1719;--card:#271f22;--ink:#f3e7ea;--soft:#cdb8be;--muted:#9c878d;--line:#3d2f34;--accent:#f08a94;--accent-2:#f4a0a8;--plum:#c9a2d4;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Hiragino Sans","PingFang SC","Malgun Gothic",sans-serif}
a{color:var(--accent)}
.wrap{max-width:760px;margin:0 auto;padding:24px 16px 56px}
.top{display:flex;align-items:center;gap:10px}
.top img{width:44px;height:44px}
.brand{font-weight:800;font-size:22px;letter-spacing:.02em;text-decoration:none;color:var(--ink)}
.badge{font-size:12px;font-weight:700;color:var(--accent);border:1px solid var(--accent-2);border-radius:999px;padding:2px 10px}
.hero{padding:40px 0 8px}
h1{font-size:clamp(30px,7vw,44px);line-height:1.15;margin:0 0 12px;text-wrap:balance}
.lede{font-size:18px;color:var(--soft);margin:0 0 24px;max-width:60ch}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:16px;box-shadow:0 10px 24px -12px var(--accent)}
.cta:hover{filter:brightness(1.05)}
.note{font-size:14px;color:var(--muted);margin:10px 0 0}
h2{font-size:24px;margin:48px 0 16px}
h3{font-size:17px;margin:0 0 4px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px}
.card p{margin:0;color:var(--soft);font-size:15px}
ol.steps{padding-left:22px;margin:0}
ol.steps li{margin:0 0 8px}
.faq{display:grid;gap:12px}
.faq p{margin:0;color:var(--soft)}
.more{margin:32px 0 0;font-weight:600}
footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);font-size:14px;color:var(--muted);display:grid;gap:10px}
footer nav{display:flex;flex-wrap:wrap;gap:6px 14px}
footer a{color:var(--soft)}
.tool{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;display:grid;gap:14px}
.tool label{font-weight:700}
.tool input{font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--ink);max-width:260px}
dl.result{display:grid;grid-template-columns:1fr auto;gap:8px 16px;margin:0}
dl.result dt{color:var(--soft)}
dl.result dd{margin:0;font-weight:700;text-align:right}
.future{color:var(--accent);margin:0}
.table{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:18px}
.table table{border-collapse:collapse;width:100%;min-width:560px;font-size:15px}
.table th,.table td{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid var(--line)}
.table tr:last-child th,.table tr:last-child td{border-bottom:0}
.table thead th{font-size:14px;color:var(--soft)}
.table tbody th{font-weight:700;width:22%}
.table .us{background:color-mix(in srgb,var(--accent-2) 14%,transparent)}
ul.better{padding-left:22px;margin:0;color:var(--soft)}
ul.better li{margin:0 0 8px}
.fine{font-size:14px;color:var(--muted)}
`;

function head(lang, kind) {
  const c = CONTENT[lang];
  const words = { home: c, calc: c.calc, compare: COMPARE[lang] }[kind];
  const { title, description } = words;
  const url = SITE + path(lang, kind);
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${path(l, kind)}">`).join('\n');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${SITE}${path('en', kind)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TT">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/landing/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${OG_LOCALE[lang]}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FBF3F4">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>${STYLE}</style>`;
}

function top(lang) {
  const c = CONTENT[lang];
  return `<header class="top">
<img src="/landing/mascot.webp" alt="" width="44" height="44">
<a class="brand" href="${path(lang, 'home')}">TT</a>
<span class="badge">${esc(c.badge)}</span>
</header>`;
}

function footer(lang, kind) {
  const c = CONTENT[lang];
  const langs = LANGS.map((l) => (l === lang
    ? `<strong>${NAMES[l]}</strong>`
    : `<a href="${path(l, kind)}" hreflang="${l}" lang="${l}">${NAMES[l]}</a>`)).join('\n');
  return `<footer>
<nav aria-label="${esc(c.langLabel)}">${langs}</nav>
<nav><a href="/?signup">${esc(c.appLink)}</a> <a href="/privacy.html">${esc(c.privacy)}</a></nav>
<p><time datetime="${UPDATED}">${UPDATED}</time></p>
</footer>`;
}

function home(lang) {
  const c = CONTENT[lang];
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'TT',
      url: SITE + '/',
      description: c.description,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web browser (iPhone, Android, computer)',
      inLanguage: LANGS,
      image: `${SITE}/landing/og.png`,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: c.features.map(([h]) => h),
      dateModified: UPDATED,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
  return `${head(lang, 'home')}
<script type="application/ld+json">${json(ld)}</script>
</head>
<body>
<div class="wrap">
${top(lang)}
<main>
<section class="hero">
<h1>${esc(c.heroTitle)}</h1>
<p class="lede">${esc(c.heroSub)}</p>
<a class="cta" href="/?signup">${esc(c.cta)}</a>
<p class="note">${esc(c.ctaNote)}</p>
</section>
<h2>${esc(c.featuresTitle)}</h2>
<div class="grid">
${c.features.map(([h, p]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('\n')}
</div>
<h2>${esc(c.stepsTitle)}</h2>
<ol class="steps">
${c.steps.map((s) => `<li>${esc(s)}</li>`).join('\n')}
</ol>
<h2>${esc(c.faqTitle)}</h2>
<div class="faq">
${c.faq.map(([q, a]) => `<div class="card"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('\n')}
</div>
<p class="more"><a href="${path(lang, 'calc')}">${esc(c.calcLink)} →</a></p>
<p class="more"><a href="${path(lang, 'compare')}">${esc(COMPARE[lang].link)} →</a></p>
</main>
${footer(lang, 'home')}
</div>
</body>
</html>
`;
}

/* Runs in the visitor's browser. Dates are whole days in UTC so daylight saving
   never shifts a count. Anniversaries use Date's own rollover, like the app does. */
const CALC_SCRIPT = `
(function () {
  var L = document.documentElement.lang;
  var T = JSON.parse(document.getElementById('calc-words').textContent);
  var input = document.getElementById('since');
  var out = document.getElementById('result');
  var day = 864e5;
  var fmt = new Intl.DateTimeFormat(L, { dateStyle: 'long', timeZone: 'UTC' });
  var num = function (n) { return n.toLocaleString(L); };
  function today() { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  function row(label, value) { return '<dt>' + label + '</dt><dd>' + value + '</dd>'; }
  function show() {
    var v = input.value;
    if (!v) { out.innerHTML = ''; return; }
    var p = v.split('-').map(Number);
    var start = Date.UTC(p[0], p[1] - 1, p[2]);
    var now = today();
    var diff = Math.round((now - start) / day);
    if (diff < 0) { out.innerHTML = '<p class="future">' + T.future + '</p>'; return; }
    var d0 = new Date(start), d1 = new Date(now);
    var y = d1.getUTCFullYear() - d0.getUTCFullYear();
    var m = d1.getUTCMonth() - d0.getUTCMonth();
    var d = d1.getUTCDate() - d0.getUTCDate();
    if (d < 0) { m -= 1; d += new Date(Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), 0)).getUTCDate(); }
    if (m < 0) { y -= 1; m += 12; }
    var dayNo = diff + 1;
    var next = (Math.floor(dayNo / 100) + 1) * 100;
    var milestone = start + (next - 1) * day;
    var ay = d1.getUTCFullYear();
    var ann = Date.UTC(ay, d0.getUTCMonth(), d0.getUTCDate());
    if (ann < now || ay === d0.getUTCFullYear()) ann = Date.UTC(ay + 1, d0.getUTCMonth(), d0.getUTCDate());
    out.innerHTML = '<dl class="result">'
      + row(T.daysSince, num(diff))
      + row(T.dayNumber, num(dayNo))
      + row(T.breakdown, num(y) + ' · ' + num(m) + ' · ' + num(d))
      + row(T.nextMilestone, T.milestoneValue.replace('{n}', num(next)).replace('{date}', fmt.format(milestone)))
      + row(T.daysLeft, num(Math.round((milestone - now) / day)))
      + row(T.nextAnniversary, fmt.format(ann))
      + row(T.daysLeft, num(Math.round((ann - now) / day)))
      + '</dl>';
  }
  input.max = new Date(today()).toISOString().slice(0, 10);
  input.addEventListener('input', show);
  show();
})();
`;

function calc(lang) {
  const c = CONTENT[lang];
  const k = c.calc;
  const words = {
    future: k.future, daysSince: k.daysSince, dayNumber: k.dayNumber, breakdown: k.breakdown,
    nextMilestone: k.nextMilestone, nextAnniversary: k.nextAnniversary, daysLeft: k.daysLeft,
    milestoneValue: k.milestoneValue,
  };
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: k.h1,
      url: SITE + path(lang, 'calc'),
      description: k.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web browser',
      inLanguage: lang,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isPartOf: { '@type': 'WebSite', name: 'TT', url: SITE + '/' },
      dateModified: UPDATED,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: k.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
  return `${head(lang, 'calc')}
<script type="application/ld+json">${json(ld)}</script>
</head>
<body>
<div class="wrap">
${top(lang)}
<main>
<section class="hero">
<h1>${esc(k.h1)}</h1>
<p class="lede">${esc(k.intro)}</p>
</section>
<div class="tool">
<label for="since">${esc(k.label)}</label>
<input id="since" type="date" min="1900-01-01">
<div id="result" aria-live="polite"></div>
</div>
<h2>${esc(k.howTitle)}</h2>
${k.how.map((p) => `<p>${esc(p)}</p>`).join('\n')}
<h2>${esc(c.faqTitle)}</h2>
<div class="faq">
${k.faq.map(([q, a]) => `<div class="card"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('\n')}
</div>
<p class="more"><a class="cta" href="/?signup">${esc(k.cta)}</a></p>
<p class="more"><a href="${path(lang, 'home')}">TT →</a></p>
</main>
${footer(lang, 'calc')}
</div>
<script type="application/json" id="calc-words">${json(words)}</script>
<script>${CALC_SCRIPT}</script>
</body>
</html>
`;
}

function compare(lang) {
  const c = CONTENT[lang];
  const k = COMPARE[lang];
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: k.h1,
      url: SITE + path(lang, 'compare'),
      description: k.description,
      inLanguage: lang,
      isPartOf: { '@type': 'WebSite', name: 'TT', url: SITE + '/' },
      dateModified: UPDATED,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: k.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
  return `${head(lang, 'compare')}
<script type="application/ld+json">${json(ld)}</script>
</head>
<body>
<div class="wrap">
${top(lang)}
<main>
<section class="hero">
<h1>${esc(k.h1)}</h1>
<p class="lede">${esc(k.intro)}</p>
</section>
<div class="table">
<table>
<thead><tr><td></td>${k.names.map((n, i) => `<th scope="col"${i ? '' : ' class="us"'}>${esc(n)}</th>`).join('')}</tr></thead>
<tbody>
${k.rows.map(([what, ...cells]) => `<tr><th scope="row">${esc(what)}</th>${cells.map((x, i) => `<td${i ? '' : ' class="us"'}>${esc(x)}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>
<p class="fine">${esc(k.checked)} <time datetime="${COMPARE_CHECKED}">${COMPARE_CHECKED}</time>. ${esc(k.fair)}</p>
<h2>${esc(k.betterTitle)}</h2>
<ul class="better">
${k.better.map((b) => `<li>${esc(b)}</li>`).join('\n')}
</ul>
<h2>${esc(c.faqTitle)}</h2>
<div class="faq">
${k.faq.map(([q, a]) => `<div class="card"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('\n')}
</div>
<p class="more"><a class="cta" href="/?signup">${esc(k.cta)}</a></p>
<p class="more"><a href="${path(lang, 'home')}">TT →</a></p>
</main>
${footer(lang, 'compare')}
</div>
</body>
</html>
`;
}

function sitemap() {
  const urls = ['/', ...LANGS.flatMap((l) => [path(l, 'home'), path(l, 'calc'), path(l, 'compare')])];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}
</urlset>
`;
}

const robots = () => `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`;

/* A plain summary for AI assistants (llmstxt.org). */
function llms() {
  const c = CONTENT.en;
  return `# TT

> ${c.description}

TT is a web app (a PWA): it runs in the browser on iPhone, Android and computers and can be added to the home screen. It is in a free beta with no ads and no paid features. Available in ${LANGS.map((l) => NAMES[l]).join(', ')}.

## What it does

${c.features.map(([h, p]) => `- ${h}: ${p}`).join('\n')}

## Questions

${c.faq.map(([q, a]) => `- ${q} ${a}`).join('\n')}

## Pages

- [About TT](${SITE}/en/): what it is and how to start
- [Days-together calculator](${SITE}/en/days-together/): how long a couple has been together, next 100-day milestone and next anniversary
- [TT vs Google Calendar vs TimeTree](${SITE}/en/compare/): how they differ for couples, and when the others fit better
- [Privacy policy](${SITE}/privacy.html)
- [Open the app](${SITE}/?signup)

Last updated ${UPDATED}.
`;
}

const files = { 'public/sitemap.xml': sitemap(), 'public/robots.txt': robots(), 'public/llms.txt': llms() };
for (const lang of LANGS) {
  files[`public/${lang}/index.html`] = home(lang);
  files[`public/${lang}/days-together/index.html`] = calc(lang);
  files[`public/${lang}/compare/index.html`] = compare(lang);
}

if (process.argv.includes('--check')) {
  const stale = Object.entries(files).filter(([file, text]) => {
    try { return readFileSync(file, 'utf8') !== text; } catch { return true; }
  }).map(([file]) => file);
  if (stale.length) {
    console.log(`FAIL  public pages are out of date — run npm run landing:\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`PASS  ${Object.keys(files).length} public pages are up to date`);
} else {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  console.log(`wrote ${Object.keys(files).length} files`);
}
