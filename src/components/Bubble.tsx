// 채팅 말풍선 — 티쳐(ai) / 학생(user)
import type { Message } from '../types';

export function Bubble({
  message,
  onReplay,
}: {
  message: Message;
  /** 티쳐 말풍선에서만 사용. 누르면 해당 메시지를 난이도 규칙대로 다시 들려준다 */
  onReplay?: () => void;
}) {
  const isAi = message.sender === '티쳐';
  const kind = isAi ? 'ai' : 'user';

  if (!isAi) {
    return <div className={`bubble ${kind}`}>{message.msg}</div>;
  }

  return (
    <div className="bubble-row">
      <div className={`bubble ${kind}`}>{message.msg}</div>
      {onReplay && (
        <button
          className="replay-btn"
          onClick={onReplay}
          aria-label="다시 듣기"
          title="다시 듣기"
        >
          🔁
        </button>
      )}
    </div>
  );
}
