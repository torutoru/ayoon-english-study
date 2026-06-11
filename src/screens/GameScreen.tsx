// 단어 맞추기 게임 화면
import { useWordGame, type GamePhase } from '../hooks/useWordGame';
import type { Difficulty, Screen, WordCard } from '../types';

const PHASE_HINT: Record<GamePhase, string> = {
  intro: '잘 듣고 있어봐요 🔊',
  idle: '마이크를 누르고 영어로 말해봐요!',
  listening: '듣고 있어요... 말해봐요! 🎤',
  checking: '음~ 맞았을까요? 🤔',
  correct: '정답이에요! 참 잘했어요! 🎉',
  wrong: '아쉬워요. 다시 한 번 말해볼까요?',
  done: '게임 끝! 정말 멋졌어요! 🏆',
};

const DIFFICULTY_BADGE: Record<Difficulty, { icon: string; label: string }> = {
  easy: { icon: '🐢', label: '쉬움' },
  medium: { icon: '🐰', label: '중간' },
  hard: { icon: '🦅', label: '어려움' },
};

/** image 가 경로/URL 이면 <img>, 아니면 이모지 텍스트로 렌더 */
function CardImage({ card }: { card: WordCard }) {
  const isPath = /^(https?:)?\//.test(card.image) || card.image.startsWith('data:');
  if (isPath) {
    return <img className="game-card-img" src={card.image} alt={card.answer} />;
  }
  return <span className="game-card-emoji">{card.image}</span>;
}

export function GameScreen({
  onNav,
  difficulty,
}: {
  onNav: (s: Screen) => void;
  difficulty: Difficulty;
}) {
  const {
    phase,
    round,
    cards,
    lastHeard,
    error,
    handleMicPress,
    replayPrompt,
    restart,
    total,
  } = useWordGame(true, difficulty);

  const badge = DIFFICULTY_BADGE[difficulty];
  const micDisabled = phase !== 'idle';
  const card = cards[round];

  return (
    <div className="screen active">
      <div className="header">
        <button className="back-btn" onClick={() => onNav('main')}>
          🔙 홈으로
        </button>
        <span className="header-title">단어 맞추기 🃏</span>
      </div>

      {phase === 'done' ? (
        <div className="game-done">
          <div className="game-done-mark">🏆</div>
          <div className="game-done-text">{error ?? '5라운드 모두 끝났어요!'}</div>
          <div className="main-buttons">
            <button className="main-btn diff-easy" onClick={restart}>
              🔁 다시 하기
            </button>
            <button className="main-btn history" onClick={() => onNav('main')}>
              🏠 홈으로
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="game-round">
            라운드 {round + 1} / {total}
          </div>

          <div className="game-card-area">
            {card && <CardImage card={card} />}
            {phase === 'correct' && <div className="result-mark correct">O</div>}
            {phase === 'wrong' && <div className="result-mark wrong">X</div>}
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
            <button
              className="game-replay-btn"
              onClick={replayPrompt}
              aria-label="다시 듣기"
            >
              🔊
            </button>
            <div className="difficulty-badge">
              <span className="difficulty-icon">{badge.icon}</span>
              <span>{badge.label}</span>
            </div>
          </div>

          <div className="mic-hint">
            {error ?? PHASE_HINT[phase]}
            {lastHeard && phase === 'wrong' && (
              <div className="game-heard">내가 들은 말: “{lastHeard}”</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
