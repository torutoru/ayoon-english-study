// 지난 기록 일괄 요약 — 히스토리 진입 시 호출
import { todayKey } from '../config';
import { getRecordsBefore, putRecord } from './db';
import { summarize } from './openai';

/**
 * 오늘 이전 기록 중 summary가 비어 있는 항목을 모두 요약해 저장한다.
 * @param onProgress 진행 상황 콜백 (done/total)
 * @returns 새로 요약한 항목 수
 */
export async function backfillSummaries(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const before = await getRecordsBefore(todayKey());
  const pending = before.filter(
    (r) => r.record.summary === null && r.record.messages.length > 0,
  );

  const total = pending.length;
  onProgress?.(0, total);
  if (total === 0) return 0;

  let done = 0;
  for (const { date, difficulty, record } of pending) {
    const summary = await summarize(record.messages);
    await putRecord(date, difficulty, { ...record, summary });
    done += 1;
    onProgress?.(done, total);
  }
  return done;
}
