export default function Loading() {
  return (
    <div className="page-shell loading-page" role="status">
      <div className="eyebrow">provable.bid</div>
      <h1>Making room for good work.</h1>
      <div className="skeleton loading-block" />
      <p className="muted">Loading your marketplace…</p>
    </div>
  );
}
