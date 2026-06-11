// IndexedDB 래퍼 — 날짜별 대화 기록 저장소
import type { DailyRecord } from '../types';

const DB_NAME = 'ayoon-english';
const DB_VERSION = 1;
const STORE = 'records';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // key는 날짜 문자열을 직접 지정 (out-of-line key)
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = fn(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** 특정 날짜 기록 조회 */
export function getRecord(date: string): Promise<DailyRecord | undefined> {
  return tx('readonly', (s) => s.get(date) as IDBRequest<DailyRecord | undefined>);
}

/** 기록 저장(덮어쓰기) */
export function putRecord(date: string, record: DailyRecord): Promise<void> {
  return tx('readwrite', (s) => s.put(record, date) as IDBRequest<IDBValidKey>).then(
    () => undefined,
  );
}

/** 전체 기록을 날짜 내림차순으로 조회 */
export async function getAllRecords(): Promise<
  Array<{ date: string; record: DailyRecord }>
> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const out: Array<{ date: string; record: DailyRecord }> = [];
    const cursorReq = db
      .transaction(STORE, 'readonly')
      .objectStore(STORE)
      .openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        out.push({ date: String(cursor.key), record: cursor.value as DailyRecord });
        cursor.continue();
      } else {
        out.sort((a, b) => (a.date < b.date ? 1 : -1)); // 내림차순
        resolve(out);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

/** 기준 날짜(미포함) 이전의 기록만 조회 — 지난 대화 요약 대상 */
export async function getRecordsBefore(
  date: string,
): Promise<Array<{ date: string; record: DailyRecord }>> {
  const all = await getAllRecords();
  return all.filter((r) => r.date < date);
}
