// Whisper WASM 음성→텍스트 테스트 상태 머신
//
// 흐름: idle ──(마이크)──▶ recording ──(다시 누름)──▶ working(디코딩+변환) ──▶ idle(결과 표시)
import { useCallback, useEffect, useRef, useState } from 'react';
import { blobToMono16k, startRecording, type Recording } from '../services/audio';
import { transcribe } from '../services/whisper';

export type TestPhase = 'idle' | 'recording' | 'working';

export function useWhisperTest() {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recording | null>(null);
  const aliveRef = useRef(true);

  const start = useCallback(async () => {
    setError(null);
    setTranscript(null);
    try {
      recRef.current = await startRecording();
      if (!aliveRef.current) {
        recRef.current.cancel();
        recRef.current = null;
        return;
      }
      setPhase('recording');
    } catch {
      setError('마이크를 사용할 수 없어요. 권한을 확인해줘요. 🎤');
      setPhase('idle');
    }
  }, []);

  const stop = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    setPhase('working');
    setStatus('소리를 정리하고 있어요... 🎧');
    try {
      const blob = await rec.stop();
      const audio = await blobToMono16k(blob);
      if (audio.length === 0) {
        setError('녹음된 소리가 없어요. 다시 해볼까요?');
        setPhase('idle');
        return;
      }
      // 모델 다운로드 진행률은 상단 토스트(useWhisperModel)가 표시하므로
      // 여기서는 변환 단계만 안내한다.
      const text = await transcribe(audio, (p) => {
        if (!aliveRef.current) return;
        if (p.status === 'transcribing') {
          setStatus('또박또박 듣고 글자로 바꾸는 중... ✍️');
        } else {
          setStatus('모델을 준비하고 있어요... 📦');
        }
      });
      if (!aliveRef.current) return;
      setTranscript(text || '(아무 말도 못 들었어요)');
      setPhase('idle');
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e instanceof Error ? e.message : '변환에 실패했어요. 다시 해볼까요?');
      setPhase('idle');
    }
  }, []);

  /** 마이크 버튼: idle 이면 녹음 시작, recording 이면 멈추고 변환 */
  const toggle = useCallback(() => {
    if (phase === 'recording') void stop();
    else if (phase === 'idle') void start();
  }, [phase, start, stop]);

  // 언마운트 시 진행 중 녹음 정리
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      recRef.current?.cancel();
      recRef.current = null;
    };
  }, []);

  return { phase, status, transcript, error, toggle };
}
