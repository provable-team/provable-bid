import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-shell empty-state">
      <span className="eyebrow">404</span>
      <h1>This page hasn’t been made yet.</h1>
      <p>Find a competition or start a creative brief of your own.</p>
      <Link href="/" className="button primary">
        Explore the marketplace ↗
      </Link>
    </div>
  );
}
