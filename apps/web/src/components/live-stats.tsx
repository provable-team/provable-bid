"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { useApi } from "./api-provider";

// Inline styles keep this strip self-contained (no global CSS); it reflows from one row to two columns on phones.
const styles = {
  strip: { border: "1px solid var(--line, #dddfd4)", borderRadius: 14, background: "var(--white, #fffef9)", color: "var(--ink, #20221d)", padding: "14px 16px" },
  head: { display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "4px 12px", margin: "0 0 10px" },
  title: { fontSize: 14, fontWeight: 600, margin: 0 },
  badge: { fontSize: 12, color: "var(--muted, #5f6058)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(128px, 40%), 1fr))", gap: "10px 14px", margin: 0 },
  item: { minWidth: 0, display: "flex", flexDirection: "column-reverse", justifyContent: "flex-end" },
  value: { fontSize: 21, fontWeight: 600, lineHeight: 1.15, fontVariantNumeric: "tabular-nums", margin: 0 },
  label: { fontSize: 12, color: "var(--muted, #5f6058)", margin: "2px 0 0" },
  note: { fontSize: 13, color: "var(--muted, #5f6058)", margin: 0 },
} satisfies Record<string, CSSProperties>;

/** GET /stats.json: public aggregate counts (apps/api/src/stats.ts). Fields the API omits are not shown. */
export type LiveStatsData = {
  mode: string;
  generated_at: string;
  briefs_opened?: number;
  entries_submitted?: number;
  entries_checked?: number;
  entries_qualified?: number;
  qualified_rate?: number | null;
  competitions_captured?: number;
  competitions_voided?: number;
  purchases_completed?: number;
  paid_to_operators_usd?: number;
  payouts_paid_count?: number;
  outside_agents_registered?: number;
  outside_entries?: number;
  house_entries?: number;
};

const defaultApiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4010";
const count = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** The numbers shown, in order; a figure the API did not send is skipped. */
export function statItems(s: LiveStatsData): { label: string; value: string }[] {
  const rows: [string, number | null | undefined, (n: number) => string][] = [
    ["briefs opened", s.briefs_opened, count],
    ["entries submitted", s.entries_submitted, count],
    ["passed the checks", s.qualified_rate, (n) => `${Math.round(n * 100)}%`],
    ["paid for (captured)", s.competitions_captured, count],
    ["voided, buyer paid nothing", s.competitions_voided, count],
    ["paid to operators", s.paid_to_operators_usd, usd],
    ["outside agents", s.outside_agents_registered, count],
  ];
  return rows
    .filter((r): r is [string, number, (n: number) => string] => typeof r[1] === "number" && Number.isFinite(r[1]))
    .map(([label, value, format]) => ({ label, value: format(value) }));
}

/** A compact strip of live, aggregate marketplace numbers from the API's public /stats.json. */
export function LiveStats({
  apiBase = defaultApiBase,
  refreshMs = 60_000,
  expectedMode,
}: {
  apiBase?: string;
  refreshMs?: number;
  expectedMode?: string;
}) {
  const [stats, setStats] = useState<LiveStatsData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    async function load() {
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, "")}/stats.json`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as LiveStatsData;
        if (expectedMode && data.mode !== expectedMode) throw new Error("Payment environment mismatch");
        if (active) {
          setStats(data);
          setFailed(false);
        }
      } catch {
        if (active) { setStats(null); setFailed(true); }
      } finally {
        clearTimeout(timeout);
      }
    }
    void load();
    const timer = refreshMs > 0 ? setInterval(() => void load(), refreshMs) : null;
    return () => {
      active = false;
      controller?.abort();
      if (timer) clearInterval(timer);
    };
  }, [apiBase, refreshMs, expectedMode]);

  const titleId = useId();
  const items = stats ? statItems(stats) : [];
  return (
    <section className="live-stats" style={styles.strip} aria-labelledby={titleId}>
      <div style={styles.head}>
        <h2 id={titleId} style={styles.title}>
          {stats?.mode === "paypal_sandbox" ? "Live sandbox numbers" : "Live marketplace numbers"}
        </h2>
        <span style={styles.badge}>
          {stats?.mode === "paypal_sandbox" ? "PayPal sandbox · test money"
            : stats?.mode === "paypal_live" ? "PayPal live · real money"
            : stats?.mode === "mock" ? "Local test mode · fake payments"
            : "Payment environment unavailable"}
        </span>
      </div>
      <div role="status" aria-live="polite" aria-busy={!stats && !failed}>
        {stats && items.length > 0 ? (
          <dl style={styles.grid}>
            {items.map((item) => (
              <div key={item.label} style={styles.item}>
                <dt style={styles.label}>{item.label}</dt>
                <dd style={styles.value}>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : failed ? (
          <p style={styles.note}>Live numbers are unavailable right now.</p>
        ) : (
          <p style={styles.note}>Loading live numbers…</p>
        )}
      </div>
    </section>
  );
}

/** Uses the same active connection and verified configuration as checkout. */
export function ConnectedLiveStats() {
  const { settings, config, loading, error } = useApi();
  if (loading || error || !config) return <p>Live numbers are unavailable until the payment environment is confirmed.</p>;
  return <LiveStats key={`${settings.baseUrl}:${config.mode}`} apiBase={settings.baseUrl} expectedMode={config.mode} />;
}
