// STT 엔진 추상화 — 기본은 WebSpeech, 향후 Whisper WASM 폴백
import type { SttEngine } from './webSpeech';
import { WebSpeechEngine, isWebSpeechSupported } from './webSpeech';

export type { SttEngine } from './webSpeech';

let engine: SttEngine | null = null;

/**
 * 현재 사용 가능한 STT 엔진을 반환한다.
 * 1차: WebSpeech 만 사용. 2차에서 인식률 기준으로 Whisper(WASM) 폴백 추가 예정.
 */
export function getSttEngine(): SttEngine | null {
  if (engine) return engine;
  if (isWebSpeechSupported()) {
    engine = new WebSpeechEngine();
    return engine;
  }
  return null;
}

export function isSttSupported(): boolean {
  return isWebSpeechSupported();
}
