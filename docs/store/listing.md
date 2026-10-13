# 스토어 등록 문구 (초안)

앱 이름이 정해지면 `TT` 자리를 바꾸세요. 글자 수 한도는 Play 기준(짧은 설명 80자, 긴 설명 4000자),
App Store는 부제 30자·설명 4000자입니다.

아이콘: `docs/store/play-icon-512.png` (Play 고해상도 아이콘). iOS 1024px는 앱 안에 들어 있습니다.

## 이미지 — 어느 칸에 무엇을 (2026-10-07)

데모 커플 **Mina·Leo**(실서비스의 데모 계정)로 찍은 화면에 한 줄 문구를 얹은 것. 영어(`en-*`)는 기본 언어,
한국어(`ko-*`)는 한국어 등록정보에. 순서는 1 → 5 그대로.

| 칸 | 파일 | 크기 |
|---|---|---|
| Play 휴대전화 스크린샷 | `play/en-1~5.png`, `play/ko-1~5.png` | 1080×1920 (Play는 긴 변이 짧은 변의 2배를 넘으면 안 됨 — 예전 1170×2532는 그래서 지움) |
| Play 대표 이미지 | `play-feature-graphic-en.png` (영어), `play-feature-graphic.png` (한국어) | 1024×500 |
| App Store 6.9″ iPhone | `appstore-6.9/en-*`, `appstore-6.9/ko-*` | 1320×2868 |
| App Store 6.5″ iPhone | `appstore-6.5/en-*`, `appstore-6.5/ko-*` | 1284×2778 |
| 미리보기 영상(선택) | `../demo/demo.mp4` — Mina가 넣은 일정이 Leo 폰에 뜨는 25초 | 780×1690 |

4번 화면의 알림 배너는 그림으로 얹은 것이지만, 문구는 서버가 실제로 보내는 그대로입니다(`lib/message.js` describe).
다시 찍는 스크립트는 세션 임시 폴더에 있었습니다 — 화면이 크게 바뀌면 Claude에게 "스토어 이미지 다시"라고 하면 됩니다.

## 한국어

**앱 이름**: TT — 둘이 쓰는 달력

**짧은 설명 / 부제**
> 둘이 함께 쓰는 달력. 일정을 넣으면 상대 폰에 바로 알려줘요.

**설명**
> TT는 커플이 함께 쓰는 달력이에요.
>
> • 한 사람이 일정을 넣거나 바꾸면 상대 폰에 바로 알림이 가요
> • 시간이 있는 일정은 30분~1시간 전에, 아침 8시엔 오늘 일정을 모아서 한 번 — 둘 다에게
> • 초대 링크 하나로 상대를 불러 같은 달력을 써요
> • 사귄 날부터 100일·1주년 같은 기념일을 달력에 그려줘요
> • 달력을 우리 사진과 색으로 꾸밀 수 있어요
> • 9개 언어, 9개 나라 공휴일
>
> 광고가 없고, 정보를 팔지 않아요. 아이디와 비밀번호만으로 가입하고, 이메일은 받지 않아요.
> (이메일이 없어서 비밀번호를 잊으면 되찾을 수 없어요. 걱정되면 웹에서 구글로 가입하세요.)

## English

**Name**: TT — a calendar for two

**Short description / subtitle**
> A calendar you share with your partner. Add a plan — their phone knows at once.

**Description**
> TT is a calendar for couples.
>
> • When one of you adds or changes a plan, the other one's phone hears about it at once
> • Both of you hear about a plan 30 to 60 minutes before it starts, and get the whole day at 8am
> • Invite your partner with one link and share a single calendar
> • Anniversaries from the day you met — 100 days, a year — appear on the calendar
> • Dress the calendar in your own photos and colours
> • Nine languages, public holidays for nine countries
>
> No ads, and your data is never sold. Sign up with just a username and password — no email.
> (Without an email a forgotten password cannot be recovered. If that worries you, sign up with Google on the web.)

## 심사에 적어둘 것

- **테스트 계정**: 데모 커플 계정 두 개가 실서비스에 있습니다 (2026-10-07, Mina = `ttdemo.mina`, Leo = `ttdemo.leo`,
  짝지어짐, 10월 일정 7개). **비밀번호는 저장소에 적지 않습니다** — 사장님이 보관. Play "앱 액세스"와 App Store "로그인 정보"에
  `ttdemo.mina`와 비밀번호를 넣고, 메모에 "Partner account ttdemo.leo uses the same password; adding a plan on one shows on the other." 
- **데이터 보안 / 개인정보 라벨**: 모으는 것 — 아이디, 사용자 콘텐츠(일정·사진), 기기 알림 토큰. 추적·광고 없음.
  계정 삭제는 앱 안에서(설정 → 계정 → 계정 삭제), 웹에서는 같은 메뉴
- **개인정보처리방침 URL**: `https://tt-calendar.vercel.app/privacy.html`
- **개발자 연락처(공개)**: tt.calendar.help@gmail.com · 개발자 이름: Google Play는 **Jowon**(조직 계정, D-U-N-S 상호와 똑같이) · App Store는 **김조원**(개인사업자는 Apple에 개인으로 가입)

## App Store에만 있는 칸

| 칸 | English | 한국어 |
|---|---|---|
| 부제 (30자) | A calendar for two | 둘이 함께 쓰는 달력 |
| 프로모션 텍스트 (170자, 심사 없이 바꿀 수 있음) | Plans, anniversaries and the day's reminders — shared between the two of you, on both your phones. | 일정·기념일·오늘의 알림을 둘이 같이. 두 사람 폰 모두에. |
| 키워드 (100바이트, 쉼표) | couple,calendar,shared,partner,relationship,anniversary,dating,planner,together,days | 커플,캘린더,달력,공유,기념일,디데이,연애,일정,데이트,우리 |
| 지원 URL | https://tt-calendar.vercel.app/en/ | https://tt-calendar.vercel.app/ko/ |
| 마케팅 URL | https://tt-calendar.vercel.app/en/ | https://tt-calendar.vercel.app/ko/ |
| 카테고리 | 기본 Lifestyle, 보조 Productivity | |
| 연령 등급 | 설문 전부 "없음" → 4+ (사용자끼리 소통은 짝지은 한 사람뿐) | |
| 저작권 | 2026 Jowon Kim | |

**App Store 심사 메모 (Review Notes)**
> TT is a shared calendar for a couple. Sign in with the demo account above. A second, already-paired
> account (ttdemo.leo, same password) shows the partner's side: a plan added on one appears on the other.
> No purchases, no ads. Account deletion: Settings → Account → Delete account.

**개인정보 라벨 (App Privacy)** — 위 "데이터 보안"과 같은 내용: 연락처 정보 없음, 사용자 콘텐츠(사진·기타), 식별자(사용자 ID),
진단 없음. 모두 "앱 기능", 사용자와 연결됨, 추적 안 함.
