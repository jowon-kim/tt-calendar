# 밤사이 작업 인수인계 (2026-09-26 새벽)

계획 원본: `~/.claude/plans/jazzy-discovering-shamir.md` (M0~M8)
브랜치: `feat/multi-tenant` (`feat/more-languages` 위). **커밋·푸시·배포는 하나도 안 했습니다** —
전역 규칙(커밋은 요청할 때만). 전부 작업 트리에 있어요: `git status`, `git diff`.

## 한눈에

| 단계 | 상태 | 검증 |
|---|---|---|
| M0 정리 | ✓ | 기준선 258 테스트 기록 |
| M1 계정·세션 + M2 커플별 데이터 분리 | ✓ | 서버 테스트 + **진짜 크롬 두 세션으로 가입→초대→공유→로그아웃→비번 재설정→탈퇴** |
| M3 사진 → Vercel Blob | ✓ | 가짜 Blob으로 테스트. 진짜 Blob은 첫 배포 때 확인 필요 |
| M4 네이티브 알림 (서버) | ✓ | 안드로이드=FCM, **iOS=애플 APNs 직통**(계획과 다름). 진짜 JWT 서명을 공개키로 검증 |
| M5 Capacitor 앱 | ✓ | **안드로이드 APK·서명된 .aab를 이 PC에서 실제로 빌드함**. iOS는 Mac이 없어 빌드 못 해봄 |
| M6 빌드 CI | ✓ 작성 | test/android/ios 워크플로 + fastlane. 시크릿 없어서 실행은 못 해봄 |
| M7 나가는 문 | ✓ | 탈퇴(비번 재확인)·내려받기·개인정보 처리방침 **초안** |
| M8 출시 체크리스트 | 사용자 몫 | `docs/APPS.md`에 순서대로 |

**테스트: `npm test` 412개 전부 통과** (서버 281 · 다국어 19 · 공휴일 39 · 화면 73). 시작할 때 258개.
`npm ci`부터 새로 깔아서도 통과 확인. 9개 언어 문구 전부 100%.

## 내일 먼저 볼 것

1. **훑어보기**: `docs/handoff-shots/`에 진짜 크롬(폰 크기, 한국어)으로 찍은 화면 19장 (13~15: 아이폰 설치 안내·night 테마·카톡 탈출 창, 16~19: 첫 진입 — 로그인 → 이름 → 홈 화면 추가 → 사용법)
2. **커밋해도 되는지** 말해주세요. 제안 — 두 커밋으로 나누기:
   - `accounts + per-couple data + photos + push + exit door` (서버·화면·테스트·문서)
   - `store apps: capacitor shells + CI` (`android/`, `ios/`, `.github/`, `fastlane/`, `capacitor.config.json`)
3. **`feat/more-languages` → `main` 머지**는 직접 (main을 안 건드렸어요)
4. 정해야 할 값 셋 — `capacitor.config.json`:
   - `server.url` = 지금 `https://couple-diary-test.vercel.app` (**추측값**)
   - `appId` = `com.jowonkim.couplediary` (스토어에 한 번 올리면 못 바꿈)
   - `appName` = `Couple Diary`

## 계획과 다르게 간 것 (이유 포함)

| 무엇 | 이유 |
|---|---|
| M1·M2를 한 커밋 단위로 | M1만 넣으면 새로 가입한 모든 계정이 **같은 달력 하나**를 봄 |
| `main` 안 건드림 | 전역 규칙: 기본 브랜치에 직접 커밋 금지 |
| RLS 안 함 | 테이블 주인 롤은 FORCE 없이는 RLS를 우회 → 켜도 보호 0, 안전한 척만 함. 대신 모든 쿼리에 couple_id + 필터를 하나씩 빼서 테스트가 잡는지 확인(뮤테이션 6개 전부 잡힘) |
| firebase-admin 안 씀 | FCM HTTP v1을 fetch+crypto로 직접(`lib/fcm.js`). 런타임 의존성 3개 유지 |
| **iOS 알림은 FCM 말고 APNs 직통** | Capacitor 플러그인이 iOS에선 APNs 토큰을 줌. FCM으로 가려면 iOS에 Firebase SDK + AppDelegate 수정 필요 — Mac 없이 확인 불가 |
| **번들러 없이 플러그인 부르기** — 설계 에이전트 주장이 틀렸음 | 네이티브는 플러그인 목록만 넣고 부르는 코드는 `@capacitor/core`에 있음. core의 8.7KB 단독 스크립트를 `public/vendor/capacitor.js`로 두고 **앱 안에서만** 로드 |
| 예전 한 쌍용 데이터를 첫 가입자에게 안 넘김 | 주인보다 먼저 가입한 낯선 사람이 가져갈 수 있음. 지우지도 않음 |
| 사진은 Blob 토큰 없으면 DB에 | 로컬 개발·직접 설치가 계속 되게. 예전 사진도 읽힘 |

## 찾아서 고친 구멍들 (계획에도 없던 것)

