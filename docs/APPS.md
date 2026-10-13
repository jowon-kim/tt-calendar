# 스토어 앱 (iOS · Android)

웹 앱을 Capacitor로 감싼 얇은 껍데기입니다. 앱은 운영 주소(`capacitor.config.json`의
`server.url`)를 그대로 띄우고, 그 위에 **휴대폰 OS 알림**을 얹습니다 — 웹뷰만 감싼 앱은
애플 심사(4.2 최소 기능)에서 반려되기 쉬워서, 네이티브 알림이 그 몫을 합니다.

- 웹을 고치면 앱은 스토어 심사 없이 바로 바뀝니다(같은 주소를 띄우니까요)
- 앱 껍데기 자체(아이콘, 권한, 플러그인)를 바꿀 때만 새 빌드를 올립니다
- 알림: 안드로이드는 FCM, iOS는 애플 APNs에 서버가 바로 보냅니다 (`lib/fcm.js`, `lib/apns.js`)

## 먼저 정할 것 (한 번 올리면 못 바꿈)

| 값 | 지금 | 어디 |
|---|---|---|
| 앱 ID (번들 ID · 패키지 이름) | `com.jowonkim.couplediary` | `capacitor.config.json`, `android/app/build.gradle`(namespace·applicationId), `ios/App/App.xcodeproj`(PRODUCT_BUNDLE_IDENTIFIER), `fastlane/Fastfile`, `.github/workflows/android.yml` |
| 앱 이름 | `TT` | `capacitor.config.json` → `npx cap sync` |
| 띄울 주소 | `https://tt-calendar.vercel.app` | `capacitor.config.json` `server.url` |

바꿨으면 `npm run app:sync`.

## 해야 할 일 — 순서대로

### 1. 계정 (사용자)
- [ ] Apple Developer Program 가입 (연 $99) — 승인까지 하루~이틀
- [ ] Google Play Console 가입 ($25, 한 번) — 개인 계정은 **테스터 12명·14일 비공개 테스트**를 거쳐야
      프로덕션에 낼 수 있습니다(2023년 11월 이후 개인 계정 규칙). 일정에 넣으세요
- [ ] Firebase 프로젝트 (무료) — 안드로이드 알림용

### 2. 안드로이드 알림 (Firebase)
- [ ] Firebase 콘솔 → 프로젝트에 안드로이드 앱 추가(패키지 이름 = 앱 ID) → `google-services.json` 받기
- [ ] 프로젝트 설정 → 서비스 계정 → 새 비공개 키 → JSON을 Vercel 환경변수 `FIREBASE_SERVICE_ACCOUNT`에 통째로
- [ ] `google-services.json` 내용을 GitHub 시크릿 `GOOGLE_SERVICES_JSON`에 (저장소에는 넣지 않습니다)

### 3. iPhone 알림 (APNs)
- [ ] developer.apple.com → Certificates, Identifiers & Profiles → Identifiers에서 앱 ID 만들고 **Push Notifications** 켜기
- [ ] Keys → 새 키, **Apple Push Notifications service (APNs)** 체크 → `.p8` 받기 (한 번만 받을 수 있음)
- [ ] Vercel 환경변수: `APNS_KEY`(.p8 내용 통째로), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`(=앱 ID)
- [ ] TestFlight·스토어 빌드는 운영 APNs라 `APNS_SANDBOX`는 **넣지 않습니다**

### 4. 안드로이드 빌드 (GitHub Actions `android`)
- [ ] 업로드 키 만들기 (Android Studio에 들어 있는 keytool로):
      `keytool -genkeypair -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
      **이 파일과 암호를 잃어버리면 앱을 다시 못 올립니다.** 저장소 밖 안전한 곳에 백업
