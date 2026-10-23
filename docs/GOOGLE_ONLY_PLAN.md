# 로그인을 구글 하나로 (2026-10-23 결정)

사용자 결정: "온니 구글". 아이디·비밀번호 가입을 없애고, 웹과 스토어 앱 모두 구글 버튼 하나로 들어온다.
이 파일만 보고 이어서 실행할 수 있게 적어둔다. 끝나면 이 파일은 지우고 LAUNCH.md에 한 줄 남긴다.

## 지금 상태 (코드 확인함)
- 서버: `api/_auth/signup.js`(아이디 가입), `login.js`(아이디 로그인), `google.js`(구글 — 처음이면 가입까지, `invite` 받음), `account.js`(비번 변경 PATCH, 탈퇴 DELETE는 비번 또는 구글 credential)
- 화면: `public/app.js` 2203~2345줄 로그인 화면(`setGateMode`, `submitGate`, `loadGoogle`, `offerGoogle`, `signInWithGoogle`), `index.html` 60~92줄 `#gate`
- 앱 안(`inApp()`)에서는 `loadGoogle()`이 false를 돌려 구글 버튼을 숨긴다 — WebView에서 구글 팝업이 막혀서(disallowed_useragent)
- 서버 `lib/google.js`는 `GOOGLE_CLIENT_IDS`(쉼표로 여러 개)에 aud가 있으면 받는다

## 진행 상황
- ✅ 1단계 웹 (2026-10-23): 구글 버튼만 크게, 초대 안내 문구 변경, 아이디 폼은 `<details id="gate-legacy">`로 접어서 **로그인만** (가입 폼 제거). 비번 변경·탈퇴는 예전 계정용으로 그대로 둠. 9개 언어 `gate.legacy` 추가, 안 쓰는 gate 키 6개 삭제. `npm test` 전부 통과
- ✅ 2단계 (2026-10-23, 사용자: "아직 아무도 안 씀" → 예전 아이디 문도 제거, main 직행 OK): `/api/signup`·`/api/login` → 410 `error.googleOnly`, `PASSWORD_SIGNIN=on`일 때만 열림(test.mjs가 켜고 씀, 꺼진 기본값 테스트 추가, red→green 확인). 화면에서 아이디 폼·CSS·안 쓰는 키 전부 제거. AGENTS.md 반영
- ✅ 3단계 코드 (2026-10-23): `@capawesome/capacitor-google-sign-in@0.1.4` 설치·`app:sync`, `app.js` `loadGoogle`이 안드로이드 앱이면 플러그인 `initialize({ clientId: 웹 })` → 우리 버튼 → `signIn()`의 idToken을 `/api/google`로. 아이폰 앱은 숨김 유지. 닫기(cancel)는 조용히. 화면 테스트 추가, 디버그 APK 빌드 OK
- ⬜ 사용자: 구글 콘솔에 Android OAuth 클라이언트 등록 (docs/APPS.md 2-1, 디버그 SHA-1 적어둠) → 실기기에서 가입·초대·탈퇴 확인 (아직 실기기 미확인)
- ✅ 4단계 문서 (2026-10-23): README·README.ko, privacy.html(한/영), landing(en/ko, 재생성), LAUNCH.md(심사 계정 ⚠, Data safety 이메일 행)
- ⬜ 사용자: 심사용 **구글** 계정 2개 만들어 짝짓기 (LAUNCH.md 심사용 계정 행)
- ⬜ 나중에: 5단계 iOS 애플 로그인

## 할 일 (순서대로, 단계마다 `npm test`)

### 1. 웹: 구글만 보이게
- `index.html` `#gate`: `#gate-form`, `gate-or`, `gate-switch` 제거. 구글 버튼만 남김
- `app.js`: `GATE`/`setGateMode`/`submitGate`/`wantsSignup` 정리. 초대(`pendingInvite`) 안내 문구(`gate.invited`)는 유지. `gate.noRecovery` 제거
- `$('gate-username').focus()` 제거
- 구글이 꺼져 있으면(`GOOGLE_CLIENT_IDS` 없음) `error.googleOff` 문구를 보여준다 (빈 화면 방지)
- 설정의 비밀번호 변경 버튼 `#s-password`, `#pw-*` 대화창 제거. 탈퇴는 구글 확인만 (`hasPassword` 분기 제거)

