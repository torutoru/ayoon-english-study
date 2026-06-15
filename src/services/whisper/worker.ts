// Whisper WASM 추론 Web Worker
//
// Transformers.js를 CDN ESM 으로 직접 로드한다. 번들러(Vite/esbuild)가 onnxruntime-web 를
// 가공하면 'registerBackend' 초기화가 깨지는 문제가 있어, 브라우저가 CDN 의 완성된 빌드를
// 그대로 받게 한다. 모델 가중치/ORT WASM 도 CDN 기본 경로에서 로드된다.
// 모델은 최초 1회 다운로드 후 브라우저 CacheStorage 에 저장되어 이후엔 캐시에서 로드된다.

/** transformers.js 버전 (CDN). string 타입으로 두어 동적 import 가 모듈 해석을 시도하지 않게 한다 */
const TRANSFORMERS_CDN: string = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// 사용할 Whisper 모델 (영어 전용).
// 정확도↑: 'small.en' > 'base.en' > 'tiny.en'. small.en 은 아이/비원어민 발음에 더 강하다.
// (더 가볍게 하려면 'Xenova/whisper-base.en' 또는 'Xenova/whisper-tiny.en')
const WHISPER_MODEL = 'Xenova/whisper-small.en';

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

// ASR 파이프라인 — 최초 1회 로드 후 캐시
let transcriberPromise: Promise<Transcriber> | null = null;
function getTranscriber(): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = getLib().then((lib) =>
      lib.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        // 파일별 다운로드/로드 진행 상황을 메인 스레드로 전달
        progress_callback: (p: LoadProgress) => {
          post({
            type: 'progress',
            status: p.status ?? 'loading',
            file: p.file,
            name: p.name,
            progress: p.progress,
          });
        },
      }),
    );
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
      // chunk_length_s: 30 → 표준 처리(짧은 발화는 단일 청크). task 명시로 안정화.
      const out = await transcriber(data.audio, {
        chunk_length_s: 30,
        task: 'transcribe',
      });
      post({ type: 'result', text: (out.text ?? '').trim() });
    } catch (err) {
      post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }
});
