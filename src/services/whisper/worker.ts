// Whisper 추론 Web Worker (WebGPU 우선, WASM 폴백)
//
// transformers.js v3 를 CDN ESM 으로 로드한다. 번들러(Vite/esbuild)가 onnxruntime-web 를
// 가공하면 'registerBackend' 초기화가 깨지는 문제가 있어, 브라우저가 CDN 의 완성 빌드를
// 그대로 받게 한다.
//
// 속도: WebGPU(GPU 추론)가 가능하면 우선 사용하고, 미지원/실패 시 WASM(CPU)으로 폴백한다.
// 모델은 최초 1회 다운로드 후 브라우저 CacheStorage 에 저장되어 이후엔 캐시에서 로드된다.

/** transformers.js v3 (CDN). string 타입으로 두어 동적 import 가 모듈 해석을 시도하지 않게 한다 */
const TRANSFORMERS_CDN: string = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';

// 워커 전역 self 를 Worker 로 캐스팅 (tsconfig 에 WebWorker lib 미포함)
const ctx = self as unknown as Worker;

type InMsg = { type: 'load' } | { type: 'transcribe'; audio: Float32Array };

type OutMsg =
  | { type: 'progress'; status: string; file?: string; name?: string; progress?: number }
  | { type: 'ready' }
  | { type: 'result'; text: string }
  | { type: 'error'; error: string };

const post = (m: OutMsg) => ctx.postMessage(m);

interface LoadProgress {
  status?: string;
  file?: string;
  name?: string;
  progress?: number;
}

type Transcriber = (
  audio: Float32Array,
  opts?: Record<string, unknown>,
) => Promise<{ text?: string }>;

interface TransformersLib {
  pipeline: (
    task: string,
    model: string,
    opts?: Record<string, unknown>,
  ) => Promise<Transcriber>;
  env: { allowLocalModels: boolean };
}

// 빌드 시도 순서: WebGPU(빠름) → WASM(호환). 앞에서 성공하면 그것을 사용.
// WebGPU 는 다운로드 용량을 줄이려 인코더 fp16 + 디코더 q4 사용.
interface Attempt {
  device: 'webgpu' | 'wasm';
  model: string;
  dtype?: unknown;
  requireGPU: boolean;
}
const ATTEMPTS: Attempt[] = [
  {
    device: 'webgpu',
    model: 'onnx-community/whisper-small.en',
    dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
    requireGPU: true,
  },
  {
    device: 'wasm',
    model: 'Xenova/whisper-small.en',
    requireGPU: false,
  },
];

// CDN 라이브러리 로드 (1회)
let libPromise: Promise<TransformersLib> | null = null;
function getLib(): Promise<TransformersLib> {
  if (!libPromise) {
    libPromise = import(/* @vite-ignore */ TRANSFORMERS_CDN).then((m: unknown) => {
      const lib = m as TransformersLib;
      lib.env.allowLocalModels = false; // 원격(HuggingFace) 모델만 사용
      return lib;
    });
  }
  return libPromise;
}

/** 실제 GPU 어댑터가 있는지 확인 (worker 에서도 navigator.gpu 사용 가능) */
async function hasWebGPU(): Promise<boolean> {
  try {
    const nav = navigator as unknown as {
      gpu?: { requestAdapter: () => Promise<unknown> };
    };
    if (!nav.gpu) return false;
    const adapter = await nav.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

// ASR 파이프라인 — 최초 1회 로드 후 캐시
let transcriberPromise: Promise<Transcriber> | null = null;
function getTranscriber(): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const lib = await getLib();
      const gpu = await hasWebGPU();
      let lastErr: unknown = null;

      for (const a of ATTEMPTS) {
        if (a.requireGPU && !gpu) continue;
        try {
          post({ type: 'progress', status: `loading-${a.device}` });
          const opts: Record<string, unknown> = {
            device: a.device,
            progress_callback: (p: LoadProgress) => {
              post({
                type: 'progress',
                status: p.status ?? 'loading',
                file: p.file,
                name: p.name,
                progress: p.progress,
              });
            },
          };
          if (a.dtype !== undefined) opts.dtype = a.dtype;
          return await lib.pipeline('automatic-speech-recognition', a.model, opts);
        } catch (err) {
          // 이 조합 실패 → 다음(폴백) 조합 시도
          lastErr = err;
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error('모델 로드 실패');
    })();
  }
  return transcriberPromise;
}

self.addEventListener('message', async (e: MessageEvent<InMsg>) => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'load') {
    // 모델 미리 로드(warmup) — 다운로드/캐시 로드가 끝나면 ready 통지
    try {
      await getTranscriber();
      post({ type: 'ready' });
    } catch (err) {
      post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (data.type === 'transcribe') {
    try {
      const transcriber = await getTranscriber();
      post({ type: 'progress', status: 'transcribing' });
      // chunk_length_s: 30 → 표준 처리(짧은 발화는 단일 청크).
      // 주의: 영어 전용(.en) 모델에는 task/language 를 지정하면 안 된다(에러 발생).
      const out = await transcriber(data.audio, {
        chunk_length_s: 30,
      });
      post({ type: 'result', text: (out.text ?? '').trim() });
    } catch (err) {
      post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }
});
