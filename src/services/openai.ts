// OpenAI 서비스 — 브라우저에서 직접 호출 (private 서비스 전제)
import OpenAI from 'openai';
import {
  MODEL,
  OPENAI_API_KEY,
  RECENT_CONTEXT_SIZE,
  SUMMARY_MAX_LEN,
  hasApiKey,
} from '../config';
import type { EvalResult, Message, TeacherLine } from '../types';

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

/** 6살 아이 눈높이 티쳐 역할의 공통 시스템 메시지 */
const TEACHER_SYSTEM =
  '너는 6살 한국인 아이에게 영어를 가르치는 친절하고 다정한 영어 선생님(티쳐)이야. ' +
  '아주 쉬운 단어와 짧은 문장만 사용하고, 항상 밝고 격려하는 말투를 써. ' +
  '진짜 사람처럼 자연스럽게 대화를 이어가는 것이 가장 중요해. ' +
  '이전에 이미 한 질문이나 문장 틀을 그대로 반복하지 말고, 매번 조금씩 새로운 단어·상황·이야기로 대화를 발전시켜. ' +
  '아이가 한 말을 "You said ..." 처럼 똑같이 따라 말하지 말고, 그 대답에 자연스럽게 반응한 뒤 새로운 이야기로 넘어가. ' +
  '네가 만드는 영어 스크립트는 TTS(음성 합성)로 그대로 소리내어 읽힌다. ' +
  '따라서 이모지, 이모티콘, 그림문자, 특수기호를 절대 사용하지 말고, ' +
  '소리내어 읽을 수 있는 일반 텍스트(영문자와 기본 문장부호)만 출력해.';

function assertKey() {
  if (!hasApiKey) {
    throw new Error(
      'OpenAI API 키가 설정되지 않았습니다. .env.local 에 VITE_OPENAI_API_KEY 를 추가하세요.',
    );
  }
}

/** 대화 메시지를 프롬프트용 텍스트로 직렬화 */
function renderHistory(messages: Message[]): string {
  if (messages.length === 0) return '(아직 대화 없음)';
  return messages.map((m) => `${m.sender}: ${m.msg}`).join('\n');
}

/** 1단계: 6살 아이용 랜덤 영어 회화 주제 생성 */
export async function generateTopic(): Promise<string> {
  assertKey();
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 1.1,
    messages: [
      { role: 'system', content: TEACHER_SYSTEM },
      {
        role: 'user',
        content:
          '오늘 6살 아이와 영어로 대화할 재미있는 주제를 딱 하나만 한국어로 짧게 정해줘. ' +
          '예: "과일 이름 맞추기", "동물원 구경". 다른 설명 없이 주제 이름만 출력해.',
      },
    ],
  });
  return res.choices[0]?.message.content?.trim() || '오늘의 영어 놀이';
}

/** 일정 턴마다 주제를 자연스럽게 확장/전환 (6살용 짧은 한국어 주제 라벨) */
export async function expandTopic(
  currentTopic: string,
  messages: Message[],
): Promise<string> {
  assertKey();
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 1.0,
    messages: [
      { role: 'system', content: TEACHER_SYSTEM },
      {
        role: 'user',
        content:
          `지금 주제는 "${currentTopic}" 이야.\n` +
          `최근 대화:\n${renderHistory(messages.slice(-RECENT_CONTEXT_SIZE))}\n\n` +
          '대화가 더 신선해지도록, 지금 주제와 자연스럽게 이어지면서 살짝 넓히거나 옆으로 확장한 ' +
          '새로운 주제를 딱 하나만 한국어로 짧게 정해줘. ' +
          '너무 동떨어지지 않게, 6살 아이가 이어서 이야기하기 좋은 주제로. ' +
          '지금 주제와 똑같이 적지 말고, 다른 설명 없이 주제 이름만 출력해.',
      },
    ],
  });
  return res.choices[0]?.message.content?.trim() || currentTopic;
}

