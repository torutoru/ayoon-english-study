// 대화 루프 상태 머신 (spec.md 1~8단계)
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DIFFICULTY_RATE,
  KOREAN_LANG,
  KOREAN_RATE,
  SPEECH_LANG,
  TOPIC_EXPAND_EVERY,
  todayKey,
} from '../config';
import { getRecord, putRecord } from '../services/db';
import {
  evaluateAnswer,
  expandTopic,
  generateQuestion,
  generateTopic,
} from '../services/openai';
import { getSttEngine } from '../services/stt';
import { speak, stopSpeaking } from '../services/tts';
import type { DailyRecord, Difficulty, Message } from '../types';

export type ConvPhase =
  | 'init' // 시작/기록 로드 중
  | 'speaking' // 티쳐 음성 재생 중
  | 'idle' // 학생 입력 대기 (마이크 누를 수 있음)
  | 'listening' // 마이크 듣는 중
  | 'evaluating'; // AI 채점 중

interface ConvState {
  phase: ConvPhase;
  topic: string;
  messages: Message[];
  error: string | null;
}

export function useConversation(active: boolean, difficulty: Difficulty) {
  const [state, setState] = useState<ConvState>({
    phase: 'init',
    topic: '',
    messages: [],
    error: null,
  });
  const startedRef = useRef(false);
  // 콜백에서 최신 난이도를 참조하기 위한 ref (세션 중 변하지 않지만 안전하게)
  const difficultyRef = useRef(difficulty);
  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  // 질문 생성에 쓰는 "진행 중 주제" — 일정 턴마다 확장된다.
  // IndexedDB 에 저장되는 state.topic(그날의 원래 주제)과 분리해서 메모리에서만 굴린다.
  const topicRef = useRef('');
  // 학생이 답한 횟수 (주제 확장 주기 계산용)
  const turnRef = useRef(0);

  const patch = useCallback((p: Partial<ConvState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  /** 메시지 추가 + 즉시 영속화 (summary는 항상 null 유지) */
  const persist = useCallback(
    async (topic: string, messages: Message[]) => {
      const record: DailyRecord = { topic, messages, summary: null };
      await putRecord(todayKey(), record);
    },
    [],
  );

  /** 난이도 규칙대로 한 메시지를 음성 재생: 영어 원문 → (쉬움/중간이면) 한국어 번역 */
  const speakMessage = useCallback(async (m: Message) => {
    const rate = DIFFICULTY_RATE[difficultyRef.current];
    await speak(m.msg, { lang: SPEECH_LANG, rate });
    if (m.translation) {
      await speak(m.translation, { lang: KOREAN_LANG, rate: KOREAN_RATE });
    }
  }, []);

  /** 말풍선 "다시 듣기" — 상태 머신을 건드리지 않고 해당 메시지만 다시 재생 */
  const replay = useCallback(
    (m: Message) => {
      void speakMessage(m);
    },
    [speakMessage],
  );

  /** 티쳐 메시지 추가: 화면·영어 TTS 는 en 만, 쉬움/중간이면 ko 를 스피커로 덧붙여 읽어준다 */
  const addTeacher = useCallback(
    async (topic: string, base: Message[], en: string, ko: string): Promise<Message[]> => {
      const translation = difficultyRef.current !== 'hard' ? ko : null;
      const msg: Message = { sender: '티쳐', msg: en, translation };
      const next = [...base, msg];
      patch({ messages: next });
      await persist(topic, next);
      patch({ phase: 'speaking' });
      await speakMessage(msg);
      patch({ phase: 'idle' });
      return next;
    },
    [patch, persist, speakMessage],
  );

  // 화면 진입 시 1회 시작: 기존 기록 이어가기 or 새 주제 + 첫 질문
  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const existing = await getRecord(todayKey());
        if (existing && existing.messages.length > 0) {
          topicRef.current = existing.topic;
          // 이미 주고받은 학생 답변 수만큼 턴 카운트를 이어받아 확장 주기를 유지
          turnRef.current = existing.messages.filter((m) => m.sender === '학생').length;
          patch({ topic: existing.topic, messages: existing.messages, phase: 'idle' });
          return;
        }
        const topic = existing?.topic || (await generateTopic());
        topicRef.current = topic;
        turnRef.current = 0;
        patch({ topic });
        const first = await generateQuestion(topic, []);
        await addTeacher(topic, [], first.en, first.ko);
      } catch (e) {
        patch({ phase: 'idle', error: errMsg(e) });
      }
    })();
  }, [active, addTeacher, patch]);

  /** 마이크 버튼: 듣기 → 학생 메시지 추가 → 채점 → 티쳐 응답 */
  const handleMicPress = useCallback(async () => {
    stopSpeaking(); // 재생 중인(다시 듣기 등) 음성 중단
    setState((s) => {
      if (s.phase !== 'idle') return s; // 다른 단계면 무시
      return { ...s, phase: 'listening', error: null };
    });

    const engine = getSttEngine();
    if (!engine) {
      patch({ phase: 'idle', error: '이 브라우저는 음성 인식을 지원하지 않아요.' });
      return;
    }

    try {
      const { transcript } = await engine.listenOnce();
      if (!transcript) {
        patch({ phase: 'idle', error: '잘 못 들었어요. 다시 말해줄래요? 🎤' });
        return;
      }

      // 현재 상태를 안전하게 읽기 위해 setState 콜백 활용
      let topic = '';
      let lastQuestion = '';
      let withStudent: Message[] = [];
      setState((s) => {
        topic = s.topic;
        const teacherMsgs = s.messages.filter((m) => m.sender === '티쳐');
        lastQuestion = teacherMsgs[teacherMsgs.length - 1]?.msg ?? '';
        withStudent = [...s.messages, { sender: '학생', msg: transcript }];
        return { ...s, messages: withStudent, phase: 'evaluating' };
      });

      await persist(topic, withStudent);

      // 일정 턴마다 진행 중 주제를 한 단계 확장 (대화가 단조로워지지 않게)
      turnRef.current += 1;
      if (turnRef.current % TOPIC_EXPAND_EVERY === 0) {
        try {
          topicRef.current = await expandTopic(topicRef.current, withStudent);
        } catch {
          // 확장 실패해도 기존 주제로 대화를 계속한다
        }
      }

      // 채점·다음 질문 생성은 확장된 진행 중 주제로, 저장(persist)은 원래 주제로
      const result = await evaluateAnswer(
        topicRef.current,
        withStudent,
        lastQuestion,
        transcript,
      );
      // 정답/오답 모두 en(영어)을 표시·재생, ko(번역)는 쉬움/중간에서만 스피커로
      await addTeacher(topic, withStudent, result.en, result.ko);
    } catch (e) {
      patch({ phase: 'idle', error: errMsg(e) });
    }
  }, [addTeacher, patch, persist]);

  // 화면 떠날 때 재생 중단
  useEffect(() => {
    if (!active) stopSpeaking();
  }, [active]);

  return { ...state, handleMicPress, replay };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : '문제가 생겼어요. 잠시 후 다시 시도해줄래요?';
}
