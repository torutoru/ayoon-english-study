// STT — OpenAI Whisper (WASM) 폴백 (2차 마일스톤, 현재는 스텁)
//
// 계획: WebSpeech 인식 confidence 가 임계치보다 낮으면 이 엔진으로 폴백.
// Whisper.cpp 의 WASM 빌드를 로드해 브라우저 내에서 voice→text 를 수행한다.
// 마이크 녹음(MediaRecorder)으로 오디오를 캡처한 뒤 WASM 모델에 전달하는 방식.
import type { SttEngine, SttResult } from './webSpeech';

export class WhisperEngine implements SttEngine {
  listenOnce(): Promise<SttResult> {
    // TODO(M2): MediaRecorder 로 녹음 → whisper WASM 추론 → transcript 반환
    throw new Error('Whisper WASM 엔진은 아직 구현되지 않았습니다 (M2).');
  }

  abort(): void {
    /* TODO(M2) */
  }
}
