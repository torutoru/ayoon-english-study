// 음성 인식 테스트 화면 — Whisper WASM 으로 마이크 음성을 텍스트로 변환
import { useWhisperModel } from '../hooks/useWhisperModel';
import { useWhisperTest } from '../hooks/useWhisperTest';
import type { Screen } from '../types';

export function TestScreen({ onNav }: { onNav: (s: Screen) => void }) {
  const { phase, status, transcript, error, toggle } = useWhisperTest();
  const modelToast = useWhisperModel();
  const recording = phase === 'recording';
  const working = phase === 'working';

  const micIcon = working ? '⏳' : recording ? '⏹️' : '🎤';
  const hint = error
    ? error
    : working
      ? status || '바꾸는 중... ✍️'
      : recording
        ? '다 말했으면 버튼을 다시 눌러요! 🛑'
        : '버튼을 누르고 영어로 말해봐요! 🎤';

  return (
    <div className="screen active">
      {modelToast && (
        <div className={`dl-toast ${modelToast.phase}`}>
          {modelToast.phase === 'ready'
            ? '모델 준비 완료 ✅'
            : modelToast.phase === 'error'
              ? `모델 로딩 실패: ${modelToast.message ?? '알 수 없는 오류'}`
              : '모델 준비중....'}
        </div>
      )}

      <div className="header">
        <button className="back-btn" onClick={() => onNav('main')}>
          🔙 홈으로
        </button>
        <span className="header-title">음성 테스트 🔬</span>
      </div>

      <div className="chat-box test-result">
        {transcript === null && !working ? (
          <div className="history-placeholder">
            마이크 버튼을 누르고 말하면
            <br />
            Whisper가 글자로 바꿔줘요! ✨
          </div>
        ) : working ? (
          <div className="history-placeholder">{status || '바꾸는 중... ✍️'}</div>
        ) : (
          <div className="test-transcript">{transcript}</div>
        )}
      </div>

      <div className="walkie-talkie-container">
        <button
          className={`walkie-talkie-btn ${recording ? 'recording' : ''}`}
          onClick={toggle}
          disabled={working}
          aria-label="녹음"
        >
          {micIcon}
        </button>
      </div>
      <div className="mic-hint">{hint}</div>
    </div>
  );
}
