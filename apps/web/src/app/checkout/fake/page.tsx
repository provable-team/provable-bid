"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/api-provider";

/** Demo mode only: stands in for the PayPal approval page when the API runs with its fake provider. */
export default function FakeCheckoutPage() {
  const { config } = useApi();
  const [target, setTarget] = useState<string | null>(null);
  const [order, setOrder] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setOrder(query.get("order_id") ?? "");
    try {
      const url = new URL(query.get("return_url") ?? "", window.location.href);
      if (url.origin === window.location.origin && url.pathname.startsWith("/competitions/")) setTarget(url.href);
    } catch {
      /* Only same-origin competition pages are valid return targets. */
    }
  }, []);
  return (
    <div className="page-shell detail-loading">
      <span className="eyebrow">Demo mode · simulated PayPal</span>
      <h1>Approve this payment?</h1>
      <p className="muted">
        The API is running with its fake payment provider, so this page stands in for PayPal. No real money moves.
        Order <code>{order}</code>.
      </p>
      {config?.mode !== "mock" ? (
        <div className="error-message">This page only works in demo mode.</div>
      ) : target ? (
        <div className="button-row">
          <a className="button primary" href={target}>Approve (simulated)</a>
          <a className="button secondary" href={target.replace("paypal=return", "paypal=cancel")}>Cancel</a>
        </div>
      ) : (
        <div className="error-message">Missing or invalid return address.</div>
      )}
    </div>
  );
}
