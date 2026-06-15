// Whisper WASM 클라이언트 — Web Worker 래퍼
//
// 워커를 싱글턴으로 두어 모델을 한 번만 로드하고, 변환 요청마다 Promise 로 결과를 받는다.

export interface WhisperProgress {
  /** 'initiate' | 'download' | 'progress' | 'done' | 'ready' | 'transcribing' 등 */
  status: string;
  /** 다운로드 중인 파일 경로 (예: 'onnx/encoder_model_quantized.onnx') */
  file?: string;
  /** 모델 이름 */
  name?: string;
  /** 다운로드 진행률 0~100 (해당 단계에서만 제공) */
  progress?: number;
}

type OutMsg =
  | ({ type: 'progress' } & WhisperProgress)
  | { type: 'ready' }
  | { type: 'result'; text: string }
  | { type: 'error'; error: string };

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

/**
 * 모델을 미리 로드(warmup)한다. 최초 1회 다운로드, 이후 캐시에서 로드.
 * 진행 상황은 onProgress 로 통지하고, 준비 완료되면 resolve.
 */
export function loadModel(onProgress?: (p: WhisperProgress) => void): Promise<void> {
  const w = getWorker();
  return new Promise<void>((resolve, reject) => {
    const handler = (e: MessageEvent<OutMsg>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.(msg);
      } else if (msg.type === 'ready') {
        w.removeEventListener('message', handler);
        resolve();
      } else if (msg.type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(msg.error));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'load' });
  });
}

/**
 * 16kHz mono Float32 오디오를 Whisper WASM 으로 텍스트 변환한다.
 * @param audio 16kHz 모노 PCM (audio.ts 의 blobToMono16k 결과)
 * @param onProgress 모델 다운로드/변환 진행 상황 콜백
 */
export function transcribe(
  audio: Float32Array,
  onProgress?: (p: WhisperProgress) => void,
): Promise<string> {
  const w = getWorker();
  return new Promise<string>((resolve, reject) => {
    const handler = (e: MessageEvent<OutMsg>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.(msg);
      } else if (msg.type === 'result') {
        w.removeEventListener('message', handler);
        resolve(msg.text);
      } else if (msg.type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(msg.error));
      }
    };
    w.addEventListener('message', handler);
    // audio.buffer 를 transfer 하여 복사 비용 제거
    w.postMessage({ type: 'transcribe', audio }, [audio.buffer]);
  });
}
