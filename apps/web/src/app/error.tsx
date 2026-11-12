"use client";
import { useEffect } from "react";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="page-shell empty-state">
      <span className="eyebrow">Something interrupted the page</span>
      <h1>Let’s pick up where you left off.</h1>
      <p>Your saved command keys remain available for safe retries.</p>
      <button className="button primary" onClick={reset}>
        Reload this view
      </button>
    </div>
  );
}
