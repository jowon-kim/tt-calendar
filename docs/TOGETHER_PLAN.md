# "우리" 탭 — 커플 앱 기능 몰아 넣기 (2026-10-27)

사용자: "걍 싹다 쑤셔넣어" + "지도도 넣고" + "위치공유도 넣고". 경쟁 앱(비트윈·유니플·사랑한줌·사이사이·Paired·Lovewick) 기능 조사 결과에서
채팅·홈 화면 위젯만 뺀다 (채팅 = 카톡과 겹치고 몇 주짜리, 위젯 = 웹앱으로 불가).

## 원칙
- 서버 함수는 **하나 더**: `api/together.js` (지금 9개, 한도 12 — test.mjs 가 센다). `?kind=` 로 나눈다
- 모든 쿼리는 `couple_id` 로 거른다. 두 커플 격리 테스트(test.mjs ~1150)에 새 창구를 다 넣는다
- 데이터는 각자 띄운 사본의 DB 에만 — 위치는 **둘 다 켜야** 보이고, 마지막 위치 하나만, 끄면 지운다
- 문구는 ko·en 먼저, 나머지 7개 언어는 en 으로 떨어지게 (i18n 검사 확인)
- 단계마다 `npm test` 통과 후 main 에 커밋·푸시

## 단계
1. [x] DB: `items` (kind: bucket·ledger·food·culture·diary·place, title, memo, done, amount, day, lat, lng, photo_id, by) · `answers` (qday, member, text) · `locations` (member, lat, lng, at) · `nudges` (member, at)
2. [x] API `api/together.js`: items CRUD · 오늘의 질문(둘 다 답해야 상대 답 공개) · 콕 찌르기(하루 3번, 푸시) · 위치 켜기/끄기/올리기
3. [x] 화면: 하단/설정 옆 "우리" 탭 — 오늘의 질문 · 일기(사진) · 앨범 · 버킷리스트 · 가계부 · 맛집 · 문화 · 지도(장소 핀 + 서로 위치) · 콕 찌르기
4. [x] cron: 저녁 질문 알림, 아침 요약에 "1년 전 오늘"(일기)
5. [x] 지도: Leaflet + OpenStreetMap 타일 (키·비용 없음) — README '외부 요청'에 타일 서버 추가
6. [x] 테스트(통합·화면·격리) · README 기능 목록·개인정보 절 · privacy.html(위치 항목) 갱신

## 상태 (2026-10-27 밤 — 계획 전부 끝)
- c522e28 cron: 20시 질문(안 한 사람만, 둘 다 했으면 조용) · 8시 모음에 "1년 전 오늘"(일정 없으면 따로) · photos.purpose 로 일기 사진 분리(300장·900KB), 일기 지우면 사진도
- 6234674 README·privacy(위치·일기·OSM/unpkg, 시행일 10-27) · 탈퇴 시 그 자리의 위치·답·콕 삭제(떠난 사람 위치가 상대 지도에 남던 버그) · 콕 기록 하루 보관
- 6538bae 9개 언어: 화면 문구 언어팩 together.* (그릴 때마다 읽음), 질문 30개 7개 언어
- 로컬 크롬 확인: ja/ko 전환, 지도 타일 표시. 포트폴리오(서류/이직/portfolio/index.html) TT 절 반영 — PDF는 아직 옛 내용
- 테스트 710 (415/19/39/221/16)

## 2026-10-27 밤 2차 — 다시 만들기 (2fdeb78)
사용자: "반응형·고도화 전혀 안 됨, 지도·모든 탭 안 예쁨, 데스크탑에서도 모바일 화면으로, 사용법·언어별 최신화, QA까지".
- 앱 전체 폰 폭(--frame 440px), '우리' 탭 새 디자인(아래 탭바·질문 카드·말풍선·폴라로이드·진행 막대·월별 가계부·별점)
- 지도 = MapLibre + OpenFreeMap (CARTO 는 이제 키가 필요해서 버림 — "API KEY REQUIRED" 찍힘). 테마 색으로 칠하고 지명은 화면 언어
- 지난 질문(60일) · 별점(items.rating) · 모든 줄 고치기 · 두 번 눌러 지우기 · 실패 토스트
- 앱 안 사용법 6단계, 소개 페이지 기능·FAQ, README 그림, privacy, AGENTS·GUIDE — 9개 언어
- 로컬 크롬 QA(데모 커플 미나·레오, scratchpad seed.mjs): 모든 탭의 추가·수정·삭제·체크·별점·사진·앨범·월 이동·지도 장소 추가·칩 이동·공유 표시·콕 제한·밤 테마·영어·상대 화면 — 전부 통과

남은 건 실기기 확인뿐: 진짜 폰에서 위치 공유 권한·저녁 8시 질문 알림이 오는지.
로컬 확인법: `node tools/dev-local.mjs` → http://127.0.0.1:8787, 콘솔에서
`signInWithGoogle(await (await fetch('/__dev/token?sub=a1&name=미나')).text())` 로 로그인 → 위쪽 바 하트 버튼.