- [ ] 시크릿: `ANDROID_KEYSTORE_BASE64`(`base64 -w0 upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`(=upload), `ANDROID_KEY_PASSWORD`
- [ ] Actions → android → Run workflow → `aab` 아티팩트 받기
- [ ] **첫 버전은 Play Console에 손으로** 올리기 (API는 두 번째부터)
- [ ] Play Console → API 액세스 → 서비스 계정 JSON을 시크릿 `PLAY_SERVICE_ACCOUNT_JSON`에 → 이후 자동으로 내부 테스트 트랙

### 5. iOS 빌드 (GitHub Actions `ios`, Mac 없이)
- [ ] App Store Connect → 앱 만들기(번들 ID = 앱 ID)
- [ ] App Store Connect → 사용자 및 액세스 → 통합 → API 키(App Manager) → `.p8` 받기
- [ ] 비공개 저장소 하나 새로 (예: `certs`) — match가 서명 인증서를 암호화해 넣습니다
- [ ] 시크릿: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_CONTENT`(`base64 -w0 AuthKey_XXX.p8`),
      `MATCH_GIT_URL`, `MATCH_GIT_BASIC_AUTHORIZATION`(`echo -n "깃허브아이디:토큰" | base64`), `MATCH_PASSWORD`
- [ ] Actions → ios → Run workflow → TestFlight에 올라감
- [ ] 러너의 Xcode가 스토어 요구 SDK보다 낮다고 나오면 `ios.yml`의 `xcode-select` 줄을 켜세요

### 6. 스토어 등록 정보
- [ ] 아이콘 1024×1024 (지금 마스코트는 512px라 새로 필요). 받으면 `npx @capacitor/assets generate`로 전부 만듭니다
- [ ] 스크린샷 (iPhone 6.9"/6.5", 안드로이드 폰)
- [ ] 개인정보 처리방침 URL: `https://<주소>/privacy.html` — **`[ ]` 빈칸부터 채우기**
- [ ] 애플 "앱 개인정보" 설문: 사용자 ID(아이디), 사용자 콘텐츠(일정·사진), 기기 ID(알림 토큰) — 모두 "앱 기능", 추적 없음
- [ ] 심사용 데모 계정 두 개(초대로 묶인 한 쌍)와 비밀번호를 심사 메모에
- [ ] 계정 삭제 위치 안내: 설정 → 계정 → 계정 삭제 (애플 5.1.1(v))

## 확인된 것 / 아직 모르는 것

| | |
|---|---|
| ✓ | 안드로이드 디버그 APK, 서명 없는 릴리스, **서명한 .aab**가 이 PC에서 실제로 빌드됨 (2026-09-26 밤) |
| ✓ | CI의 `versionCode` 넘기기, 키가 없을 때 서명 없이 빌드되는 것 |
| ✓ | 앱 안 알림 흐름(권한 → 토큰 → 서버 등록 → 끄기)은 가짜 Capacitor로 화면 테스트 |
| ✓ | FCM·APNs 요청 모양과 서명은 서버 테스트 (진짜 JWT를 공개키로 검증) |
| ? | **iOS 빌드는 한 번도 안 돌려봄** (Mac 없음) — 첫 `ios` 실행에서 나오는 오류를 보고 고쳐야 합니다 |
| ? | `App.entitlements`의 `aps-environment=development`가 스토어용 서명에서 production으로 바뀌는지 |
| ? | 실제 기기에서 알림이 뜨는지 — 기기로만 확인됩니다 |
| ? | `server.url`로 원격 페이지를 띄우는 방식에 대해 Capacitor 문서는 "개발용"이라고 합니다. 심사나 동작에 문제가 생기면 `webDir: public`으로 묶고 API만 원격으로 부르는 방식으로 바꿔야 하고, 그러면 쿠키 대신 토큰 로그인이 필요합니다 |
| ? | **구글 로그인은 앱 안에서 숨겨져 있습니다.** 구글이 웹뷰 안의 로그인 창을 막아서(`disallowed_useragent`), 앱은 폰의 구글 계정 선택 창(네이티브 플러그인)을 써야 합니다. 붙이면 `GOOGLE_CLIENT_IDS`에 안드로이드·iOS 클라이언트 ID를 이어 붙이세요. **iOS 앱에 구글 로그인을 넣으면 애플 심사 지침 4.8에 따라 "Sign in with Apple"도 같이 넣어야 합니다** |
