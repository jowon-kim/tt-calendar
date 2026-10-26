# Reddit 초안

## 0. 모드에게 먼저 (r/LongDistance) — Message the mods

규칙이 홍보를 금지하거나 애매하면 이것부터 보내고, 허락을 받은 뒤에만 1번을 올립니다.

> **Subject:** Okay to share a free calendar app I made?
>
> Hi mods — I made a free shared calendar for couples and I'd like to share it once in r/LongDistance, with a clear
> "I built this" note. It's in a free beta: no ads, no paid features, no sign-up wall beyond Google sign-in.
> If that isn't allowed, or there's a weekly thread for it, I'm happy to follow that instead. Thanks either way.

## 1. r/LongDistance

**Title:** I made a free shared calendar for couples — your partner gets a notification when you add a plan

> [사장님 이야기 한 줄 — 왜 만들었는지. 지어내지 말고 실제 그대로, 없으면 이 줄 삭제]
>
> Disclosing up front: this is my own project, now open as a free beta.
>
> **What it is:** one calendar for two people. When one of you adds, edits or deletes a plan, the other person's phone
> gets a notification (your own changes don't ping you). Plans with a time get a "starting soon" reminder 30–60
> minutes before, and there's one summary of the day at 8am.
>
> Also in it:
> - Each plan is mine, yours or ours, in its own colour
> - Enter the day you met and every 100 days and anniversary shows up, with a countdown
> - Up to 30 photos that turn up on empty days
>
> **Honest limits for long distance:** a calendar has *one* time zone (set in settings), so if you're in different zones,
> times and the 8am summary follow that one zone, not each of you. Tell me if that's a dealbreaker — it's the thing I'd
> most like feedback on.
>
> It runs in the browser (no app store). On iPhone, notifications only work after Share → Add to Home Screen (iOS 16.4+).
> Sign-in is Google only; your partner joins with an invite link that works once and lasts 7 days.
> Free during beta, no ads.
>
> https://tt-calendar.vercel.app/en/
>
> Happy to answer anything, and to hear what's missing for LDR couples.

## 2. r/SideProject (만든 사람 대상 — 기술 이야기 위주)

**Title:** TT: a shared calendar for couples in plain JS — no framework, no build step, 3 runtime dependencies

> I built a shared calendar for couples and run it as one multi-tenant service. Some choices that might be interesting here:
>
> - **No framework, no build step.** One HTML file, one script, one stylesheet, served as-is from Vercel.
>   The Android/iOS store apps are thin Capacitor shells that load the same files
> - **3 runtime dependencies** (Neon serverless driver, web-push, Vercel Blob). FCM and APNs are a signed JWT plus
>   `fetch` / Node's `http2`; Google sign-in checks the ID token against Google's keys with `crypto`
> - **Tests against real Postgres in memory** (PGlite), ~590 of them, including a two-couple test that hits every
>   endpoint to make sure one couple can't see another's calendar
> - **Fits the free tiers:** an outside cron knocks every 30 minutes so the database sleeps in between;
>   nightly encrypted backups via GitHub Actions
> - Nine languages, with i18n that's just a plain object per language
>
> Live (free beta): https://tt-calendar.vercel.app/en/
>
> Feedback on the onboarding (Google sign-in → invite link → add to home screen) is what I need most.

게시 전 확인:
- 각 서브레딧 사이드바 규칙. r/SideProject는 자기 프로젝트 소개용이지만, 링크만 던지는 글은 지워질 수 있으니 본문을 꼭 붙입니다
- 같은 글을 여러 서브레딧에 한꺼번에 올리지 않습니다(스팸 필터). 하루 이상 간격
- 올린 뒤 첫 몇 시간은 댓글에 답하기