/** 2단계: 티쳐의 다음 영어 질문 스크립트 생성 (영어 + 한국어 번역) */
export async function generateQuestion(
  topic: string,
  messages: Message[],
): Promise<TeacherLine> {
  assertKey();
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.8,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: TEACHER_SYSTEM },
      {
        role: 'user',
        content:
          `오늘의 주제는 "${topic}" 이야.\n` +
          `최근 대화:\n${renderHistory(messages.slice(-RECENT_CONTEXT_SIZE))}\n\n` +
          '아이에게 건넬 다음 영어 질문을 한 문장으로 만들어줘. 6살이 이해할 만큼 아주 쉽게.\n' +
          '위 대화에서 이미 한 질문이나 문장 틀과 겹치지 않는, 한 걸음 나아간 새로운 질문이어야 해.\n' +
          '같은 주제 안에서도 매번 다른 하위 소재(세부 사물·상황·장소·인물)를 골라 질문을 다양하게 만들어.\n' +
          'en 에는 그 영어 질문을, ko 에는 en 의 한국어 번역을 넣어줘.\n' +
          'en, ko 모두 TTS로 그대로 읽히니 이모지·이모티콘·특수기호 없이 작성해.\n' +
          '반드시 다음 JSON 형식으로만 답해: {"en": string, "ko": string}',
      },
    ],
  });
  return parseTeacherLine(
    res.choices[0]?.message.content,
    'Hello! How are you today?',
    '안녕! 오늘 기분이 어때?',
  );
}

/** 6~7단계: 학생 답변 채점 → (영어 교정 또는 다음 영어 질문) + 한국어 번역 */
export async function evaluateAnswer(
  topic: string,
  messages: Message[],
  question: string,
  answer: string,
): Promise<EvalResult> {
  assertKey();
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: TEACHER_SYSTEM },
      {
        role: 'user',
        content:
          `오늘의 주제: "${topic}"\n` +
          `최근 대화:\n${renderHistory(messages.slice(-RECENT_CONTEXT_SIZE))}\n\n` +
          `방금 티쳐가 한 질문: "${question}"\n` +
          `아이의 영어 대답: "${answer}"\n\n` +
          '아이의 대답이 문법적으로 맞고 질문에 어울리는지 판단해줘.\n' +
          '- 틀렸거나 어색하면: correct=false, en 에는 무엇이 틀렸고 어떻게 말하면 좋은지 6살이 알아듣게 아주 쉬운 "영어"로 다정히 교정한 뒤 같은 질문을 다시 물어봐.\n' +
          '- 잘했으면: correct=true, en 에는 짧은 칭찬과 함께 위 대화에서 아직 안 나온 새로운 "영어" 질문 한 문장을 넣어줘. ' +
          '아이 말을 "You said ..." 처럼 그대로 따라 하지 말고, 같은 질문 틀을 반복하지 마.\n' +
          'ko 에는 en 의 한국어 번역을 넣어줘.\n' +
          'en, ko 모두 TTS(음성 합성)로 그대로 읽히니 이모지·이모티콘·특수기호 없이 작성해.\n' +
          '반드시 다음 JSON 형식으로만 답해: {"correct": boolean, "en": string, "ko": string}',
      },
    ],
  });
  const parsed = parseJson(res.choices[0]?.message.content);
  return {
    correct: Boolean(parsed.correct ?? true),
    en: cleanStr(parsed.en) || 'Good job! Let us keep going!',
    ko: cleanStr(parsed.ko) || '잘했어! 계속 해보자!',
  };
}

interface RawLine {
  correct?: unknown;
  en?: unknown;
  ko?: unknown;
}

/** 응답 텍스트를 JSON 으로 안전하게 파싱 (실패 시 빈 객체) */
function parseJson(raw: string | null | undefined): RawLine {
  try {
    return JSON.parse(raw?.trim() || '{}') as RawLine;
  } catch {
    return {};
  }
}

/** 문자열이면 trim, 아니면 빈 문자열 */
function cleanStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** {"en","ko"} JSON 응답을 안전하게 파싱. 실패 시 fallback 사용 */
function parseTeacherLine(raw: string | null | undefined, fbEn: string, fbKo: string): TeacherLine {
  const parsed = parseJson(raw);
  return {
    en: cleanStr(parsed.en) || fbEn,
    ko: cleanStr(parsed.ko) || fbKo,
  };
}

/** 지난 대화 요약 (100자 이내, 한국어) */
export async function summarize(messages: Message[]): Promise<string> {
  assertKey();
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.5,
    messages: [
      { role: 'system', content: TEACHER_SYSTEM },
      {
        role: 'user',
        content:
          `다음은 6살 아이와 나눈 영어 대화야:\n${renderHistory(messages)}\n\n` +
          `이 대화를 ${SUMMARY_MAX_LEN}자 이내의 한국어 한두 문장으로 요약해줘. 요약문만 출력해.`,
      },
    ],
  });
  const text = res.choices[0]?.message.content?.trim() || '';
  return text.slice(0, SUMMARY_MAX_LEN);
}
