# Setting it up without writing code

This guide is for someone who has never used a terminal. Everything happens in a
web browser, on a computer. It takes about 15 minutes, and nothing costs money.

Your copy runs on **your own** Vercel and Neon accounts. Your plans, photos and
notes are stored in **your** database — not on a company's server, and not on
mine. Nobody else has the keys.

If you already use a coding agent like Claude Code, the
[README](../README.md#install) has a faster way.

## What you end up with

A private calendar at an address like `https://tt-calendar-abc.vercel.app`.
Each of you signs in with your own Google account, one of you sends the other an
invite link, and from then on you share one calendar — when one of you adds
something, the other's phone buzzes. (Google only checks who you are. Your
calendar never goes to Google.)

This guide sets up **your own copy for the two of you.** Vercel's free plan is
for personal use; if you want to let other couples sign up too, that is a
service and needs Vercel Pro (see [AGENTS.md](../AGENTS.md)).

## What you need

- **A computer with Chrome, Edge or Firefox.** Phones are fine for *using* the
  calendar, but set it up on a computer
- **A GitHub account** — [github.com/signup](https://github.com/signup). This is
  where your copy of the app is kept
- **A Vercel account** — [vercel.com/signup](https://vercel.com/signup). Choose
  **Hobby** and **Continue with GitHub**. This is what runs the app
- **A Google account** — the one you already have. It is used once, to make the
  sign-in button work on your address
- **About 15 minutes**

You do not need a credit card. Both services are free at this size, and if a
limit is ever reached they stop rather than bill you.

---

## 1. Deploy

There is nothing to come up with beforehand. The app makes its own keys and its
own tables the first time it runs.

Click this button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjowon-kim%2Ftt-calendar&project-name=tt-calendar&repository-name=tt-calendar&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

Vercel walks you through a few screens. The labels change now and then, but the
order is:

1. **Your copy on GitHub.** Vercel makes a private copy of the app in your GitHub
   account. Keep the suggested name, or pick your own — it becomes part of your
   address
2. **A database.** Vercel offers to create a **Neon** database. Accept it, pick
   the **free** plan, and choose the region closest to you. This is where your
   events are stored
3. Press **Deploy** and wait a minute for the confetti

When it's done, Vercel shows your address.

> **If Vercel didn't offer a database,** open your project on vercel.com, go to
> the **Storage** tab, choose **Neon** (under Marketplace), create a free
> database and connect it to this project. Then go to **Deployments**, open the
> **⋯** menu on the newest one and choose **Redeploy**. The sign-in screen tells
> you if this is what's missing.

## 2. Turn on Google sign-in

Until you do this, the sign-in screen says *"Google sign-in isn't set up on this
server"*. You are making a "client ID" — a label that tells Google this address
is allowed to show a Google sign-in button.

1. Open [console.cloud.google.com](https://console.cloud.google.com) with your
   Google account and create a **new project** (any name, e.g. "our calendar")
2. **APIs & Services → OAuth consent screen.** User type **External**. Fill in an
   app name and your email; skip the optional fields. Then, under **Audience**
   (or **Test users**), choose **Publish app** — otherwise only the email
   addresses you list there can sign in
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
   Application type **Web application**. Under **Authorized JavaScript origins**
   add your address exactly as Vercel showed it, e.g.
   `https://tt-calendar-abc.vercel.app` (no slash at the end). No redirect URI is
   needed. Press **Create** and copy the **Client ID** (it ends in
   `.apps.googleusercontent.com`)
4. On vercel.com: your project → **Settings** → **Environment Variables** → add
   `GOOGLE_CLIENT_IDS` with that Client ID as the value
5. **Deployments** → **⋯** on the newest one → **Redeploy**

## 3. Sign in and invite

Open your address and tap **Continue with Google** — that's you in.

Then open **Settings**:

- **Invite them** — makes a link. Send it to your partner; when they sign up
  from it (or sign in, if they already have an account) they join your calendar.
  It works once and lasts 7 days
- **The two of you** — put in both names. Your own card is already marked
- **Time zone** — filled in from your browser. Check that it's right; it decides
  when the morning reminder goes out
- **Language**, **Holidays**, **Theme**, **The day you met** — whatever you like.
  There is no save button; it saves as you type

## 4. Turn on notifications — both of you, on each phone

**iPhone:** open the address in **Safari** → tap **Share** → **Add to Home
Screen** → open the app **from that new icon** → Settings → **Phone
notifications** → **Turn on notifications**. (iOS 16.4 or later.) In an ordinary
Safari tab the button does nothing — that's Apple's rule, not a bug.

**Android:** open the address in Chrome → Settings → **Phone notifications** →
**Turn on notifications**. Adding it to the home screen is nice but optional.

To test it: one of you adds an event, the other one's phone should buzz. **You
never get notified about your own changes**, so test it with two phones.

**You're done.** The steps below are optional.

---

## 5. Optional: reminders on the morning of the day

Change notifications work without this. This step adds reminders: a
**"starting soon"** 30–60 minutes before anything with a time, and **one summary
of the day at 8am**. Both of you get these.

The app can't wake itself up on the free plan, so a free outside service knocks
on its door every 30 minutes.

1. **Make a key.** On vercel.com: your project → **Settings** → **Environment
   Variables** → add `CRON_SECRET` with a long random value (30+ letters and
   digits). Then **Deployments** → **⋯** on the newest one → **Redeploy**
2. Sign up at [cron-job.org](https://cron-job.org) (free) and create a new **cron job**
3. **URL** — `https://<your address>/api/cron?key=<the CRON_SECRET value>`. Keep
   it to yourself
4. **Schedule** — choose the custom/advanced option and set:
   - **Minutes:** 0 and 30
   - **Hours:** every hour
   - **Every day, every month**
5. **Time zone** — the same one shown in the app's settings
6. Save. After the next morning, the job's history should show successful runs
   (status 200)

**Don't knock more often than every 30 minutes.** The free database sleeps after
5 idle minutes; knocking every few minutes keeps it awake for good and uses up its
monthly allowance. Every 30 minutes stays well inside it.

---

## When something is off

**"Google sign-in isn't set up on this server"** — `GOOGLE_CLIENT_IDS` is missing,
or you didn't redeploy after adding it. See [step 2](#2-turn-on-google-sign-in).

**Google says the origin isn't allowed, or the button never appears** — the
address under *Authorized JavaScript origins* must match the one in your browser
exactly: `https://`, no slash at the end. Google can take a few minutes to pick
up a change.

**Your partner can't sign in, you can** — the consent screen is still in testing
mode. Publish it (step 2.2), or add their email as a test user.

**"No database is connected yet"** — the Neon step was skipped. See the box at
the end of [step 1](#1-deploy).

**The first load of the day is slow** — normal. The free database naps after five
quiet minutes and takes a second or two to wake.

**The notification button does nothing on iPhone** — you're in a Safari tab.
Open the app from the home-screen icon instead.

**Notifications worked, then stopped** — iPhones sometimes drop them quietly.
Open the app; it usually fixes itself. If not, Settings → turn notifications off
and on again.

**Change notifications arrive, but the morning reminder doesn't** — look at the
job's history on cron-job.org. A 401 means the key in the address doesn't match
`CRON_SECRET`. Also check that the time zone matches the app's.

## Changing a setting later

Environment variables live on vercel.com: your project → **Settings** →
**Environment Variables**. **Changes only take effect after a redeploy** —
**Deployments** → **⋯** on the newest one → **Redeploy**.

## Never do these

- **Don't touch the `app_meta` table** in Neon. It holds the keys the app made
  for itself. Delete them and every phone's notifications die
- **Don't delete tables or run other SQL** in Neon. There is no undo, and the free
  plan can only restore the last six hours
- **Don't raise the database size** in Neon above the smallest setting (0.25). It
  burns through the free allowance faster
- **Don't run the cron job all day** (see step 5)

## Backing up

The app has no download button. The free database plan keeps only a short restore
window, so if you want a copy, take one from the Neon console (or `pg_dump` with
the connection string) now and then.

## Photos, names and other personal touches

Names, greeting, app name, theme, the day you met and calendar photos are all in
**Settings** — no code needed. Changing the pictures (the login image, the icon)
means replacing files in your GitHub copy; the [README](../README.md#making-it-yours)
lists which ones.

## The "Us" tab

The **heart button** at the top opens it: a question of the day, a photo diary,
a bucket list, a money ledger, food and film notes, and a map of your places.
Nothing to set up — it works as soon as you two are in. Location sharing asks
your phone for permission the first time you switch it on, and you only see each
other while **both** of you have it on.

## If you open your copy to other people

For the two of you, nothing else is needed. If other people will sign up on your
address, `public/privacy.html` still names the original author as the operator —
replace the operator name and contact email there with your own (Korean and
English parts). Vercel's free plan is for personal use; a copy for other couples
is a service and needs Vercel Pro (see [AGENTS.md](../AGENTS.md)).
