// 공용 타입 정의 (spec.md / 개발스펙.md 기준)

export type Sender = '티쳐' | '학생';

/** 회화 난이도 (메인 화면에서 선택) */
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Message {
  sender: Sender;
  /** 항상 영어. 화면 말풍선과 TTS 는 무조건 이 영어 텍스트만 사용한다 */
  msg: string;
  /**
   * msg 의 한국어 번역.
   * 화면에는 절대 표시하지 않고, 쉬움/중간 난이도에서만 스피커로 읽어준다.
   * 어려움 난이도면 null.
   */
  translation?: string | null;
}

/** IndexedDB value. key는 날짜 문자열 'yyyy-mm-dd'. */
export interface DailyRecord {
  /** 1단계에서 생성한 그날의 주제 */
  topic: string;
  /** 대화 메시지 목록 (시간순) */
  messages: Message[];
  /** messages 요약(100자 이내). 대화 당일엔 null, 이후 날짜 접속 시 lazy 생성 */
  summary: string | null;
}

/** 티쳐의 발화 한 덩어리 — 영어 원문 + 한국어 번역 쌍 */
export interface TeacherLine {
  /** 화면 표시·영어 TTS 에 쓰이는 영어 문장 */
  en: string;
  /** en 의 한국어 번역 (쉬움/중간에서 스피커로만 재생) */
  ko: string;
}

/** 답변 채점 결과 */
export interface EvalResult extends TeacherLine {
  /** 문법/의미상 적절한 답이면 true */
  correct: boolean;
  /**
   * 정답이면: 칭찬 + 이어질 다음 영어 질문 (en)
   * 오답이면: 무엇이 틀렸고 어떻게 말하면 좋은지 알려주는 영어 교정 (en)
   * 어느 쪽이든 en 은 영어, ko 는 그 영어의 한국어 번역.
   */
}

export type Screen = 'main' | 'chat' | 'history' | 'game';

/** 단어 맞추기 게임의 카드 한 장 (사용자가 미리 정의) */
export interface WordCard {
  /** 정답 영어 단어 (예: 'apple'). 소문자 권장 */
  answer: string;
  /**
   * 카드에 보여줄 그림.
   * - 이모지 문자열(예: '🍎') 이거나
   * - public 폴더 기준 이미지 경로(예: '/word-cards/apple.png')
   */
  image: string;
  /** 화면에 함께 보여줄 한국어 뜻 (선택) */
  ko?: string;
}
