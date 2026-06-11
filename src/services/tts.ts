// TTS — Web SpeechSynthesis 래퍼 (언어/속도 지정 가능)
import { SPEECH_LANG } from '../config';

let voices: SpeechSynthesisVoice[] = [];

function loadVoices(): void {
  voices = window.speechSynthesis?.getVoices() ?? [];
}

/** 요청 언어에 맞는 음성 선택 (정확히 일치 → 같은 언어군 → 첫 번째) */
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (!voices.length) loadVoices();
  const prefix = lang.split('-')[0];
  return (
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.startsWith(prefix)) ||
    voices[0] ||
    null
  );
}

/** 지원 여부 */
export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface SpeakOptions {
  /** BCP-47 언어 코드 (기본: 영어) */
  lang?: string;
  /** 재생 속도 (기본: 1.0) */
  rate?: number;
}

/** 텍스트를 음성으로 재생. 재생이 끝나면 resolve. */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!isTtsSupported() || !text.trim()) return Promise.resolve();
  const lang = opts.lang ?? SPEECH_LANG;
  const rate = opts.rate ?? 1.0;
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel(); // 이전 재생 중단
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

/** 재생 중단 */
export function stopSpeaking(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}

// 일부 브라우저는 voices 가 비동기로 로드됨
if (isTtsSupported()) {
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
  loadVoices();
}
