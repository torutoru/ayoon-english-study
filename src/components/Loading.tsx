// 로딩 화면 — 히스토리 진입 시 지난 대화 요약 중 표시
interface Props {
  message?: string;
  detail?: string;
}

export function Loading({ message = '잠깐만 기다려줄래? 🐻', detail }: Props) {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner" aria-hidden />
      <div className="loading-text">{message}</div>
      {detail && <div className="loading-detail">{detail}</div>}
    </div>
  );
}
