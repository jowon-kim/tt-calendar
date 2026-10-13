# Setting it up without writing code

This guide is for someone who has never used a terminal. Everything happens in a
web browser, on a computer. It takes about 5 minutes, and nothing costs money.

If you already use a coding agent like Claude Code, the
[README](../README.md#install) has a faster way.

## What you end up with

A private calendar at an address like `https://couple-diary-abc.vercel.app`.
Each of you signs up with your own username and password (or Google), one of you sends the
other an invite link, and from then on you share one calendar — when one of you
adds something, the other's phone buzzes.

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
- **About 5 minutes**

You do not need a credit card. Both services are free at this size, and if a
limit is ever reached they stop rather than bill you.

---

## 1. Deploy

There is nothing to come up with beforehand. The app makes its own keys and its
own tables the first time it runs.

Click this button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjowon-kim%2Fcouple-diary&project-name=couple-diary&repository-name=couple-diary&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

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

## 2. Sign up and invite

Open your address and tap **New here? Create an account**. A username (3–20
lowercase letters, numbers, `. _ -`) and a password of 8 characters or more —
that's you in. If you added a Google client ID, **Continue with Google** works too.

Then open **Settings**:

- **Invite them** — makes a link. Send it to your partner; when they sign up
  from it (or sign in, if they already have an account) they join your calendar.
  It works once and lasts 7 days
- **The two of you** — put in both names. Your own card is already marked
- **Time zone** — filled in from your browser. Check that it's right; it decides
  when the morning reminder goes out
- **Language**, **Holidays**, **Theme**, **The day you met** — whatever you like.
  There is no save button; it saves as you type

## 3. Turn on notifications — both of you, on each phone

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

## 4. Optional: reminders on the morning of the day

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

**"The username or password doesn't match"** — check capital letters and spaces in
the password. Ten wrong tries lock that username for 15 minutes.

**Forgot the password** — there is no reset: the app never asks for an email, so
it has nowhere to send one. Keep your password somewhere safe, or sign in with Google.

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
- **Don't run the cron job all day** (see step 4)

## Backing up

The app has no download button. The free database plan keeps only a short restore
window, so if you want a copy, take one from the Neon console (or `pg_dump` with
the connection string) now and then.

## Photos, names and other personal touches

Names, greeting, app name, theme, the day you met and calendar photos are all in
**Settings** — no code needed. Changing the pictures (the login image, the icon)
means replacing files in your GitHub copy; the [README](../README.md#making-it-yours)
lists which ones.
