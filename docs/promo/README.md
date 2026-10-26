# 알리기 글 초안 (2026-10-26)

`LAUNCH.md` 0절 "알리기"용. **게시는 사장님이 직접** 합니다. 모두 초안이라 사장님 말투로 고쳐 쓰셔도 됩니다.

| 곳 | 파일 | 언어 | 어디에 |
|---|---|---|---|
| Reddit | [reddit.md](reddit.md) | 영어 | r/LongDistance (먼저 모드에게 물어보기) · r/SideProject |
| Product Hunt | [producthunt.md](producthunt.md) | 영어 | 제품 등록 + 메이커 첫 댓글 |
| OKKY | [okky.md](okky.md) | 한국어 | 홍보·광고 게시판 |
| 디스콰이엇 | [disquiet.md](disquiet.md) | 한국어 | 프로덕트 등록 + 메이커로그 |

## 쓴 원칙

- **사실만.** README·소개 페이지(`landing-content.mjs`)에 있는 것만 썼습니다. 만든 계기 같은 사장님 이야기는 제가 모르니
  `[사장님 이야기 …]` 빈칸으로 남겼습니다 — 채우거나 지우세요. "최고의", "혁신적인" 같은 말, 사용자 수,
  후기는 넣지 않았습니다(아직 없음)
- **만든 사람이라고 먼저 밝힙니다.** 숨기면 어느 곳이든 광고로 보고 지웁니다
- **약점도 적습니다.** 베타라는 것, 아이폰은 홈 화면에 추가해야 알림이 온다는 것, 달력 하나에 시간대가 하나라는 것
- **"추천·좋아요 눌러 주세요"는 쓰지 않습니다.** Product Hunt는 이걸 규칙으로 금지합니다
- 개인 정보(이름·연락처)는 초안에 넣지 않았습니다. 필요하면 게시할 때 사장님이 판단해서 넣으세요

## 각 곳의 규칙 — 확인한 것과 못 한 것

클라우드 세션에서는 reddit.com·producthunt.com·okky.kr 페이지가 직접 열리지 않아서, **검색 결과로만 확인했습니다.**
게시 전에 아래 "게시 전 확인"을 꼭 보세요.

**Product Hunt** — 공식 도움말(Launch Guide·Community Guidelines)이 **추천(upvote)을 대놓고 부탁하거나, 추천이 조건인
이벤트를 여는 것**을 금지하고, 어기면 순위에서 빠지거나 계정이 정지될 수 있다고 합니다. 대신 "피드백을 달라", "알려 달라"는
괜찮다고 합니다. 메이커가 첫 댓글로 만든 이유를 적는 것이 관례입니다.
- 출처: [Community Guidelines](https://help.producthunt.com/en/articles/3615694-community-guidelines) ·
  [Launch Guide](https://help.producthunt.com/en/articles/17350772-launch-guide) ·
  [Sharing your launch](https://www.producthunt.com/launch/sharing-your-launch)
- 게시 전 확인: 태그라인·설명 글자 수 제한(등록 화면에 나옴), 이미지 크기

**OKKY** — 운영정책이 "용도에 맞지 않는 게시물은 무통보 이동·비공개", "개인·단체의 이익을 위한 상업적 내용"을 제재 대상으로
둡니다. 제품 소개는 **홍보·광고 게시판**에 올려야 합니다(사는얘기·Q&A에 올리면 지워짐). 무료라도 자기 서비스 소개는 홍보입니다.
- 출처: [운영정책](https://okky.kr/policies/operation-policy) · [회원&게시글 관리 정책](https://okky.kr/articles/392686) ·
  [홍보·광고 게시판](https://okky.kr/events/promote)
- 게시 전 확인: 홍보·광고 게시판 공지("건전한 홍보&광고 게시판 운영을 위해…")의 세부 규칙(올리는 간격 등)

**Reddit r/LongDistance** — 규칙 원문을 찾지 못했습니다. Reddit은 게시판(서브레딧)마다 규칙이 다르고, 많은 곳이 자기 제품
홍보를 아예 금지하거나 정해진 주간 스레드에서만 허용합니다. 계정 나이·카르마가 모자라면 자동으로 지워지기도 합니다.
- 출처(일반론): [Reddit self-promotion rules 정리](https://www.conbersa.ai/learn/reddit-self-promotion-rules)
- 게시 전 확인: https://www.reddit.com/r/LongDistance/about/rules 를 직접 열어 보기. 홍보가 금지거나 애매하면
  `reddit.md`의 **모드에게 보내는 글**을 먼저 보내고, 허락을 받은 뒤에 올립니다. 허락이 없으면 r/SideProject 쪽만

**디스콰이엇** — 공식 가이드라인 원문을 찾지 못했습니다. 메이커가 자기 프로덕트를 등록하고 만드는 과정을 기록(메이커로그)하는
곳이라, 자기 제품 소개가 그곳의 원래 용도입니다.
- 출처: [요즘IT 소개](https://yozm.wishket.com/magazine/product-valley/products/disquiet/)
- 게시 전 확인: 프로덕트 등록 화면의 필수 항목(로고·대표 이미지·카테고리)

## 같이 쓸 자료 (모두 레포에 있음)

- 데모 영상 25초: `docs/demo/demo.mp4`, `docs/demo/demo.gif` (실서비스의 데모 커플)
- 스크린샷: `public/screenshots/*.webp`, `docs/handoff-shots/07-calendar-shared.png`
- 공유 이미지: `public/landing/og.png`
- 주소: https://tt-calendar.vercel.app (영어 소개 `/en/`, 한국어 소개 `/ko/`)

## 올리는 순서 제안

1. 디스콰이엇·OKKY (한국어, 반응이 부드러워 문장을 다듬기 좋음)
2. Reddit — 모드 답을 받은 뒤
3. Product Hunt — 가장 마지막. 하루 한 번뿐이라 위에서 받은 지적을 고친 뒤에. 올린 날은 댓글에 바로 답할 수 있게 비워 두기
