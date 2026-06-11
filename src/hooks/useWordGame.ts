// 단어 맞추기 게임 상태 머신
//
// 흐름: 5라운드 진행. 라운드마다 "What is this?" 를 들려주고 카드 이미지를 보여준다.
// 학생이 마이크로 단어를 말하면 정답과 비교한다.
//   - 정답: 큰 O 표시 + "Correct!" 음성 → 다음 라운드
//   - 오답: 큰 X 표시 + "That's wrong." 음성 → 같은 라운드 유지(재도전)
import { useCallback, useEffect, useRef, useState } from 'react';
import { DIFFICULTY_RATE, SPEECH_LANG } from '../config';
import { WORD_CARDS } from '../data/wordCards';
import { getSttEngine } from '../services/stt';
import { speak, stopSpeaking } from '../services/tts';
import type { Difficulty, WordCard } from '../types';

/** 총 라운드 수 */
export const TOTAL_ROUNDS = 5;

const PROMPT = 'What is this?';
const CORRECT_SAY = 'Correct!';
const WRONG_SAY = "That's wrong.";

export type GamePhase =
  | 'intro' // 라운드 시작, "What is this?" 재생 중
  | 'idle' // 학생 입력 대기 (마이크 누를 수 있음)
  | 'listening' // 마이크 듣는 중
  | 'checking' // 정답 비교 중
  | 'correct' // 정답 O 표시 중
  | 'wrong' // 오답 X 표시 중
  | 'done'; // 5라운드 완료

interface GameState {
  phase: GamePhase;
  /** 0-based 현재 라운드 인덱스 */
  round: number;
  /** 이번 판에 뽑힌 카드들 */
  cards: WordCard[];
  /** STT 가 마지막으로 들은 말 (힌트 표시용) */
  lastHeard: string | null;
  error: string | null;
}

/** 영어 비교를 위한 정규화: 소문자 + 알파벳/숫자/공백만 남김 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** transcript 안에 정답 단어가 들어있으면 정답으로 인정 */
function matches(transcript: string, answer: string): boolean {
  const t = normalize(transcript);
  const a = normalize(answer);
  if (!t || !a) return false;
  if (t === a) return true;
  if (t.split(' ').includes(a)) return true;
  // 여러 단어 정답("ice cream" 등) 대응
  return a.includes(' ') && t.includes(a);
}

/** 목록에서 무작위로 n장 (중복 없이) 뽑는다 */
function pickCards(n: number): WordCard[] {
  const pool = [...WORD_CARDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

export function useWordGame(active: boolean, difficulty: Difficulty) {
  const [state, setState] = useState<GameState>({
    phase: 'intro',
    round: 0,
    cards: [],
    lastHeard: null,
    error: null,
  });
  const startedRef = useRef(false);
  const difficultyRef = useRef(difficulty);
  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  const patch = useCallback((p: Partial<GameState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  /** 라운드 시작: "What is this?" 를 들려주고 입력 대기로 전환 */
  const startRound = useCallback(
    async (cards: WordCard[], round: number) => {
      if (round >= cards.length) {
        patch({ phase: 'done' });
        return;
      }
      patch({ phase: 'intro', round, lastHeard: null, error: null });
      await speak(PROMPT, {
        lang: SPEECH_LANG,
        rate: DIFFICULTY_RATE[difficultyRef.current],
      });
      patch({ phase: 'idle' });
    },
    [patch],
  );

  // 화면 진입 시 1회: 카드 뽑고 첫 라운드 시작
  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      const cards = pickCards(TOTAL_ROUNDS);
      if (cards.length === 0) {
        patch({ phase: 'done', error: '단어 카드가 없어요. wordCards.ts 를 확인해줘요.' });
        return;
      }
      patch({ cards });
      await startRound(cards, 0);
    })();
  }, [active, patch, startRound]);

  /** 현재 카드 다시 듣기 ("What is this?") */
  const replayPrompt = useCallback(() => {
    void speak(PROMPT, {
      lang: SPEECH_LANG,
      rate: DIFFICULTY_RATE[difficultyRef.current],
    });
  }, []);

  /** 마이크 버튼: 듣기 → 정답 비교 → O/X */
  const handleMicPress = useCallback(async () => {
    stopSpeaking(); // 재생 중인 음성 중단
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

      // 현재 라운드/카드를 안전하게 읽기 위해 setState 콜백 활용 (대화하기와 동일 패턴)
      let cards: WordCard[] = [];
      let round = 0;
      setState((s) => {
        cards = s.cards;
        round = s.round;
        return { ...s, phase: 'checking', lastHeard: transcript };
      });

      const card = cards[round];
      const correct = card ? matches(transcript, card.answer) : false;

      if (correct) {
        patch({ phase: 'correct' });
        await speak(CORRECT_SAY, {
          lang: SPEECH_LANG,
          rate: DIFFICULTY_RATE[difficultyRef.current],
        });
        const next = round + 1;
        if (next >= cards.length) {
          patch({ phase: 'done' });
        } else {
          await startRound(cards, next);
        }
      } else {
        patch({ phase: 'wrong' });
        await speak(WRONG_SAY, {
          lang: SPEECH_LANG,
          rate: DIFFICULTY_RATE[difficultyRef.current],
        });
        patch({ phase: 'idle' }); // 같은 라운드 유지
      }
    } catch (e) {
      patch({ phase: 'idle', error: e instanceof Error ? e.message : '문제가 생겼어요.' });
    }
  }, [patch, startRound]);

  /** 처음부터 다시 (새 카드로) */
  const restart = useCallback(() => {
    stopSpeaking();
    const cards = pickCards(TOTAL_ROUNDS);
    setState({ phase: 'intro', round: 0, cards, lastHeard: null, error: null });
    void startRound(cards, 0);
  }, [startRound]);

  // 화면 떠날 때 재생 중단
  useEffect(() => {
    if (!active) stopSpeaking();
  }, [active]);

  return { ...state, handleMicPress, replayPrompt, restart, total: TOTAL_ROUNDS };
}
