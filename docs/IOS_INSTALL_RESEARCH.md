# 아이폰에서 TT를 버튼 한 번으로 홈 화면에 — 조사 (2026-10-26)

> **결론**
> 1. **웹만으로는 원터치가 안 됩니다.** iOS 26을 포함해 사파리에는 설치 API(`beforeinstallprompt`·`navigator.install`)가 없고, WebKit은 이런 API에 반대하는 입장입니다. 공유 시트(`navigator.share`)에도 "홈 화면에 추가"가 나오지 않습니다(실기기에서 확인).
> 2. **원터치에 가까운 길은 앱스토어 앱 하나뿐**입니다. 사파리 위쪽 배너에서 "받기"를 누르면 2~3번에 홈 화면 아이콘이 생깁니다. App Clip은 링크 한 번으로 뜨지만 홈 화면에 남지 않고, 결국 앱스토어 앱이 있어야 만들 수 있습니다. 구성 프로파일(Web Clip)은 누르는 횟수가 오히려 많고 경고 화면이 떠서 맞지 않습니다.
> 3. **추천: 지금은 아이폰 버튼이 공유 시트 대신 그림 안내를 바로 띄우게 바꿉니다**(3~4번 탭이 최소). iOS 26의 탭 배치마다 공유 버튼 위치가 다른 점도 안내에 반영합니다. 그다음 길게 보고 이미 있는 `ios/` 앱을 출시해 사파리 배너로 "받기" 한 번을 만듭니다. 남은 일은 Apple 계정, 앱 안 로그인 수단, 첫 빌드입니다.

조사만 했고 코드는 바꾸지 않았습니다. **추측**이라고 표시한 곳은 출처로 확인하지 못한 제 판단입니다.
누르는 횟수는 출처의 절차를 바탕으로 제가 센 것입니다.

## 한눈에

| 길 | 가능? | 누르는 횟수 (아이콘이 생길 때까지) | 비용 | 단점 |
|---|---|---|---|---|
| ① 웹 설치 API (iOS 26 포함) | **불가** | — | — | 사파리에 없음. WebKit은 반대 입장 |
| ①' `navigator.share` 공유 시트 | **불가** | — | — | 웹이 연 공유 시트에는 "홈 화면에 추가"가 없음(실기기 확인) |
| ①'' 그림 안내 (지금 TT) | 가능 | 3~4번: 공유(또는 `···` → 공유) → (아래로 내리거나 "더 보기") → 홈 화면에 추가 → 추가 | 0 | 사용자가 공유 버튼을 직접 찾아야 함. iOS 26은 탭 배치에 따라 공유 위치가 다름 |
| ② 구성 프로파일 Web Clip | 가능하지만 비추천 | 약 8~9번 + 기기 암호: 내려받기 → 허용 → 닫기 → 설정 열기 → "프로파일이 다운로드됨" → 설치 → 암호 → 설치(경고) → 설치 → 완료 | 0 (서명하려면 인증서 필요) | 8분 안에 설치 안 하면 사라짐. "도난 기기 보호"가 켜져 있으면 낯선 장소에선 막힘. 서명 안 한 프로파일은 경고가 뜸. 평범한 사용자에겐 수상해 보임 |
| ③ App Clip | 링크 한 번으로 **뜨기는 함** | 1~2번 (메시지 링크는 바로, 사파리는 배너 → 열기) | Apple 개발자 $99/년 + 앱스토어 앱이 있어야 함 | **홈 화면에 안 남음**. 안 쓰면 30일 뒤 사라짐. 알림은 실행 후 8시간만 기본 허용 |
| ④ 앱스토어 앱 (`ios/`) | 가능 — **가장 원터치에 가까움** | 2~3번: 사파리 배너 "보기/받기" → 앱스토어 "받기" → Face ID | $99/년 | 심사(4.2 웹 포장 앱, 4.8 로그인) 위험. iOS 빌드는 아직 한 번도 안 돌려 봄. 앱 안 로그인 수단이 없음 |
| ⑤ 다른 서비스 사례 | 모두 그림·글 안내 | 3~4번 | 0 | 원터치 사례는 찾지 못함 |

## ① iOS 최신 버전(iOS 26 포함)의 웹 설치 관련 변화

