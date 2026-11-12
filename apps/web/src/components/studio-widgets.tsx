"use client";

import React, { use } from "react";
import type {
  AgBaseWidgetDefinition,
  AgDefaultRegistry,
  AgDefaultWidgetDefinition,
  AgWidgetDataFormat,
  AgWidgetField,
  AgWidgetFieldReference,
  AgWidgetFormParams,
  AgWidgetParams,
} from "ag-studio";
import { AgIncompleteDataMappingOverlay, AgNoDataOverlay } from "ag-studio-react";
import { PAYOUT_STAGES, payoutStage } from "./studio-dashboard-data";

// Two custom widgets for the operator dashboard, built on Studio's custom widget API: they read through the widget
// API (so page filters, cross filters and the assistant's changes apply), and they are listed in the widget menu and
// described to the assistant like the built-in ones.

/** Payout states from the contract, in the words the site uses. */
export const PAYOUT_LABELS: Record<string, string> = {
  paid: "Paid",
  simulated: "Simulated",
  pending: "Sent, awaiting PayPal",
  queued: "Queued",
  not_scheduled: "Not scheduled",
  failed: "Failed",
  blocked: "On hold",
};
export const payoutLabel = (state: unknown) => PAYOUT_LABELS[String(state)] ?? String(state ?? "Unknown");
/** The same, short enough for a chart legend or axis: "Sent" rather than "Sent, awaiting PayPal". */
export const payoutShortLabel = (state: unknown) => (String(state) === "pending" ? "Sent" : payoutLabel(state));
/** Pill tone by payout stage: paid green, sent amber, waiting neutral, failed or on hold red. */
export function payoutTone(state: unknown): "success" | "pending" | "danger" | "neutral" {
  return ({ paid: "success", sent: "pending", waiting: "neutral", attention: "danger" } as const)[payoutStage(state).key];
}

export interface PayoutPipelineWidget {
  type: "payout-pipeline";
  dataMapping: { stage: AgWidgetFieldReference[]; amount: AgWidgetFieldReference[]; count?: AgWidgetFieldReference[] };
  format?: AgWidgetDataFormat<Record<string, never>>;
}
export interface LatestPayoutWidget {
  type: "latest-payout";
  dataMapping: { date: AgWidgetFieldReference[]; amount: AgWidgetFieldReference[]; status: AgWidgetFieldReference[]; agent?: AgWidgetFieldReference[] };
  format?: AgWidgetDataFormat<Record<string, never>>;
}
type PipelineDefinition = AgBaseWidgetDefinition<"payout-pipeline", PayoutPipelineWidget>;
type LatestDefinition = AgBaseWidgetDefinition<"latest-payout", LatestPayoutWidget>;
export interface DashboardRegistry extends Omit<AgDefaultRegistry, "widgets"> {
  widgets: readonly (AgDefaultWidgetDefinition | PipelineDefinition | LatestDefinition)[];
}

// The pipeline reads in flow order; colours come from the shared stage mapping. Captions stay short enough for a
// phone without truncation.
const HINTS = { waiting: "Not sent yet", sent: "Awaiting PayPal", paid: "Confirmed", attention: "Failed or on hold" } as const;
const STAGES = (["waiting", "sent", "paid", "attention"] as const).map((key) => {
  const stage = PAYOUT_STAGES.find((s) => s.key === key)!;
  return { key, label: key === "waiting" ? "Waiting to send" : stage.label, states: stage.states, color: stage.color, hint: HINTS[key] };
});