- **사진 주소가 인증 없이 열림** → 로그인을 HttpOnly 쿠키로 바꿔 `<img>`에도 실리게. `Cache-Control: private`
- **알림 가로채기**: 화면이 보낸 `owner`로 기기를 걸어서, 상대 이름으로 걸면 상대 알림을 받을 수 있었음 → 계정이 정함
- **cron 키가 설정 화면에 노출** → 여러 커플이면 아무나 모든 커플 알림을 두드림. 운영자용 `CRON_SECRET`으로
- **cron 응답에 일정 제목** → 바깥 시계 서비스 로그에 남의 일정이 쌓임. id·개수만
- **`reminders_sent` 키에 커플이 없음** → A커플의 "오늘 알림" 기록이 B커플을 막았을 것 (테스트로 재현·수정)
- **로그아웃해도 폰 알림이 계속 옴** → 로그아웃·탈퇴 때 그 기기 줄 삭제
- **로그아웃해도 달력 캐시가 폰에 남음** → 같은 폰에 다른 커플이 로그인하면 잠깐 보였을 것
- **탈퇴 비번 틀리면 로그아웃됨**(화면이 401을 로그아웃으로 읽음) → 403
- **둘이 동시에 탈퇴하면 주인 없는 달력이 남을 수 있음** → 사람부터 지우고 "빈 달력이면 삭제"
- **이름 안 적었을 때 상대 일정에 "나"가 붙음** → 보는 사람 기준으로
- `verify.mjs`가 새 구조에서 멀쩡한 설치를 ✗로 보던 것

## 바뀐 것 자세히

### M1+M2 계정·분리
- 새 표: users, couples, couple_members(a/b 자리), invites, sessions, password_resets, login_failures.
  기존 5개 표에 `couple_id`. 토큰(세션·초대·재설정)은 DB에 **해시만**. 비밀번호 scrypt
- API: `signup` `login` `logout` `invite`(POST 만들기 / PUT 받기) `password-reset`(POST 요청 / PUT 확정) `account`(GET 내려받기 / DELETE 탈퇴)
- 로그인 보호: 15분 10번 → 429. 없는 이메일도 같은 답·같은 시간
- 초대: 1회용·7일. 이미 가입해 혼자 쓰던 사람도 받을 수 있음(빈 달력이면 옮김, 일정 있으면 거절)
- 재설정 메일: Resend를 fetch로. 2분 안 재요청 무시(메일 폭탄 방지)
- cron: 달력마다 자기 시간대·언어로. **커플들이 시간대가 다르면 시계를 하루 종일 돌려야 해서 Neon 유료가 필요** (AGENTS.md에 적음)

### M3~M7
위 표 참고. 세부는 `docs/APPS.md`(앱), `AGENTS.md`(설치·운영), `docs/RUNNING.md`(비용).

### 문서
README(영/한), AGENTS.md, docs/GUIDE.md, docs/RUNNING.md를 계정 방식에 맞게. 새로 docs/APPS.md.

## 아직 안 된 것 / 위험

| | |
|---|---|
| ⚠ iOS 빌드 한 번도 안 돌림 | 첫 `ios` 워크플로 실행 오류 보고 고쳐야 함. `aps-environment=development` 엔타이틀먼트가 스토어 서명에서 문제될 수도 |
| ⚠ `server.url` 원격 로딩 | Capacitor 문서는 개발용이라 함. 심사·동작 문제 시 `webDir` 번들 + 토큰 로그인으로 바꿔야 함 |
| ⚠ 진짜 Neon·Blob·Resend·FCM·APNs | 전부 가짜로 테스트. 첫 배포 후 사진 하나, 재설정 메일 하나, 폰 알림 하나 직접 확인 |
| 개인정보 처리방침 | **초안**. `[ ]` 빈칸(운영자·연락처·DB 지역) 채우고 가능하면 검토 |
| 이메일 인증 없음 | 남의 이메일로 가입 가능(진짜 주인은 재설정으로 되찾을 수 있음) |
| 가입 스팸 방지 없음 | 봇 가입 막는 장치(캡차 등) 없음 |
| 앱 아이콘 | 1024px 원본 필요 |
| 앱 안 "내 데이터 받기" | 웹뷰에서 파일 내려받기가 안 될 수 있음 |
| 결제·RLS·캘린더 연동 | 범위 밖 (계획대로) |
| npm audit | @capacitor/cli 안 xcode→uuid moderate 3개. 빌드 도구라 배포물엔 없음 |

## 이 PC에 생긴 것

- Android SDK에 Platform 36, Build-Tools 35가 설치됨 (Gradle이 자동으로. 라이선스는 이미 동의돼 있었음)
- `android/local.properties` (git 무시됨), `android/app/build/` 빌드 결과물 (무시됨)
- 스크래치 폴더(임시)에 로컬 개발 서버·브라우저 테스트 스크립트 — 저장소 밖
- `docs/handoff-shots/` 스크린샷 19장 — 확인 후 지워도 됨 (README 스크린샷 후보는 `07-calendar-shared.png`)
