// Whisper 모델 다운로드/준비 상태 — 진입 시 미리 로드하고 파일별 진행률을 토스트로 집계
import { useEffect, useRef, useState } from 'react';
import { loadModel, type WhisperProgress } from '../services/whisper';

export type ModelPhase = 'loading' | 'ready' | 'error';

export interface ModelToast {
  phase: ModelPhase;
  /** 현재 다운로드 중인 파일 순번 (1-based, 아직 파일 정보 없으면 0) */
  current: number;
  /** 지금까지 확인된 파일 개수 */
  total: number;
  /** 표시용 파일명 */
  label: string;
  /** 진행률 0~100 */
  percent: number;
  /** error 단계 메시지 */
  message?: string;
}

/** 'ready' 토스트를 보여주는 시간(ms) */
const READY_VISIBLE_MS = 1800;

function basename(path?: string): string {
  if (!path) return '모델';
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

export function useWhisperModel(): ModelToast | null {
  // 진입 즉시 "불러오는 중" 토스트를 보여준다 (첫 progress 이벤트 전에도 보이도록)
  const [toast, setToast] = useState<ModelToast | null>({
    phase: 'loading',
    current: 0,
    total: 0,
    label: '',
    percent: 0,
  });
  // 파일별 진행 상태 (삽입 순서 유지를 위해 order 배열 별도 관리)
  const filesRef = useRef<Map<string, { progress: number; done: boolean }>>(new Map());
  const orderRef = useRef<string[]>([]);
  const currentRef = useRef<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let readyTimer: number | undefined;

    const onProgress = (p: WhisperProgress) => {
      if (!aliveRef.current) return;
      if (p.status === 'transcribing') return; // 변환 단계는 토스트 대상 아님

      const file = p.file;
      if (file) {
        let item = filesRef.current.get(file);
        if (!item) {
          item = { progress: 0, done: false };
          filesRef.current.set(file, item);
          orderRef.current.push(file);
        }
        if (p.status === 'done') {
          item.done = true;
          item.progress = 100;
        } else if (typeof p.progress === 'number') {
          item.progress = p.progress;
          currentRef.current = file;
        } else {
          currentRef.current = currentRef.current ?? file;
        }
      }

      const order = orderRef.current;
      const cur = currentRef.current ?? order[order.length - 1];
      const item = cur ? filesRef.current.get(cur) : undefined;
      setToast({
        phase: 'loading',
        current: cur ? order.indexOf(cur) + 1 : 0,
        total: order.length,
        label: basename(cur),
        percent: Math.round(item?.progress ?? 0),
      });
    };

    loadModel(onProgress)
      .then(() => {
        if (!aliveRef.current) return;
        setToast({ phase: 'ready', current: 0, total: 0, label: '', percent: 100 });
        readyTimer = window.setTimeout(() => {
          if (aliveRef.current) setToast(null);
        }, READY_VISIBLE_MS);
      })
      .catch((e: unknown) => {
        if (!aliveRef.current) return;
        // 실패를 숨기지 않고 토스트로 노출 (원인 파악용)
        setToast({
          phase: 'error',
          current: 0,
          total: 0,
          label: '',
          percent: 0,
          message: e instanceof Error ? e.message : String(e),
        });
      });

    return () => {
      aliveRef.current = false;
      if (readyTimer) clearTimeout(readyTimer);
    };
  }, []);

  return toast;
}