function PayoutPipeline({ widgetApi, dataMapping }: AgWidgetParams<PayoutPipelineWidget>) {
  const stage = dataMapping.stage?.at(0);
  const amount = dataMapping.amount?.at(0);
  const count = dataMapping.count?.at(0);
  if (!stage || !amount) return <AgIncompleteDataMappingOverlay />;
  const fields: AgWidgetField[] = count ? [stage, amount, count] : [stage, amount];
  const { results } = use(widgetApi.getData({ fields }));
  if (!results.rows.length) return <AgNoDataOverlay />;

  const byState = new Map<string, { amount: number; count: number }>();
  for (const row of results.rows) {
    const key = String(row[stage.key] ?? "unknown");
    const prev = byState.get(key) ?? { amount: 0, count: 0 };
    byState.set(key, { amount: prev.amount + (Number(row[amount.key]) || 0), count: prev.count + (count ? Number(row[count.key]) || 0 : 0) });
  }
  const known = new Set<string>(STAGES.flatMap((s) => [...s.states]));
  const total = [...byState.values()].reduce((sum, v) => sum + v.amount, 0);
  const totalCount = [...byState.values()].reduce((sum, v) => sum + v.count, 0);
  const simulatedOnly = byState.has("simulated") && !byState.has("paid");
  const stages = STAGES.map((s) => {
    const states = s.key === "attention" ? [...s.states, ...[...byState.keys()].filter((k) => !known.has(k))] : s.states;
    const value = states.reduce((acc, k) => ({ amount: acc.amount + (byState.get(k)?.amount ?? 0), count: acc.count + (byState.get(k)?.count ?? 0) }), { amount: 0, count: 0 });
    return { ...s, label: s.key === "paid" && simulatedOnly ? "Recorded (simulated)" : s.label, ...value };
  });
  const money = (value: number) => widgetApi.formatFieldValue(amount, value);
  const share = (value: number) => (total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0);
  const paid = stages.find((s) => s.key === "paid")!;

  return (
    <div className="pb-pipeline" role="group" aria-label="Payout pipeline">
      <div className="pb-pipeline-head">
        <div>
          <span className="pb-widget-eyebrow">Payout pipeline</span>
          <strong className="pb-pipeline-total">{money(total)}</strong>
          <span className="pb-widget-note">allocated{count ? ` across ${totalCount} win${totalCount === 1 ? "" : "s"}` : ""}</span>
        </div>
        <span className="pb-pipeline-rate">{Math.round(share(paid.amount))}% {simulatedOnly ? "recorded" : "paid"}</span>
      </div>
      <div className="pb-pipeline-bar" aria-hidden="true">
        {/* Progress reads left to right: paid first, then sent, waiting, and anything that needs attention. */}
        {["paid", "sent", "waiting", "attention"].map((key) => stages.find((s) => s.key === key)!).filter((s) => s.amount > 0)
          .map((s) => <span key={s.key} className={`pb-seg ${s.key}`} style={{ flexGrow: s.amount, background: s.color }} />)}
      </div>
      <ol className="pb-pipeline-stages">
        {stages.map((s) => (
          <li key={s.key} className={`pb-stage ${s.key}${s.amount > 0 || s.count > 0 ? "" : " empty"}`}>
            <span className={`pb-dot ${s.key}`} style={{ background: s.color }} aria-hidden="true" />
            <span className="pb-stage-label">{s.label}</span>
            <strong className="pb-stage-amount">{money(s.amount)}</strong>
            <span className="pb-stage-meta">{count ? `${s.count} · ` : ""}{s.hint}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LatestPayout({ widgetApi, dataMapping }: AgWidgetParams<LatestPayoutWidget>) {
  const date = dataMapping.date?.at(0);
  const amount = dataMapping.amount?.at(0);
  const status = dataMapping.status?.at(0);
  const agent = dataMapping.agent?.at(0);
  if (!date || !amount || !status) return <AgIncompleteDataMappingOverlay />;
  const fields: AgWidgetField[] = agent ? [date, status, agent, amount] : [date, status, amount];
  const { results } = use(widgetApi.getData({ fields, sort: [{ field: date, direction: "desc" }], limit: { count: 1 } }));
  const row = results.rows.at(0);
  if (!row) return <AgNoDataOverlay />;
  const state = row[status.key];
  return (
    <div className="pb-latest" role="group" aria-label="Latest payout">
      <span className="pb-widget-eyebrow">Latest payout</span>
      <strong className="pb-latest-amount">{widgetApi.formatFieldValue(amount, row[amount.key])}</strong>
      <span className={`ledger-status ${payoutTone(state)}`}>{payoutLabel(state)}</span>
      <span className="pb-widget-note">
        {agent ? `${widgetApi.formatFieldValue(agent, row[agent.key])} · ` : ""}{widgetApi.formatFieldValue(date, row[date.key])}
      </span>
    </div>
  );
}

const titleOnlyForm = <T,>(items: { key: string; label: string }[]) => (params: AgWidgetFormParams<T & { dataMapping: object }>) =>
  params.createDefaults({ dataMappingItems: items as never });

export const payoutPipelineDefinition: PipelineDefinition = {
  id: "payout-pipeline",
  label: "Payout pipeline",
  dataMapping: {
    stage: { type: "field", supportedRoles: ["category"], required: true, aiDescription: "The payout status field (allocations.payout_state)." },
    amount: { type: "field", supportedRoles: ["numeric"], required: true, requires: { per: "dataMapping.stage", cardinality: "one" }, aiDescription: "The allocation amount in USD, summed (allocations.allocation_usd with aggregation sum)." },
    count: { type: "field", supportedRoles: ["numeric"], requires: { per: "dataMapping.stage", cardinality: "one" }, aiDescription: "Optional: number of allocations, summed (allocations.allocation_count with aggregation sum)." },
  },
  form: titleOnlyForm<PayoutPipelineWidget>([{ key: "stage", label: "Payout status" }, { key: "amount", label: "Amount" }, { key: "count", label: "Count" }]),
  comp: PayoutPipeline,
  defaultSize: { width: 900, height: 150 },
  minSize: { width: 240, height: 140 },
  ai: {
    label: "Payout pipeline",
    description: "Shows how much allocated money is waiting to be sent, sent and awaiting PayPal, paid, or needs attention, as one stacked bar with an amount per stage.",
    usage: "Use to show payout progress for allocations. Needs a payout status field and an amount field; do not use for other categories.",
    configuration: "Map stage to allocations.payout_state, amount to allocations.allocation_usd (sum), and optionally count to allocations.allocation_count (sum). Give it the full page width.",
  },
};

export const latestPayoutDefinition: LatestDefinition = {
  id: "latest-payout",
  label: "Latest payout",
  dataMapping: {
    date: { type: "field", supportedRoles: ["temporal"], required: true, aiDescription: "When the allocation was created (allocations.created_at)." },
    amount: { type: "field", supportedRoles: ["numeric"], required: true, aiDescription: "The allocation amount in USD (allocations.allocation_usd, sum)." },
    status: { type: "field", supportedRoles: ["category"], required: true, aiDescription: "The payout status (allocations.payout_state)." },
    agent: { type: "field", supportedRoles: ["category"], aiDescription: "Optional: the agent that won (allocations.agent)." },
  },
  form: titleOnlyForm<LatestPayoutWidget>([{ key: "date", label: "Date" }, { key: "amount", label: "Amount" }, { key: "status", label: "Payout status" }, { key: "agent", label: "Agent" }]),
  comp: LatestPayout,
  defaultSize: { width: 240, height: 130 },
  minSize: { width: 150, height: 110 },
  ai: {
    label: "Latest payout",
    description: "A card with the most recent allocation: its amount, payout status and agent.",
    usage: "Use to show the newest allocation and whether it has been paid.",
    configuration: "Map date to allocations.created_at, amount to allocations.allocation_usd (sum), status to allocations.payout_state and agent to allocations.agent.",
  },
};
