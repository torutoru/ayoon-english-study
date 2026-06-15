// IndexedDB 래퍼 — (날짜 + 난이도)별 대화 기록 저장소
import type { DailyRecord, Difficulty } from '../types';

const DB_NAME = 'ayoon-english';
const DB_VERSION = 1;
const STORE = 'records';

/** 복합 key 구분자 — 'yyyy-mm-dd__easy' 형태 */
const KEY_SEP = '__';

/** (날짜, 난이도) → IndexedDB key 문자열 */
export function recordKey(date: string, difficulty: Difficulty): string {
  return `${date}${KEY_SEP}${difficulty}`;
}

/** key 문자열 → (날짜, 난이도). 구분자가 없는 옛 key는 난이도 easy 로 간주 */
function parseKey(key: string): { date: string; difficulty: Difficulty } {
  const idx = key.indexOf(KEY_SEP);
  if (idx < 0) return { date: key, difficulty: 'easy' };
  return {
    date: key.slice(0, idx),
    difficulty: key.slice(idx + KEY_SEP.length) as Difficulty,
  };
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // key는 'yyyy-mm-dd__difficulty' 문자열을 직접 지정 (out-of-line key)
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

/** 특정 (날짜, 난이도) 기록 조회 */
export function getRecord(
  date: string,
  difficulty: Difficulty,
): Promise<DailyRecord | undefined> {
  return tx(
    'readonly',
    (s) => s.get(recordKey(date, difficulty)) as IDBRequest<DailyRecord | undefined>,
  );
}

/** 기록 저장(덮어쓰기) */
export function putRecord(
  date: string,
  difficulty: Difficulty,
  record: DailyRecord,
): Promise<void> {
  return tx(
    'readwrite',
    (s) => s.put(record, recordKey(date, difficulty)) as IDBRequest<IDBValidKey>,
  ).then(() => undefined);
}

/** 전체 기록을 날짜 내림차순으로 조회 (난이도 포함) */
export async function getAllRecords(): Promise<
  Array<{ date: string; difficulty: Difficulty; record: DailyRecord }>
> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const out: Array<{ date: string; difficulty: Difficulty; record: DailyRecord }> = [];
    const cursorReq = db
      .transaction(STORE, 'readonly')
      .objectStore(STORE)
      .openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        const { date, difficulty } = parseKey(String(cursor.key));
        const record = cursor.value as DailyRecord;
        // 옛 기록에 difficulty 필드가 없으면 key 에서 파싱한 값으로 보정
        out.push({ date, difficulty: record.difficulty ?? difficulty, record });
        cursor.continue();
      } else {
        out.sort((a, b) => (a.date < b.date ? 1 : -1)); // 내림차순
        resolve(out);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

/** 기준 날짜(미포함) 이전의 기록만 조회 — 지난 대화 요약 대상 (모든 난이도) */
export async function getRecordsBefore(
  date: string,
): Promise<Array<{ date: string; difficulty: Difficulty; record: DailyRecord }>> {
  const all = await getAllRecords();
  return all.filter((r) => r.date < date);
}
