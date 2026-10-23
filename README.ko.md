# TT

[English](README.md) · **한국어**

둘이 같이 쓰는 캘린더를, 여러 커플이 쓰는 서비스로. 각자 가입하고 한 명이 상대를
초대하면 그때부터 달력 하나를 같이 씁니다. 한쪽이 일정을 넣으면 **상대 폰 잠금화면에
알림이 뜨고,** 일정 당일 아침에도 한 번 더 알려줍니다. 카톡도 다른 앱도 거치지 않고
이 앱이 직접 보냅니다 — 브라우저로도, iOS·안드로이드 앱으로도.

| | |
|---|---|
| **한 줄** | 커플이 같이 쓰는 캘린더를 여러 커플이 가입하는 서비스로 — 프레임워크·빌드 없는 순수 자바스크립트 |
| **링크** | [tt-calendar.vercel.app](https://tt-calendar.vercel.app) · [소개](https://tt-calendar.vercel.app/ko/) · [사귄 지 며칠 계산기](https://tt-calendar.vercel.app/ko/days-together/) — 무료 베타 |
| **데모** | ![Mina가 넣은 일정이 Leo 폰에 바로 보임](docs/demo/demo.gif) · [mp4](docs/demo/demo.mp4) — 25초, 실서비스의 데모 커플 |
| **상태** | 웹(PWA)으로 운영 중. 스토어 앱은 CI에서 빌드되고, Play 조직 계정용 D-U-N-S 번호를 기다리는 중 |
| **기술** | 순수 JS · Vercel 서버리스(함수 12개 이하, 테스트로 지킴) · Neon Postgres · Vercel Blob · 웹 푸시 / FCM / APNs · Capacitor |
| **테스트** | 540개, `npm test` (메모리 Postgres에 대고 도는 실제 핸들러, 화면, 다국어, 공휴일, 서비스 워커, 공개 페이지) |
| **비용** | 월 0원 (무료 플랜) |
| **구조도** | [어떻게 돌아가나](#어떻게-돌아가나) |

<p>
<img src="public/screenshots/01-calendar.webp" width="200" alt="다가오는 일 목록이 있는 둘의 달력">
<img src="public/screenshots/02-day.webp" width="200" alt="하루 일정">
<img src="public/screenshots/03-editor.webp" width="200" alt="일정 넣기: 누구 일정, 시간, 반복">
<img src="public/screenshots/05-settings.webp" width="200" alt="설정">
</p>

- **빌드가 없습니다.** 번들러도 프레임워크도 없어요. `public/`이 그대로 서빙됩니다
- **런타임 의존성 세 개** — `@neondatabase/serverless`, `web-push`, `@vercel/blob`.
  안드로이드(FCM)·아이폰(APNs) 알림은 SDK 없이 fetch와 Node 내장 http2로 보냅니다
- **계정과 커플별 달력** — 구글 하나로(ID 토큰을 구글 공개키로 직접 확인, 비밀번호 없음), 초대 링크, 탈퇴.
  모든 쿼리가 커플로 걸러지고, 두 커플 테스트가 모든 창구를 두드려 새는지 봅니다
- **스토어 앱** — Capacitor로 감싼 얇은 껍데기(`android/`, `ios/`)에 OS 알림. Mac 없이 CI에서
  빌드합니다 ([docs/APPS.md](docs/APPS.md))
- **일정 알림** — 시간이 있는 일정은 30분~1시간 전에, 아침 8시엔 오늘 일정 모아서 한 번. 쓰는 곳의 시간대로
- 홈 화면에 추가하면 앱처럼 열립니다 (PWA). 크롬·엣지는 설치 버튼, 아이폰은 "공유 → 홈 화면에 추가" 안내
- **검색엔진·AI가 읽는 공개 페이지** — 소개 페이지와 "사귄 지 며칠" 계산기를 9개 언어로. `landing.mjs`가
  FAQ 구조화 데이터·hreflang·sitemap·`llms.txt`까지 만듭니다

`api/`·`lib/`·`public/`에 약 12,500줄(언어팩 9개 포함). 실제 핸들러를 메모리 Postgres에 붙여 돌리는
통합 테스트 344개, 화면을 직접 돌리는 테스트 122개, 언어·공휴일 테스트 58개.

## 어떻게 돌아가나

```mermaid
flowchart LR
  U[브라우저 / PWA] --> V[Vercel: public/ 그대로 + api/ 서버리스]
  A[스토어 앱 · Capacitor] -->|같은 사이트를 불러옴| V
  V --> N[(Neon Postgres)]
  V --> B[(Vercel Blob · 사진)]
  C[cron-job.org · 30분마다] --> V
  V --> P[웹 푸시 · FCM · APNs]
  G[GitHub Actions] -->|테스트 · 매일 암호화 백업 · 앱 빌드| V
```

- 배포 하나로 모든 커플을 받습니다. 요청마다 로그인한 커플로 걸러지고, 미리보기 배포는 DB 복사본을 따로 씁니다
- 알림 규칙은 시각만 받는 순수 함수(`lib/remind.js`)라 테스트에서 아무 시각이나 넣어봅니다. 바깥 cron이
  30분마다 두드려서, 그 사이에 DB가 잠들고 무료 한도 안에 머뭅니다

## 깔기

### 터미널을 써본 적이 없다면

[**단계별 가이드**](docs/GUIDE.md)(영어)를 따라 하세요. 전부 브라우저에서 합니다 —
Deploy 버튼 하나, 5분쯤. 키와 표는 앱이 처음 켜질 때 알아서 만듭니다. 둘이 쓸 한 벌이 깔려요.

### AI에게 맡기기 (제일 쉬움)

이 저장소를 받아서, 그 폴더에서 Claude Code나 Codex 같은 CLI 에이전트를 켜고
이렇게 물어보세요.

```
이거 어떻게 써?
```

[`AGENTS.md`](AGENTS.md)에 설치 절차가 에이전트가 읽을 수 있게 적혀 있습니다.
프로젝트 이름만 정해주면 나머지는 알아서 합니다. 브라우저 로그인 한 번(`vercel login`)만
직접 해주시면 됩니다.

### 직접 하기

계정이 이미 있으면 5분입니다. Neon은 따로 가입 안 해도 됩니다 — Vercel 통합이
계정까지 만들어줍니다.

```bash
npm install
npx vercel login
npx vercel link --yes
npx vercel integration add neon        # DATABASE_URL이 들어갑니다

npx vercel env pull .env.local
npm run verify                         # ✗는 고치고 ⚠는 읽어보기
npx vercel deploy --prod
```

꼭 넣어야 하는 환경변수는 없습니다. 알림용 VAPID 키는 앱이 첫 요청 때 만들어 DB에
두고(`lib/setup.js`), 표도 같은 때 만들어요. 사진용 Blob, 구글 로그인용 클라이언트 ID,
아침 알림 시계 열쇠(`CRON_SECRET`), 스토어 앱 알림 키(FCM·APNs)는 선택이고
[`AGENTS.md`](AGENTS.md#first-install)에 정리돼 있습니다.

**다른 커플도 가입하게 하면 서비스를 운영하는 것입니다.** Vercel Hobby는 개인 용도만
허용해서 Pro가 필요하고, 시계가 하루 종일 돌면 Neon도 유료가 필요합니다
([`docs/RUNNING.md`](docs/RUNNING.md)).

`npm run verify`가 ✗를 내면 고치는 명령을 같이 알려줍니다.

## 알림 켜기

**설정 → 휴대폰 알림 → 알림 받기.** 기기마다 한 번씩 눌러야 합니다. 스토어 앱은 알아서 물어봅니다.

**아이폰은 홈 화면에 추가한 앱에서만 켜집니다.** 사파리 탭에서는 버튼이 눌리지
않아요. 공유 → "홈 화면에 추가" → 그 아이콘으로 열어서 켜주세요. (iOS 16.4+)

안드로이드와 데스크톱 크롬은 그냥 됩니다.

## 내 것으로 바꾸기

**설정 화면에서 되는 것** — 앱 이름, 인사말, 두 사람 이름, 처음 만난 날, 테마,
달력 사진. 코드를 안 건드립니다. **저장 버튼은 없습니다.** 적거나 고르면 바로 담겨요.

**파일만 갈아끼우면 되는 것**

| 파일 | 어디에 |
|---|---|
| `public/mascot.png` | 로그인 화면의 큰 그림 |
| `public/favicon.png` | 브라우저 탭 · 알림창 아이콘 |
| `public/badge.png` | 폰 상단바 알림 아이콘 |

`badge.png`만 규칙이 있습니다. **안드로이드가 알파(모양)만 씁니다** — 색은 시스템이
칠해요. 컬러 사진을 넣으면 뭉개진 덩어리가 됩니다. 96px에 흰색 + 알파로 저장하세요.

**코드를 고쳐야 하는 것**

- **테마 추가** — `style.css`의 `[data-theme="..."]` 블록을 복사해 값만 갈고,
  `app.js`의 `THEMES` 배열에 id를 넣고, 언어팩에 `theme.<id>` 키를 더합니다.
  고르는 칸의 미리보기는 저절로 생깁니다
- **홈 화면 아이콘 밑 글씨** — `public/manifest.json`. 설정을 따라가지 않습니다

## 언어

영어·한국어·일본어·중국어(간체)·스페인어·프랑스어·독일어·포르투갈어(브라질)·러시아어,
아홉 언어로 나옵니다. **설정 → 언어**에서 바꾸면 둘 다 바뀝니다 — 같이 쓰는
설정이라서요. 아무도 안 골랐으면 브라우저 언어를 따릅니다. 날짜·시각·요일 이름은
`Intl`이 만들어서 언어를 따라갑니다.

언어팩은 키와 값만 적힌 파일 하나입니다. 라이브러리도 빌드도 없습니다.

```
public/i18n/en.js     기준이 되는 파일
public/i18n/ko.js     ja.js · zh-CN.js · es.js · fr.js · de.js · pt-BR.js · ru.js
```

하나 더 넣으려면 `en.js`를 복사해 값만 옮기고, `index.html`에 `<script>` 한 줄,
`i18n/index.js`의 `LOCALE_NAMES`에 이름 한 줄, 알림에도 쓰이게 `lib/i18n.js`에
import 한 줄을 더하면 됩니다. 빠뜨린 키는 빈칸이
아니라 영어로 나옵니다. `npm run i18n`이 어디까지 됐는지 알려줍니다.

서버도 같은 파일을 써서, 휴대폰 알림도 정한 언어로 옵니다.

## 공휴일

**설정 → 공휴일**에서 나라를 고릅니다. 나라 하나가 파일 하나예요.

```
public/holidays/none.js   기본값 (안 씀)
public/holidays/calc.js   부활절·"몇째 주 무슨 요일" 계산 (여러 나라가 같이 씀)
public/holidays/kr.js     대한민국. 음력 명절과 대체공휴일까지
public/holidays/jp.js     일본. 대체휴일과 국민의 휴일까지
public/holidays/cn.js     중국 본토. 법정 공휴일 (음력 날짜는 2036년까지)
public/holidays/us.js     미국 연방 공휴일. 주말이면 옮겨 쉬는 날까지
public/holidays/de.js     독일. 전국 공통 공휴일만
public/holidays/fr.js     프랑스 본토
public/holidays/es.js     스페인. 전국 공통 공휴일만
public/holidays/br.js     브라질. 전국 공휴일
public/holidays/ru.js     러시아. 공휴일 당일만
```

음력에 매인 명절은 계산으로 못 구해서 2036년까지 적어뒀고, 대체공휴일은 규칙대로
알아서 붙습니다. 지역 공휴일이나 정부가 해마다 따로 정하는 날(중국의 주말 맞바꾸기,
러시아의 휴일 이동)은 계산할 수 없어서 빠져 있어요 — 무엇이 빠졌는지는 파일마다
맨 위에 적혀 있습니다.

## 알아둘 것

- **첫 접속이 1~2초 걸립니다.** Neon이 5분 놀면 잠들고 첫 요청에 깨어납니다.
  무료로 쓰는 대가이자, 무료로 유지되는 이유입니다
- **로그인은 화면이 읽을 수 없는 쿠키로 다닙니다**(HttpOnly, SameSite). 비밀번호는
  없고, 로그인·초대 토큰은 해시로만 둡니다
- **자기가 바꾼 건 자기한테 알림이 안 옵니다.** 상대에게만 갑니다
- **아이폰 웹푸시는 가끔 조용히 끊깁니다.** 앱을 열 때 구독이 사라졌으면 조용히 다시
  걸지만, 그래도 안 오면 설정에서 껐다 켜주세요

오래 굴릴 때 볼 것은 [`docs/RUNNING.md`](docs/RUNNING.md)에 있습니다 — 무료 한도,
손대면 안 되는 환경변수, 시간이 지나면 손봐야 하는 것.

## 구조

```
api/      서버리스 함수 (얇은 핸들러)
lib/      store.js 달력 SQL · accounts.js 계정 SQL · http.js 세션
          push.js · fcm.js · apns.js 알림 · blob.js 사진
public/   화면. 빌드 없이 그대로 서빙됩니다
public/privacy.html  개인정보 처리방침 (초안 — 빈칸 채우기)
android/ ios/        스토어 앱 껍데기 (Capacitor)
fastlane/ .github/   Mac 없이 CI에서 스토어 빌드
schema.sql  표 열세 개 — 앱이 처음 켜질 때 스스로 돌립니다
landing.mjs 공개 페이지 생성 (글은 landing-content.mjs)
test.mjs    핸들러 통합 테스트 344개
screen-test.mjs  public/app.js를 직접 돌리는 테스트 122개 — 로그인, 일정 창, 설정, 앱 알림, 설치
```

```bash
npm test      # 인메모리 Postgres에 진짜 핸들러를 물립니다. Neon 계정 없이 돕니다
npm run verify
```

## 라이선스

무단 사용 금지(All rights reserved). [LICENSE](LICENSE)를 보세요.
