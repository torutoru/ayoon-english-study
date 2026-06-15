// 히스토리 화면 (test.html history-screen) — 진입 시 지난 대화 요약 + 로딩
import { useEffect, useMemo, useState } from 'react';
import { Loading } from '../components/Loading';
import { HISTORY_PAGE_SIZE } from '../config';
import { getAllRecords } from '../services/db';
import { backfillSummaries } from '../services/summary';
import type { DailyRecord, Difficulty, Screen } from '../types';

interface Row {
  date: string;
  difficulty: Difficulty;
  record: DailyRecord;
}

const DIFF_TABS: Array<{ value: Difficulty; icon: string; label: string }> = [
  { value: 'easy', icon: '🐢', label: '쉬움' },
  { value: 'medium', icon: '🐰', label: '중간' },
  { value: 'hard', icon: '🦅', label: '어려움' },
];

export function HistoryScreen({ onNav }: { onNav: (s: Screen) => void }) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Difficulty>('easy');
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // 진입 시: 요약 backfill → 로딩 → 목록 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // summary가 비어 있는 지난 기록을 요약. 대상이 없으면 즉시 0건으로 끝나 로딩이 바로 사라진다.
        await backfillSummaries((done, total) => {
          if (alive) setProgress({ done, total });
        });
      } catch {
        // 요약 실패해도 목록은 보여준다
      }
      const all = await getAllRecords();
      if (!alive) return;
      setRows(all);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 선택된 난이도 탭의 기록만 추린다 (난이도별 대화 분리)
  const filtered = useMemo(() => rows.filter((r) => r.difficulty === tab), [rows, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
  const pageRows = useMemo(
    () => filtered.slice(page * HISTORY_PAGE_SIZE, (page + 1) * HISTORY_PAGE_SIZE),
    [filtered, page],
  );
  const selectedRow = filtered.find((r) => r.date === selected);

  // 탭을 바꾸면 페이지·선택 초기화
  const changeTab = (next: Difficulty) => {
    setTab(next);
    setPage(0);
    setSelected(null);
  };

  if (loading) {
    const detail =
      progress && progress.total > 0
        ? `지난 이야기를 정리하고 있어요 (${progress.done}/${progress.total})`
        : undefined;
    return <Loading message="지난 이야기를 모으고 있어요 📚" detail={detail} />;
  }

  return (
    <div className="screen active">
      <div className="header">
        <button className="back-btn" onClick={() => onNav('main')}>
          🔙 홈으로
        </button>
      </div>

      <div className="history-tabs">
        {DIFF_TABS.map((t) => (
          <button
            key={t.value}
            className={`history-tab ${t.value} ${tab === t.value ? 'active' : ''}`}
            onClick={() => changeTab(t.value)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="history-table-container">
        <table>
          <tbody>
            <tr>
              <th>날짜 📅</th>
              <th>주제 🎈</th>
            </tr>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={2} className="history-empty">
                  아직 이야기가 없어요. 대화하러 가볼까요? ✨
                </td>
              </tr>
            )}
            {pageRows.map(({ date, record }) => (
              <tr key={date} className="row-btn" onClick={() => setSelected(date)}>
                <td>{date.slice(5).replace('-', '/')}</td>
                <td>{record.topic}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {pageCount > 1 && (
          <div className="pagination">
            <span
              className="page-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ◀
            </span>
            {Array.from({ length: pageCount }, (_, i) => (
              <span
                key={i}
                className="page-btn"
                style={i === page ? { fontWeight: 'bold', color: '#ff758c' } : undefined}
                onClick={() => setPage(i)}
              >
                {i + 1}
              </span>
            ))}
            <span
              className="page-btn"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              ▶
            </span>
          </div>
        )}
      </div>

      <div className="history-chat-view">
        {!selectedRow ? (
          <div className="history-placeholder">위에서 날짜를 콕! 눌러주세요. ✨</div>
        ) : (
          <>
            <div className="history-date-label">{selectedRow.date}의 대화 기록</div>
            {selectedRow.record.summary && (
              <div className="history-summary">📝 {selectedRow.record.summary}</div>
            )}
            <div className="history-messages">
              {selectedRow.record.messages.map((m, i) => (
                <div
                  key={i}
                  className={`history-bubble ${m.sender === '티쳐' ? 'ai' : 'user'}`}
                >
                  {m.msg}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
