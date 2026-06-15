// 마이크 녹음 + Whisper 입력용 16kHz mono PCM 변환
//
// 흐름: startRecording() 으로 MediaRecorder 녹음 시작 → stop() 으로 Blob 획득
//       → blobToMono16k() 로 16kHz 모노 Float32Array 로 변환 → Whisper 입력.

export interface Recording {
  /** 녹음을 멈추고 오디오 Blob 을 반환 */
  stop: () => Promise<Blob>;
  /** 녹음 취소 (마이크 트랙 정리) */
  cancel: () => void;
}

/** 마이크 권한을 요청하고 녹음을 시작한다 */
export async function startRecording(): Promise<Recording> {
  // 잡음/울림 억제 + 자동 게인 + 모노로 받아 인식 품질을 높인다
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  const cleanup = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          cleanup();
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        };
        recorder.stop();
      }),
    cancel: () => {
      try {
        recorder.stop();
      } catch {
        /* noop */
      }
      cleanup();
    },
  };
}

/**
 * 녹음 Blob 을 Whisper 입력 형식(16kHz mono Float32Array)으로 디코딩한다.
 * 브라우저 녹음 포맷(webm/opus 등)을 디코딩한 뒤 OfflineAudioContext 로 16kHz·모노 리샘플링.
 */
export async function blobToMono16k(blob: Blob): Promise<Float32Array> {
  const TARGET_RATE = 16000;
  const arrayBuf = await blob.arrayBuffer();

  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tmpCtx = new AudioCtor();
  const decoded = await tmpCtx.decodeAudioData(arrayBuf);
  await tmpCtx.close();

  const offline = new OfflineAudioContext(
    1, // 모노로 다운믹스
    Math.max(1, Math.ceil(decoded.duration * TARGET_RATE)),
    TARGET_RATE,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);

  // 너무 짧은 녹음(<1초)은 Whisper 가 헛인식하기 쉬워 무음으로 패딩한다
  const MIN_SAMPLES = TARGET_RATE; // 1초
  if (samples.length < MIN_SAMPLES) {
    const padded = new Float32Array(MIN_SAMPLES);
    padded.set(samples);
    return padded;
  }
  // 새 ArrayBuffer 로 복사 (Worker 로 transfer 가능하도록)
  return samples.slice();
}
