/* 오늘의 질문 (10/27 "우리" 탭). 날짜마다 차례로 하나 — 둘 다 같은 날 같은 질문을 받습니다.
   언어팩과 같은 9개 언어 — 모르는 언어는 영어. 질문을 늘리려면 모든 언어의 같은 자리에 넣으세요 (test.mjs 가 개수를 맞춰 봅니다). */
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

const JA = [
  '初めて会った日、お互いの第一印象は？', '最近いちばん感謝した瞬間は？', 'いつか一緒に行きたい場所は？',
  '相手に言われていちばん心に残っている言葉は？', 'ふたりだけが知っている面白い思い出をひとつ', '今いちばん食べたいデートごはんは？',
  '10年後のふたりはどうなっていると思う？', '相手のくせでかわいいと思うのは？', '最近さみしかったことはある？',
  'ふたりが似てきたと感じるところは？', '次の記念日にしたいことは？', 'つらいとき相手にしてほしいことは？',
  '一緒に見たい映画やドラマは？', 'ふたりの関係を一曲で表すなら？', '今日いちばんよかった瞬間は？',
  '相手から学びたいところは？', '一緒に始めてみたい新しい趣味は？', 'いちばんドキドキしたデートは？',
  '相手に望む小さなことをひとつ', 'ふたりだけのルールをひとつ作るなら？', '子どものころの夢は何だった？',
  'いちばん落ち着ける瞬間はいつ？', '相手がいちばんかっこよく見えた瞬間は？', '今週のデートの予定は？',
  'お互いの好きなところを三つ', '一緒に暮らすなら大事にしたいことは？', 'いちばん心に残っているプレゼントは？',
  '最近ふと相手を思い出した瞬間は？', '初めてけんかした理由、覚えてる？', '今、相手に伝えたいこと',
];
const ZH = [
  '第一次见面时，你们对彼此的第一印象是什么？', '最近最感激的时刻是什么？', '以后最想一起去的地方是哪里？',
  '对方说过的话里，你记得最深的是哪句？', '一段只有你们俩知道的好笑回忆', '现在最想吃的约会美食是什么？',
  '十年后的我们会是什么样子？', '对方的哪个小习惯很可爱？', '最近有没有让你难过的事？',
  '你觉得我们哪里越来越像了？', '下一个纪念日想做什么？', '难过的时候最希望对方为你做什么？',
  '想一起看的电影或剧是什么？', '如果用一首歌形容我们的关系，会是哪首？', '今天最美好的时刻是什么？',
  '你想从对方身上学到什么？', '想一起尝试的新爱好是什么？', '哪次约会最让你心动？',
  '一个想对彼此提出的小愿望', '如果定一条只属于我们的规则，会是什么？', '小时候的梦想是什么？',
  '什么时候你觉得最自在？', '对方什么时候最帅气／最迷人？', '这周我们的约会计划是什么？',
  '说出对方的三个优点', '如果住在一起，想守住的是什么？', '印象最深的礼物是什么？',
  '最近什么时候突然想起了对方？', '还记得我们第一次吵架是因为什么吗？', '现在最想对对方说的话',
];
const ES = [
  '¿Cuál fue vuestra primera impresión el uno del otro?', '¿Cuándo te sentiste más agradecido últimamente?', '¿Adónde queréis ir juntos algún día?',
  '¿Qué es lo más memorable que te ha dicho tu pareja?', 'Un recuerdo gracioso que solo conocéis vosotros', '¿Qué comida de cita te apetece ahora mismo?',
  '¿Dónde estaremos dentro de diez años?', '¿Qué manía de tu pareja te parece adorable?', '¿Algo te ha dolido últimamente?',
  '¿En qué nos estamos pareciendo?', '¿Qué quieres hacer en nuestro próximo aniversario?', '¿Qué te ayuda más cuando lo estás pasando mal?',
  '¿Qué película o serie deberíamos ver juntos?', 'Si nuestra relación fuera una canción, ¿cuál sería?', '¿Cuál fue el mejor momento de hoy?',
  '¿Qué te gustaría aprender de tu pareja?', '¿Qué nuevo hobby deberíamos probar juntos?', '¿Qué cita te dio más mariposas?',
  'Un pequeño deseo para el otro', 'Si creáramos una regla solo nuestra, ¿cuál sería?', '¿Qué querías ser de pequeño?',
  '¿Cuándo te sientes más a gusto?', '¿Cuándo te pareció tu pareja más increíble?', '¿Cuál es nuestro plan de cita esta semana?',
  'Tres cosas que te encantan del otro', '¿Qué deberíamos cuidar si vivimos juntos?', '¿Cuál es el regalo más especial que has recibido?',
  '¿Cuándo pensaste en tu pareja de repente por última vez?', '¿Te acuerdas de por qué discutimos la primera vez?', 'Algo que quieras decirle a tu pareja ahora mismo',
];
const FR = [
  'Quelle a été votre première impression l’un de l’autre ?', 'Quand t’es-tu senti le plus reconnaissant ces derniers temps ?', 'Où voulez-vous aller ensemble un jour ?',
  'Quelle est la phrase de ton partenaire qui t’a le plus marqué ?', 'Un souvenir drôle que vous seuls connaissez', 'Quel plat de rendez-vous te fait envie en ce moment ?',
  'Où en serons-nous dans dix ans ?', 'Quelle habitude de ton partenaire trouves-tu mignonne ?', 'Quelque chose t’a-t-il blessé récemment ?',
  'En quoi commençons-nous à nous ressembler ?', 'Que veux-tu faire pour notre prochain anniversaire ?', 'Qu’est-ce qui t’aide le plus quand ça ne va pas ?',
  'Quel film ou quelle série regarder ensemble ?', 'Si notre relation était une chanson, laquelle ?', 'Quel a été le meilleur moment de la journée ?',
  'Qu’aimerais-tu apprendre de ton partenaire ?', 'Quel nouveau loisir essayer ensemble ?', 'Quel rendez-vous t’a donné le plus de papillons ?',
  'Un petit souhait pour l’autre', 'Si on créait une règle rien qu’à nous, laquelle ?', 'Que rêvais-tu de devenir enfant ?',
  'Quand te sens-tu le plus à l’aise ?', 'Quand ton partenaire t’a-t-il semblé le plus incroyable ?', 'Quel est notre plan de sortie cette semaine ?',
  'Trois choses que tu aimes chez l’autre', 'Que faudrait-il préserver si on vivait ensemble ?', 'Quel est le cadeau le plus marquant que tu aies reçu ?',
  'Quand as-tu pensé à ton partenaire sans raison pour la dernière fois ?', 'Te souviens-tu pourquoi on s’est disputés la première fois ?', 'Quelque chose que tu veux dire à ton partenaire maintenant',
];
const DE = [
  'Was war euer erster Eindruck voneinander?', 'Wann warst du zuletzt besonders dankbar?', 'Wohin wollt ihr irgendwann zusammen reisen?',
  'Welcher Satz deines Partners ist dir am meisten im Gedächtnis geblieben?', 'Eine lustige Erinnerung, die nur ihr zwei kennt', 'Worauf hast du für ein Date gerade Hunger?',
  'Wo werden wir in zehn Jahren sein?', 'Welche Angewohnheit deines Partners findest du süß?', 'Hat dich in letzter Zeit etwas gekränkt?',
  'Worin werden wir uns ähnlicher?', 'Was möchtest du an unserem nächsten Jahrestag machen?', 'Was hilft dir am meisten, wenn es dir schlecht geht?',
  'Welchen Film oder welche Serie sollten wir zusammen schauen?', 'Wenn unsere Beziehung ein Lied wäre, welches?', 'Was war der schönste Moment heute?',
  'Was möchtest du von deinem Partner lernen?', 'Welches neue Hobby sollten wir zusammen ausprobieren?', 'Bei welchem Date hattest du die meisten Schmetterlinge?',
  'Ein kleiner Wunsch an den anderen', 'Wenn wir eine Regel nur für uns hätten, welche?', 'Was wolltest du als Kind werden?',
  'Wann fühlst du dich am wohlsten?', 'Wann fandest du deinen Partner am beeindruckendsten?', 'Was ist unser Date-Plan für diese Woche?',
  'Drei Dinge, die du am anderen liebst', 'Was sollten wir bewahren, wenn wir zusammenwohnen?', 'Welches Geschenk ist dir am meisten in Erinnerung?',
  'Wann hast du zuletzt ganz plötzlich an deinen Partner gedacht?', 'Weißt du noch, worüber wir zum ersten Mal gestritten haben?', 'Etwas, das du deinem Partner gerade sagen willst',
];
const PT = [
  'Qual foi a primeira impressão de vocês um do outro?', 'Quando você se sentiu mais grato ultimamente?', 'Aonde vocês querem ir juntos um dia?',
  'Qual foi a coisa mais marcante que seu par já te disse?', 'Uma lembrança engraçada que só vocês dois conhecem', 'Que comida de encontro você está com vontade agora?',
  'Onde estaremos daqui a dez anos?', 'Qual mania do seu par você acha fofa?', 'Alguma coisa te magoou ultimamente?',
  'Em que estamos ficando parecidos?', 'O que você quer fazer no nosso próximo aniversário?', 'O que mais te ajuda quando você está mal?',
  'Que filme ou série devemos ver juntos?', 'Se nosso relacionamento fosse uma música, qual seria?', 'Qual foi o melhor momento de hoje?',
  'O que você gostaria de aprender com seu par?', 'Que novo hobby devemos experimentar juntos?', 'Qual encontro te deu mais frio na barriga?',
  'Um pequeno desejo para o outro', 'Se criássemos uma regra só nossa, qual seria?', 'O que você sonhava ser quando criança?',
  'Quando você se sente mais à vontade?', 'Quando seu par pareceu mais incrível?', 'Qual é o nosso plano de encontro esta semana?',
  'Três coisas que você ama no outro', 'O que devemos preservar se morarmos juntos?', 'Qual o presente mais marcante que você já ganhou?',
  'Quando foi a última vez que pensou no seu par do nada?', 'Lembra por que brigamos pela primeira vez?', 'Algo que você quer dizer ao seu par agora',
];
const RU = [
  'Какое первое впечатление вы произвели друг на друга?', 'Когда ты в последнее время особенно был(а) благодарен(на)?', 'Куда вы хотите когда-нибудь поехать вместе?',
  'Какие слова партнёра тебе запомнились больше всего?', 'Смешное воспоминание, которое знаете только вы двое', 'Какую еду для свидания тебе сейчас хочется?',
  'Какими мы будем через десять лет?', 'Какая привычка партнёра кажется тебе милой?', 'Тебя что-нибудь обидело в последнее время?',
  'В чём мы становимся похожи?', 'Что ты хочешь сделать в нашу следующую годовщину?', 'Что тебе больше всего помогает, когда тяжело?',
  'Какой фильм или сериал нам посмотреть вместе?', 'Если бы наши отношения были песней, то какой?', 'Какой момент сегодня был лучшим?',
  'Чему ты хотел(а) бы научиться у партнёра?', 'Какое новое хобби нам попробовать вместе?', 'От какого свидания больше всего бабочек в животе?',
  'Одно маленькое желание друг для друга', 'Если бы у нас было одно правило только для нас, какое?', 'Кем ты мечтал(а) стать в детстве?',
  'Когда тебе спокойнее всего?', 'Когда партнёр казался тебе самым потрясающим?', 'Какие у нас планы на свидание на этой неделе?',
  'Три вещи, которые ты любишь в другом', 'Что нам стоит сохранить, если будем жить вместе?', 'Какой подарок запомнился тебе больше всего?',
  'Когда ты в последний раз внезапно подумал(а) о партнёре?', 'Помнишь, из-за чего мы поссорились в первый раз?', 'Что ты хочешь сказать партнёру прямо сейчас',
];

/** day = 'YYYY-MM-DD' → 그날의 질문 (같은 날이면 늘 같은 질문) */
export function questionFor(day, locale = 'en') {
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  const i = ((n % KO.length) + KO.length) % KO.length;
  return (BY_LANG[String(locale).toLowerCase().split('-')[0]] || EN)[i];
}

const BY_LANG = { ko: KO, en: EN, ja: JA, zh: ZH, es: ES, fr: FR, de: DE, pt: PT, ru: RU };

export const QUESTION_COUNT = KO.length;
