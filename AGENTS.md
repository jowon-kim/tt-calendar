# AGENTS.md

Instructions for an agent meeting this repository for the first time. When the
user says **"how do I use this?"**, follow [First install](#first-install).

## What this is

A calendar two people share, run as **one service for many couples**. Each
person signs in with Google (that is the only way in; a first sign-in creates the
account); one of them sends the other an invite link and from then on they share one calendar. Add an event and it lands
on the other person's lock screen, and it speaks up again on the morning of the
day itself.

- **No build step for the web app.** No bundler, no framework. `public/` is served as-is
- **Three runtime dependencies** — `@neondatabase/serverless`, `web-push`, `@vercel/blob`.
  Android notifications (FCM) and iPhone notifications (APNs) are plain `fetch`
  and Node's own `http2`, not SDKs (`lib/fcm.js`, `lib/apns.js`)
- Vercel serverless functions + Neon Postgres + Vercel Blob for photos
- The **"Us" tab** ("Us" tab at the bottom of the screen; `public/together.js` + one function,
  `api/together.js`): question of the day, poke, photo diary, bucket list, money
  ledger, and a map of places, food and culture with stars (MapLibre + OpenFreeMap, loaded
  only when opened; no key). Location sharing shows only while **both** have it on,
  keeps only the last spot, and is deleted when turned off. The screen is drawn
  phone-width only (`--frame` in `style.css`), on desktop too
- **Each couple names the app and picks its icon** (asked once on first sign-in,
  then Settings → Home-screen icon). `/manifest.json` is served by `api/manifest.js`
  from `public/manifest.default.json` plus their choice — keep the default under
  that other name, or Vercel serves the static file instead of the rewrite. Icon
  pictures (`purpose='icon'`) are the only photos readable without signing in
- Store apps for iOS and Android are thin Capacitor shells around the same site
  (`android/`, `ios/`, see [docs/APPS.md](docs/APPS.md))
- Ships in nine languages (English is the reference pack) and holidays for nine
  countries. Code comments are Korean in the app internals and
  English wherever a contributor arrives (`public/i18n/`, `public/holidays/`,
  setup scripts)

## Ask the user one thing

**A project name** — it becomes the Vercel address. Decide everything else yourself.

Tell them up front: **Vercel's free (Hobby) plan is for personal, non-commercial
use only.** Letting other couples sign up is a service, so production needs
Vercel Pro. A test deployment for yourself is fine on Hobby.

## What the user has to do themselves

- **`vercel login`** — opens a browser. Ask them to sign in
- **A Google client ID** — required: Google is the only way in. In the Google Cloud Console:
  OAuth consent screen (External), then Credentials → Create OAuth client ID →
  **Web application**, with the site address (`https://…vercel.app`) under
  Authorized JavaScript origins. No redirect URI is needed. Without it the sign-in
  screen says Google is not set up and nobody can get in.
  (`PASSWORD_SIGNIN=on` reopens the old username/password API for a deployment
  without Google; the screen has no form for it)
- **Registering the outside clock** — for the reminders on the day
  ([Reminders on the day](#reminders-on-the-day))
- **Store accounts** — only for the phone apps ([docs/APPS.md](docs/APPS.md))

Everything else happens in the terminal.

## First install

```bash
npm install
npx vercel login                      # the user, in a browser
npx vercel link --yes
npx vercel integration add neon       # puts DATABASE_URL on the project
```

Photos go to Vercel Blob. Create a **private** Blob store and connect it to the
project — in the dashboard (Storage → Create → Blob), or check
`npx vercel blob --help`. Connecting it adds `BLOB_READ_WRITE_TOKEN`. Without it the
app still works and keeps photos in the database the old way.

If a command name doesn't match, check `npx vercel --help`. The Vercel CLI changes.

Environment variables (all optional, but a real service wants all of them):

```bash
npx vercel env add GOOGLE_CLIENT_IDS production # the web client ID; app client IDs follow, comma-separated
npx vercel env add DIARY_URL production        # the address people open; push services are told it
npx vercel env add CRON_SECRET production      # a long random string; only the clock should know it
npx vercel env add KAKAO_REST_KEY production   # optional: Kakao REST key for Korean place search; without it map search uses Photon
```

Do **not** set `DATABASE_URL` — the Neon integration provides it. Do not make
the VAPID keys either: the app generates them on its first request and keeps them
in the `app_meta` table (`lib/setup.js`). The same first request runs
`schema.sql`, and runs it again whenever the file changes.

```bash
npx vercel env pull .env.local        # brings those values down locally
npm run verify                        # fix every ✗; read every ⚠
npx vercel deploy --prod
```

`npm run verify` will say the tables are missing on a brand-new database. Either
run `npm run schema` or open the site once after deploying — both create them.

Finish by giving the user **the URL**. The first person signs up there and
invites the second from **Settings → Invite them**.

### If you see `[SENSITIVE]`

Vercel does not hand back a value it stored as a Secret. When `env pull` says

```
! 7 Secret values cannot be pulled from the `production` Environment.
```

`.env.local` holds placeholders, and `npm run verify` prints ⚠ for them. **That
is correct** — it means the value could not be read, not that it is wrong.

### Coming from the single-couple version

The old version had one shared password (`DIARY_PASSWORD`) and one calendar.
That calendar's rows are kept but belong to no account, so nobody sees them —
handing them to whoever signs up first would give them to a stranger if the owner
is not first. `npm run verify` counts them. `DIARY_PASSWORD` can be removed.

## Reminders on the day

Events also announce themselves on the day they happen. Two rules:

- **Has a time** — one "starting soon" reminder, sent by the first knock within the
  hour before it starts. With a knock every 30 minutes that lands **30–60 minutes
  ahead**; if a knock is late, the next one still sends it as long as the event has
  not started. An event just after midnight is announced the night before
- **Every morning at 8** — one summary of the day: all-day events and everything
  from 8am on (earlier ones already had their reminder)

The "Us" tab rides the same knock: at **8pm** whoever has not answered the question
of the day is reminded (nobody, if both answered), and the 8am summary gains a
"one year ago today" line when a diary entry exists for that date (on a day with
no events it goes out alone).

Unlike the change notifications, these go to **both** people. An event spanning
several days is announced on the day it starts, not every day it covers.

"Today" and "8am" are read in **each calendar's own time zone** (stored in its
settings; the app fills it in from the browser the first time). One knock looks
at every calendar, each in its own local time.

### Who knocks

`/api/cron` needs a key — `CRON_SECRET` if set, otherwise the one the app made
(`select value from app_meta where name = 'cron_secret'`). It is **not shown in
the app**: with many couples on one deployment, that key would let anyone ring
every calendar.

- **Vercel Pro** — use Vercel Cron. It sends `Authorization: Bearer $CRON_SECRET`
  by itself. Add to `vercel.json`:
  `"crons": [{ "path": "/api/cron", "schedule": "*/30 * * * *" }]`
  (Hobby rejects anything more often than daily, so only add this on Pro)
- **Otherwise** — an outside service such as [cron-job.org](https://cron-job.org),
  every 30 minutes around the clock, `GET https://<address>/api/cron` with the header
  `Authorization: Bearer <key>` (or `?key=<key>` if it cannot send headers)

Knock at least every 30 minutes — the digest and the reminders are built around
that spacing. Knocking more often is harmless (nothing goes twice) but costs more.

### The clock and the database bill

Neon's compute sleeps after 5 idle minutes. A knock every 30 minutes keeps it
awake about a sixth of the day, roughly 30 CU-hours a month — inside the free
allowance (100) with room for the people using the app. Knocking every 5 minutes
would keep it awake for good (~180 CU-hours) and needs a paid plan.

### Checking it by hand

`?at=` pretends every calendar is at that local time. Real notifications go out.

```bash
curl -H "Authorization: Bearer <key>" "https://<address>/api/cron?at=2026-10-05T08:00"
# {"calendars":12,"sent":["today:2","soon:5b1c…"]}
```

The answer carries counts and event ids, **never titles** — clock services keep
logs, and those would fill up with other couples' plans.

## Once it is running

- **Pushing to the default branch deploys** if the GitHub integration is on.
  Check with `npx vercel ls --prod`
- **Changing an environment variable needs a redeploy.**
  `npx vercel redeploy <production url>` picks up the new ones
- **Always run `vercel` from the project directory.** Run it from a home
  directory and Vercel registers *that* as the project
- **Privacy policy** — `public/privacy.html` is a draft with `[ ]` blanks
  (operator, contact, database region). Fill them in before anyone else signs up

## Never do these

- **Never delete or edit rows in `app_meta`.** Replace `vapid` and every browser
  that had notifications on goes dead; replace `cron_secret` and the clock gets 401
- **Never run `drop table` or `drop column`.** There is no undo
- **Never query a calendar table without `couple_id`.** Every function in
  `lib/store.js` takes the couple first. Miss it once and one couple sees
  another's calendar. `test.mjs` has a two-couple section that knocks on every
  endpoint — extend it for anything new
- **Never trust who-is-who from the request body.** The account decides the seat
  (a/b) — `requireSession` in `lib/http.js`

## How to check your work

| Command | What | If it fails |
|---|---|---|
| `npm test` | handler tests against an in-memory Postgres (accounts, two-couple isolation, photos, web push, FCM and APNs signing, the clock, account deletion), then the i18n runtime, `holidays-test.mjs`, `screen-test.mjs`, which runs `public/app.js` against a stub DOM, and `sw-test.mjs` for the service worker (what it keeps for opening with no signal) | If you changed code, it has to pass |
| `npm run verify` | environment variables, database, tables | Each ✗ prints the fix. Exits 1 |
| `npm run i18n` | how complete each language pack is | A missing key falls back to English rather than breaking |

**Notifications cannot be checked automatically.** Ask the user to try it on
their phone.

## When notifications don't arrive

1. **iPhone, tried from a Safari tab** — web notifications only work from an app
   added to the home screen (iOS 16.4+). Or use the store app
2. **Your own change doesn't notify you** — that's the design
3. **It worked and then went quiet** — a known trait of iOS web push. The app
   re-subscribes on open; if not, toggle notifications off and on in settings
4. **Changes notify fine but the morning reminder never comes** — that is the
   clock. Read its run history, then knock by hand with `?at=`
5. **Store app gets nothing** — the server is missing `FIREBASE_SERVICE_ACCOUNT`
   (Android) or the `APNS_*` values (iPhone). The function log says which

## Changing the code

- **Screen** — `public/app.js` · `index.html` · `style.css`. Served as-is
- **Server** — `api/` holds thin handlers; calendar SQL lives in `lib/store.js`,
  account SQL in `lib/accounts.js`
- **Wording** — never write a user-visible string inline. Add a key to
  `public/i18n/en.js` (and the other packs), then use `t('key')` on the screen or
  `t(locale, 'key')` on the server. `npm run i18n` catches a pack that fell behind
- **Shared limits** (photos per calendar, photo size, diary photos) — `public/limits.js`, read by both sides
- **"Us" tab** — screen `public/together.js` (strings `together.*`), server
  `api/together.js` (`?` actions in one function — Vercel Hobby allows 12), questions
  in `lib/questions.js` (same 30 slots in every language)
- Run `npm test` after any change

## Customizations users ask for

**No code needed** — app name, greeting, both names, the day they met, language,
holidays, theme, calendar photos. All of it is in the app's **settings** screen.

**Swap a file**

| File | Where it shows up |
|---|---|
| `public/mascot.png` | the big image on the login screen |
| `public/favicon.png` | browser tab and notification icon |
| `public/badge.png` | the status-bar icon on Android |

`badge.png`: **Android uses only the alpha channel.** Export at 96px, white on transparent.

**Needs a code change**

- **A new theme** — copy a `[data-theme="..."]` block in `style.css`, change the
  values, add the id to `THEMES` in `app.js`, and add a `theme.<id>` key to the
  language packs
- **A new language** — copy `public/i18n/en.js`, translate the values, add a
  `<script>` in `index.html`, add the tag to `LOCALE_NAMES` in `i18n/index.js`,
  and add an import in `lib/i18n.js` so notifications get it too
- **Holidays for another country** — copy `public/holidays/kr.js`, keep the
  shape, register it under a short code, load it in `index.html`, and add
  `region.<code>` plus the holiday names to the language packs
