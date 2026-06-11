// 전역 상수 및 환경 설정

/** 사용 AI 모델 (spec.md 고정 요구사항) */
export const MODEL = 'gpt-4.1-mini';

/** OpenAI API 키 (브라우저 직접 호출 — private 서비스 전제) */
export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? '';

/** API 키 설정 여부 */
export const hasApiKey = OPENAI_API_KEY.trim().length > 0;

/** 요약 최대 글자 수 */
export const SUMMARY_MAX_LEN = 100;

/** 질문/채점 생성 시 함께 보내는 최근 대화 메시지 수 (토큰 절약 + 컨텍스트 유지) */
export const RECENT_CONTEXT_SIZE = 10;

/** 학생이 몇 번 답할 때마다 주제를 한 단계 확장할지 (대화가 단조로워지지 않게) */
export const TOPIC_EXPAND_EVERY = 4;

/** 히스토리 페이지당 행 수 */
export const HISTORY_PAGE_SIZE = 5;

/** TTS/STT 언어 */
export const SPEECH_LANG = 'en-US';

/** 한국어 TTS 언어 (번역/교정 음성) */
export const KOREAN_LANG = 'ko-KR';

/** 난이도별 영어 TTS 재생 속도 (SpeechSynthesisUtterance.rate) */
export const DIFFICULTY_RATE: Record<import('./types').Difficulty, number> = {
  easy: 0.4,
  medium: 0.6,
  hard: 1.0,
};

/** 한국어 번역/교정을 읽어줄 속도 (난이도와 무관하게 또박또박) */
export const KOREAN_RATE = 0.95;

/** Date 객체를 'yyyy-mm-dd' 문자열로 변환 (로컬 타임존 기준) */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 오늘 날짜 키 */
export function todayKey(): string {
  return toDateKey(new Date());
}
