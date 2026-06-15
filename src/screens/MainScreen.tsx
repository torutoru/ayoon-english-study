// 메인 화면 (test.html main-screen)
import { useState } from 'react';
import type { Difficulty, Screen } from '../types';

/** 난이도를 고르는 대상 모드 */
type PickMode = 'chat' | 'game';

const DIFFICULTIES: Array<{
  value: Difficulty;
  cls: string;
  icon: string;
  label: string;
  desc: string;
}> = [
  { value: 'easy', cls: 'diff-easy', icon: '🐢', label: '쉬움', desc: '천천히 + 한국어 번역' },
  { value: 'medium', cls: 'diff-medium', icon: '🐰', label: '중간', desc: '조금 빠르게 + 한국어 번역' },
  { value: 'hard', cls: 'diff-hard', icon: '🦅', label: '어려움', desc: '실제 속도 · 영어만' },
];

export function MainScreen({
  onNav,
  onStart,
}: {
  onNav: (s: Screen) => void;
  onStart: (mode: PickMode, d: Difficulty) => void;
}) {
  const [picking, setPicking] = useState<PickMode | null>(null);

  return (
    <div className="screen active">
      <h1>안녕! 영어 친구 🐻</h1>
      <p className="subtitle">
        {picking ? '난이도를 골라봐!' : '오늘도 신나게 놀아볼까?'}
      </p>

      {!picking ? (
        <div className="main-buttons">
          <button className="main-btn" onClick={() => setPicking('chat')}>
            🎤 대화하기
          </button>
          <button className="main-btn game" onClick={() => setPicking('game')}>
            🃏 단어 맞추기
          </button>
          <button className="main-btn history" onClick={() => onNav('history')}>
            📖 지난 이야기
          </button>
          <button className="main-btn test" onClick={() => onNav('test')}>
            🔬 테스트
          </button>
        </div>
      ) : (
        <div className="main-buttons">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              className={`main-btn diff-btn ${d.cls}`}
              onClick={() => onStart(picking, d.value)}
            >
              {d.icon} {d.label}
              <span className="diff-desc">{d.desc}</span>
            </button>
          ))}
          <button className="back-btn diff-back" onClick={() => setPicking(null)}>
            🔙 뒤로
          </button>
        </div>
      )}
    </div>
  );
}
