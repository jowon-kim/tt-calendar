/* 오늘의 질문 (10/27 "우리" 탭). 날짜마다 차례로 하나 — 둘 다 같은 날 같은 질문을 받습니다.
   한국어·영어만 두고, 다른 언어는 영어로 보입니다. 질문을 늘리려면 두 줄씩 같은 자리에 넣으세요. */
const KO = [
  '처음 만난 날, 서로의 첫인상은?', '요즘 가장 고마웠던 순간은?', '같이 꼭 가 보고 싶은 곳은?',
  '서로에게 들은 말 중 가장 기억에 남는 말은?', '우리만 아는 웃긴 기억 하나', '지금 가장 먹고 싶은 데이트 메뉴는?',
  '10년 뒤 우리는 어떤 모습일까?', '상대의 버릇 중 귀여운 것은?', '최근에 서운했던 일이 있다면?',
  '서로 닮아 간다고 느낀 점은?', '다음 기념일에 하고 싶은 것은?', '힘들 때 상대가 해 주면 좋은 것은?',
  '같이 보고 싶은 영화나 드라마는?', '우리 관계를 노래 한 곡으로 표현하면?', '오늘 하루 중 가장 좋았던 순간은?',
  '상대에게 배우고 싶은 점은?', '같이 해 보고 싶은 새로운 취미는?', '가장 설렜던 데이트는?',
  '서로에게 바라는 작은 것 하나', '우리 둘만의 규칙을 하나 만든다면?', '어릴 적 꿈은 무엇이었어?',
  '가장 편한 순간은 언제야?', '상대가 가장 멋져 보였던 순간은?', '이번 주 우리 데이트 계획은?',
  '서로의 장점 세 가지', '같이 살면 지키고 싶은 것은?', '가장 기억에 남는 선물은?',
  '최근에 상대 생각이 난 순간은?', '우리가 처음 싸웠던 이유 기억나?', '지금 상대에게 하고 싶은 말',
];
const EN = [
  'What was your first impression of each other?', 'When did you feel most thankful lately?', 'Where do you want to go together someday?',
  'What is the most memorable thing your partner ever said?', 'A funny memory only the two of you know', 'What date food are you craving right now?',
  'Where will we be in ten years?', 'Which of your partner’s habits is cute?', 'Has anything hurt your feelings lately?',
  'How are we becoming alike?', 'What do you want to do on our next anniversary?', 'What helps you most when you are having a hard time?',
  'Which film or series should we watch together?', 'If our relationship were a song, which one?', 'What was the best moment of today?',
  'What would you like to learn from your partner?', 'What new hobby should we try together?', 'Which date gave you the most butterflies?',
  'One small thing you wish for from each other', 'If we made one rule just for us, what would it be?', 'What did you dream of becoming as a kid?',
  'When do you feel most at ease?', 'When did your partner look most amazing?', 'What is our date plan this week?',
  'Three things you love about each other', 'What should we keep if we live together?', 'What is the most memorable gift you got?',
  'When did you last think of your partner out of the blue?', 'Do you remember why we first argued?', 'Something you want to tell your partner right now',
];

/** day = 'YYYY-MM-DD' → 그날의 질문 (같은 날이면 늘 같은 질문) */
export function questionFor(day, locale = 'en') {
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  const i = ((n % KO.length) + KO.length) % KO.length;
  return (String(locale).startsWith('ko') ? KO : EN)[i];
}

export const QUESTION_COUNT = KO.length;