| 항목 | 내용 | 출처 |
|---|---|---|
| 설치 API | 사파리(iOS)에 `beforeinstallprompt` 없음. Can I Use 기준 iOS 사파리 미지원 | [Can I Use](https://caniuse.com/mdn-api_window_beforeinstallprompt_event) · [openpwa.net 실기기 시험](https://openpwa.net/lab/behaviour/install-apis-on-ios/) |
| WebKit 입장 | standards-positions #619 (BeforeInstallPromptEvent)에 **"position: oppose"** 라벨. 설치는 브라우저가 정하고, 사이트가 설치를 조르면 안 된다는 논리. 2026-09까지 논의, 이슈는 닫힘 | [WebKit/standards-positions#619](https://github.com/WebKit/standards-positions/issues/619) |
| 크롬 쪽 | `navigator.install()`·`<install>`을 데스크톱 크롬에 내보낼 계획. iOS는 해당 없음 | [The State of PWAs in 2026](https://progressivewebapps.com/blog/the-state-of-progressive-web-apps-in-2026/) (2차 출처) |
| **iOS 26 변화** | 홈 화면에 추가한 **모든 사이트가 기본으로 웹 앱(standalone)으로 열림**. 추가 창에 "웹 앱으로 열기" 스위치가 있음. 설치 조건(매니페스트 등)이 사라졌을 뿐, **설치 버튼을 사이트가 띄우는 길은 생기지 않음** | [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) · [MacRumors](https://www.macrumors.com/how-to/save-safari-bookmark-web-app-iphone-home-screen/) · [heise](https://www.heise.de/en/news/iOS-26-and-iPadOS-26-Changed-web-app-behaviour-on-the-home-screen-10749652.html) |
| iOS 26 공유 버튼 위치 | 탭 배치가 "간단히(Compact)"면 `···`(페이지 메뉴) → 공유, "위/아래"면 공유 버튼이 바로 보임. 목록에 없으면 "더 보기" 또는 "동작 편집"에서 추가 | [Apple 지원: Safari 책갈피](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios) · [MacRumors](https://www.macrumors.com/how-to/save-safari-bookmark-web-app-iphone-home-screen/) |
| 공유 시트에 "홈 화면에 추가"가 없는 경우 | 앱 안 브라우저(카톡 등), 개인 정보 보호 브라우징, 동작 목록에서 빠진 경우 | [Apple Community](https://discussions.apple.com/thread/250662383) |
| 다른 브라우저 | iOS 16.4부터 크롬 등도 공유 메뉴에서 홈 화면에 추가 가능 | [PWA Directory](https://pwa.directory/blog/install-pwa-on-iphone-safari) |

`navigator.share()`가 연 공유 시트에서 "홈 화면에 추가"가 빠지는 이유를 공식 문서로 설명한 글은 찾지 못했습니다. 실기기 확인 결과가 근거입니다.
**추측:** 홈 화면에 추가는 사파리 자신의 동작이라, 웹페이지가 공유를 부탁할 때는 넣지 않는 것으로 보입니다.

## ② 구성 프로파일(.mobileconfig)의 Web Clip

| 항목 | 내용 | 출처 |
|---|---|---|
| 무엇 | `com.apple.webClip.managed` 페이로드. 이름·아이콘·URL을 넣으면 홈 화면에 아이콘이 생김. "전체 화면"을 켜면 주소창 없이 웹 앱처럼 열림. "지울 수 없게" 옵션도 있음(그러면 프로파일을 지워야만 사라짐) | [Apple 개발자: WebClip](https://developer.apple.com/documentation/devicemanagement/webclip) · [Apple 배포 가이드: Web Clips](https://support.apple.com/guide/deployment/depbc7c7808/web) |
| 실제 절차 | 사이트에서 내려받으면 사파리가 허용 여부를 묻고, **설정 앱으로 가서** "프로파일이 다운로드됨" → 설치 → 암호 → 설치. **8분 안에 설치 안 하면 자동 삭제**, 한 번에 하나만 대기 | [Apple 지원 102400](https://support.apple.com/en-us/102400) |
| 막히는 경우 | **도난 기기 보호**가 켜져 있으면 익숙한 장소가 아닐 때 먼저 그걸 꺼야 설치 가능 | [Apple 지원 102400](https://support.apple.com/en-us/102400) |
| 경고 화면 | 서명 안 한 프로파일에는 "서명되지 않음" 경고가 뜬다고 생성기 업체들이 설명(애플 문서에서 문구는 못 찾음) | [SafeClip](https://safeclip.online/) (업체 설명) |
| 알림 | **추측:** 이렇게 만든 아이콘에서 웹 푸시가 되는지는 확인하지 못했습니다. iOS 웹 푸시는 홈 화면 웹 앱에서만 되는데, Web Clip 전체 화면이 같은 취급인지는 공식 문서에서 찾지 못했습니다 | — |

판단: 탭 수가 그림 안내의 2배를 넘고, 설정 앱을 오가며 기기 암호까지 넣어야 합니다. "프로파일 설치"는 회사 기기 관리나 VPN에 쓰는 기능이라 커플 앱 사용자에게는 수상해 보입니다. **추천하지 않습니다.**

## ③ App Clip

| 항목 | 내용 | 출처 |
|---|---|---|
| 뜨는 방식 | 사이트에 스마트 앱 배너(`apple-itunes-app` 메타에 `app-clip-bundle-id`)를 달면 사파리에서 배너 탭 한 번으로 열림. iOS 15+는 카드로도 표시. **메시지 앱으로 받은 링크는 탭하면 바로 App Clip이 열림**(다른 앱의 링크는 사파리 → 배너) | [Apple: 웹사이트·메시지에서 열기](https://developer.apple.com/documentation/appclip/supporting-invocations-from-your-website-and-the-messages-app) · [Apple 포럼 653607](https://developer.apple.com/forums/thread/653607) |
| 홈 화면 | **App Clip은 홈 화면에 나타나지 않고**, 안 쓰면 시스템이 지움. 애플 지원 문서는 **30일 미사용 시 삭제**, 데이터는 10일(애플 로그인 시 30일) | [Apple 개발자: App Clips](https://developer.apple.com/documentation/appclip) · [Apple 지원 102093](https://support.apple.com/en-al/102093) |
| 알림 | 실행 후 **8시간** 동안은 허락 없이 알림 가능(`NSAppClipRequestEphemeralUserNotification`). 더 길게는 사용자 허락 필요 | [Apple: App Clip 알림](https://developer.apple.com/documentation/appclip/enabling-notifications-in-app-clips) |
| 필요한 것 | Apple 개발자 계정($99/년). App Clip은 **본 앱과 함께 제출**하고, 배너는 App Clip이 든 앱 버전이 출시된 뒤에 나타남(애플 엔지니어 포럼 답변). 사이트의 `apple-app-site-association`에 `appclips` 항목 필요 | [Apple 포럼 653607](https://developer.apple.com/forums/thread/653607) · [expo-apple-targets 안내](https://www.mintlify.com/EvanBacon/expo-apple-targets/targets/app-clips) (2차) |
| 크기 | 실물 코드(QR·NFC)로 열리는 건 15MB, 링크로만 여는 건 iOS 17+에서 더 큼(출처마다 50MB/100MB로 다름) | [Apple 포럼 740061](https://developer.apple.com/forums/thread/740061) · [Newly](https://newly.app/guides/app-clips) (2차) |

판단: "링크 한 번에 열림"은 매력적이지만, TT의 목적(매일 열고 알림을 오래 받기)과 맞지 않습니다. 홈 화면에 남지 않고 알림도 8시간 한정입니다.
App Clip을 만들려면 ④의 앱스토어 앱이 먼저 있어야 하므로, 할 거라면 ④ 다음 단계입니다.
**추측:** Capacitor 앱에 App Clip 타깃을 붙이려면 네이티브(Swift) 코드가 따로 필요합니다. 지금처럼 Mac 없이 CI만으로 개발하기는 어렵습니다.

## ④ 앱스토어 앱 — `ios/`(Capacitor)는 이미 있음, 출시까지 남은 일

사파리 스마트 앱 배너(`<meta name="apple-itunes-app" content="app-id=…">`)를 달면 사파리 위쪽에 "보기/받기"가 뜹니다.
홈 화면 아이콘까지 **2~3번 탭**으로, 조사한 길 가운데 가장 짧습니다. 출처: [Smart App Banners 안내](https://www.david-smith.org/blog/2012/09/20/implementing-smart-app-banners/) (2차).
배너는 사파리에서만 뜹니다. 카톡 안 화면에서는 지금처럼 사파리로 내보내는 단계가 먼저 필요합니다.

`docs/LAUNCH.md` 3절·`docs/APPS.md` 기준으로 남은 일:

| # | 남은 일 | 누가 | 비고 |
|---|---|---|---|
| 1 | **Apple 개인 계정** ($99/년, 신분증 인증) | 사장님 | LAUNCH 3절 10번. 개인사업자라 판매자 이름은 개인 이름으로 나옴 |
| 2 | **앱 안 로그인 수단** — 지금 iOS 앱은 구글 로그인을 숨겨서 **들어갈 방법이 없음** | Claude + 사장님 | 구글을 넣으면 심사 4.8에 따라 "개인정보를 덜 받는 로그인"(사실상 Sign in with Apple)도 같이 필요. 서버에 애플 ID 토큰 확인 추가 필요. 출처: [4.8 반려 사례](https://developer.apple.com/forums/thread/765145) |
| 3 | APNs 키(.p8) → Vercel `APNS_*` 환경변수 | 사장님 | APPS.md 3절 |
| 4 | App Store Connect 앱 만들기, API 키, 서명 인증서용 비공개 저장소(match), GitHub 시크릿 7개 | 사장님 | APPS.md 5절 |
| 5 | **첫 iOS 빌드** — 한 번도 안 돌려 봄. 첫 실행 오류를 보고 고쳐야 함 | Claude | APPS.md "아직 모르는 것" |
| 6 | 1024px 아이콘, 6.9"/6.5" 스크린샷(만들어 둠), 앱 개인정보 설문, 심사용 계정 | 사장님 | 심사용 계정은 구글 전용이 되면서 새로 필요(LAUNCH 2절) |
| 7 | 심사 — **4.2 최소 기능**(웹을 감싼 앱) 반려 위험 | — | 네이티브 알림이 그 몫을 한다는 게 지금 설계. 심사관은 비행기 모드에서 빈 화면이 뜨는지도 본다고 함. 출처: [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper) (업체 글). LAUNCH 0절도 "4.2 거절 위험" 때문에 앱스토어를 나중으로 미룬 상태 |
| 8 | 스마트 앱 배너 메타 태그를 `public/index.html`에 | Claude | 출시 후 app-id가 나오면 한 줄 |

**추측:** 1~6을 한 번에 진행하면 계정 승인(하루~이틀)과 첫 빌드 오류 수정에 시간이 걸립니다. 심사 1~2회까지 합치면 2~4주 정도로 봅니다.

## ⑤ 다른 서비스들이 아이폰 웹 설치를 짧게 만든 방법

| 방법 | 내용 | 출처 |
|---|---|---|
| 그림·글 안내 오버레이 | 아이폰에서만 "공유 → 홈 화면에 추가"를 그림으로 보여 줌. 오픈소스 `pwa-install-prompt`는 처음 왔거나 90일 만에 온 사람에게만 띄움 | [JacobDB/pwa-install-prompt](https://github.com/JacobDB/pwa-install-prompt) |
| 설치 안내가 곧 전환 지점 | iOS는 설치 이벤트가 없으니 안내 화면 품질이 설치율을 정함. 화면에 보이는 대로 찾으라고 안내(iOS 버전마다 문구가 바뀜) | [web.dev: Installation](https://web.dev/learn/pwa/installation) · [openpwa.net](https://openpwa.net/reference/installation/ios-add-to-home-screen/) |
| 앱 안 브라우저 감지 | 카톡·인스타 안에서는 메뉴가 없으니 사파리로 내보내기 먼저 | [PWA iOS 가이드](https://www.mobiloud.com/blog/progressive-web-apps-ios/) (업체 글) — TT는 이미 함 |
| 공유 버튼 가리키기 | 화살표로 공유 버튼 위치를 가리키는 방식. TT가 이미 하고 있음(↓). iOS 26은 탭 배치에 따라 공유 버튼이 `···` 안에 들어갈 수 있어 화살표가 틀릴 수 있음 | [Apple 지원](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios) |

이름 있는 큰 서비스가 아이폰 웹 설치를 원터치로 만든 사례는 **찾지 못했습니다.** 조사한 모든 자료가 "원터치는 불가능하고 안내만 할 수 있다"고 말합니다.

## 그래서 TT에서 할 일 (코드는 아직 안 바꿈)

1. **바로:** 설치 제안 창의 아이폰 버튼이 `navigator.share` 대신 **그림 안내(`#install-guide`)를 바로 띄우게** 바꿉니다. 지금은 공유 시트가 먼저 열리는데, 거기엔 "홈 화면에 추가"가 없어서 한 번 헛걸음합니다.
2. **바로:** 그림 안내 1단계를 iOS 26 기준으로 다듬습니다. "아래 **공유** 버튼, 안 보이면 주소창 옆 **···** → 공유", 목록에 없으면 "**더 보기**". ↓ 화살표는 탭 배치를 알 수 없으니 "아래쪽" 정도로만 가리킵니다.
3. **바로:** iOS 26에서는 추가 창의 "웹 앱으로 열기"가 켜져 있는지만 보면 된다고 3단계에 한 줄 덧붙입니다. **추측:** 끄면 일반 책갈피라 알림이 안 올 것입니다. 웹 푸시는 웹 앱 화면에서만 된다는 독자 댓글뿐이고, 공식 문서로는 확인하지 못했습니다([Michael Tsai](https://mjtsai.com/blog/2025/10/03/web-apps-in-ios-26/)).
4. **나중에(앱스토어):** ④의 1~8 순서로 진행합니다. 출시되면 사파리 배너가 "받기" 한 번을 만들어 줍니다.

1~3은 사장님이 말씀하시면 하겠습니다.