### 2. 서버: 새 아이디 가입 막기
- `signup.js` → 410 `error.googleOnly` (라우트는 남겨 둠: 옛 화면 캐시가 부르면 메시지를 보이게)
- `login.js` / `account.js` 비번 경로: **기존 아이디 계정이 운영 DB에 있는지 먼저 확인** (`select count(*) from users where password_hash is not null`; `verify.mjs`에 카운트를 추가하거나 Neon 콘솔에서 확인).
  - 0명이거나 본인 테스트 계정만 있으면 → login도 410, PATCH 제거, 탈퇴는 구글만
  - 실제 사용자가 있으면 → login은 남기고 화면 맨 아래에 작은 "예전 아이디로 로그인" 링크(숨은 폼)만 둔다. 그분들이 구글로 옮길 방법은 따로 (설정 → 구글 연결)
- `test.mjs`의 signup/login 테스트를 새 동작에 맞게 바꾼다. `screen-test.mjs`의 게이트 테스트도 함께
- 새 i18n 키(`error.googleOnly` 등)는 9개 언어팩 모두에 넣고 `npm run i18n`

### 3. 안드로이드 앱: 네이티브 구글 로그인
- 플러그인: `@capawesome/capacitor-google-sign-in` (안드로이드는 Credential Manager, iOS는 Google Sign-In SDK). **Capacitor 8 호환 버전인지 npm에서 먼저 확인.** 안 되면 `@capgo/capacitor-social-login`
- `app.js`: `inApp()`이면 GIS 스크립트 대신 플러그인 `signIn({ serverClientId: <웹 클라이언트 ID> })` → idToken을 그대로 `/api/google`에 `credential`로 넘긴다. 탈퇴 확인(`ask(..., {google:true})`)도 같은 경로
- serverClientId로 웹 클라이언트를 쓰면 idToken의 aud = 웹 클라이언트 ID라서 서버 수정은 필요 없을 것 (실기기에서 aud 확인)
- `capacitor.config.json`은 server.url 원격 로딩이라 플러그인 JS는 `window.Capacitor.Plugins`로 부른다(푸시와 같은 방식, `nativePush()` 참고). `npm run app:sync`
- **사용자 할 일 (구글 클라우드 콘솔)**: OAuth 클라이언트 ID → Android, 패키지 `com.jowonkim.couplediary`, SHA-1은 ① 업로드 키(Documents/tt-keys) ② Play 앱 서명 키(Play Console에 앱을 만든 뒤 나옴) ③ 디버그 키 — 세 개 모두 등록
- 서명된 APK로 실기기 테스트: 가입 → 초대 링크 → 상대 가입 → 탈퇴

### 4. 문서
- `AGENTS.md` "What this is"/"What the user has to do"(구글 클라이언트 ID가 이제 필수), `README*`, `docs/APPS.md`(안드로이드 OAuth 클라이언트), `docs/LAUNCH.md`, `privacy.html`(수집 항목: 구글 sub·이메일, 아이디/비번 문구 제거), 랜딩 문구에 "비밀번호" 언급이 있으면 정리(`landing-content.mjs`, `node landing.mjs --check`)

### 5. 나중에 (iOS 앱 낼 때)
- 앱스토어 가이드라인 4.8: 구글 로그인만 있으면 **Sign in with Apple을 같이 넣어야 한다**. 서버에 `api/_auth/apple.js` 추가(애플 JWKS로 ID 토큰 확인, `lib/google.js`와 같은 구조). 함수 12개 제한 때문에 `api/auth.js` 라우트 안에 넣는다
- 웹(아이폰 사파리)은 구글만으로 OK

## 끝났다고 말하기 전에
`npm test` 전부 통과 → 프리뷰 배포에서 웹 가입/초대/탈퇴 직접 확인 → main 머지(자동 배포) → 운영에서 구글 가입 1회 확인
