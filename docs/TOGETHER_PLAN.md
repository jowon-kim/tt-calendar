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
4. [ ] cron: 저녁 질문 알림, 아침 요약에 "1년 전 오늘"(일기)
5. [x] 지도: Leaflet + OpenStreetMap 타일 (키·비용 없음) — README '외부 요청'에 타일 서버 추가
6. [ ] 테스트(통합·화면·격리) · README 기능 목록·개인정보 절 · privacy.html(위치 항목) 갱신
