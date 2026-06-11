// STT — Web SpeechRecognition 구현
import { SPEECH_LANG } from '../../config';

/** STT 엔진 공통 인터페이스 (Whisper 폴백도 이 형태를 따른다) */
export interface SttEngine {
  /** 한 번 듣고 인식 결과 텍스트를 반환. 인식 실패 시 빈 문자열. */
  listenOnce(): Promise<SttResult>;
  /** 진행 중인 인식 중단 */
  abort(): void;
}

export interface SttResult {
  transcript: string;
  /** 0~1, 엔진이 제공하지 않으면 undefined */
  confidence?: number;
}

// 브라우저 벤더 프리픽스 대응
type SpeechRecognitionCtor = new () => SpeechRecognition;
function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isWebSpeechSupported(): boolean {
  return getCtor() !== null;
}

export class WebSpeechEngine implements SttEngine {
  private recognition: SpeechRecognition | null = null;

  listenOnce(): Promise<SttResult> {
    const Ctor = getCtor();
    if (!Ctor) return Promise.resolve({ transcript: '' });

    return new Promise((resolve) => {
      const rec = new Ctor();
      this.recognition = rec;
      rec.lang = SPEECH_LANG;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      let settled = false;
      const finish = (result: SttResult) => {
        if (settled) return;
        settled = true;
        this.recognition = null;
        resolve(result);
      };

      rec.onresult = (e: SpeechRecognitionEvent) => {
        const alt = e.results[0]?.[0];
        finish({ transcript: alt?.transcript?.trim() ?? '', confidence: alt?.confidence });
      };
      rec.onerror = () => finish({ transcript: '' });
      rec.onend = () => finish({ transcript: '' });

      try {
        rec.start();
      } catch {
        finish({ transcript: '' });
      }
    });
  }

  abort(): void {
    try {
      this.recognition?.abort();
    } catch {
      /* noop */
    }
    this.recognition = null;
  }
}
