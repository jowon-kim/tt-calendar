/* 화면과 서버가 같이 쓰는 한도. 예전엔 두 곳에 따로 적혀 있어서, 하나만 고치면
   화면은 올려도 된다는데 서버가 퇴짜 놓는 일이 생겼습니다.
   언어팩(i18n/*.js)처럼 전역에 자기를 올리는 스크립트라, 화면은 <script>로,
   서버는 import 한 줄로 읽습니다 (api/photos/index.js). */
globalThis.DIARY_LIMITS = {
  photos: 30,              // 달력 하나에 올릴 수 있는 사진 수
  photoBytes: 300 * 1024,  // 한 장의 크기. 화면에서 256px로 줄여 보내니 넉넉합니다
  // 일정에 고를 수 있는 색. 고르지 않으면(null) 누구 일정인지의 색을 씁니다. 실제 색은 style.css [data-color]
  eventColors: ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'],
};
