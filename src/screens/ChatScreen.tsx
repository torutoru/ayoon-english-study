// 대화 화면 (test.html chat-screen) — 대화 루프 실행
import { useEffect, useRef } from 'react';
import { Bubble } from '../components/Bubble';
import { useConversation, type ConvPhase } from '../hooks/useConversation';
import type { Difficulty, Screen } from '../types';

const PHASE_HINT: Record<ConvPhase, string> = {
  init: '오늘의 주제를 준비하고 있어요... ✨',
  speaking: '영어 친구가 말하고 있어요 🔊',
  idle: '마이크를 누르고 말해봐요!',
  listening: '듣고 있어요... 말해봐요! 🎤',
  evaluating: '음~ 생각 중이에요 🤔',
};

const DIFFICULTY_BADGE: Record<Difficulty, { icon: string; label: string }> = {
  easy: { icon: '🐢', label: '쉬움' },
  medium: { icon: '🐰', label: '중간' },
  hard: { icon: '🦅', label: '어려움' },
};

export function ChatScreen({
  onNav,
  difficulty,
}: {
  onNav: (s: Screen) => void;
  difficulty: Difficulty;
}) {
  const { phase, messages, error, handleMicPress, replay } = useConversation(
    true,
    difficulty,
  );
  const boxRef = useRef<HTMLDivElement>(null);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const micDisabled = phase !== 'idle';
  const badge = DIFFICULTY_BADGE[difficulty];

  return (
    <div className="screen active">
      <div className="header">
        <button className="back-btn" onClick={() => onNav('main')}>
          🔙 홈으로
        </button>
        <span className="header-title">영어 친구 🐻</span>
      </div>

      <div className="chat-box" ref={boxRef}>
        {messages.map((m, i) => (
          <Bubble
            key={i}
            message={m}
            onReplay={m.sender === '티쳐' ? () => replay(m) : undefined}
          />
        ))}
        {phase === 'init' && <div className="bubble ai">{PHASE_HINT.init}</div>}
      </div>

      <div className="walkie-talkie-container">
        <button
          className="walkie-talkie-btn"
          onClick={handleMicPress}
          disabled={micDisabled}
          aria-label="말하기"
        >
          🎤
        </button>
        <div className="difficulty-badge">
          <span className="difficulty-icon">{badge.icon}</span>
          <span>{badge.label}</span>
        </div>
      </div>
      <div className="mic-hint">{error ?? PHASE_HINT[phase]}</div>
    </div>
  );
}
