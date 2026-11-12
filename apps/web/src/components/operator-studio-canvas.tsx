"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgStudio, AgStudioProvider, createWidgets } from "ag-studio-react";
import {
  AgStudioAiModule,
  createAiHarness,
  directLlmRunner,
  studioTheme,
  type AgAiHarnessSetup,
  type AgAiPromptStarter,
  type AgDataSourcesDefinition,
  type AgReportState,
  type AgResponsiveLayoutBreakpoint,
  type AgStudioApi,
  type AgStudioMode,
  type AgWidgetLayoutState,
} from "ag-studio";
import type { OperatorStudioRow } from "./operator-studio";
import { studioAiAdapter } from "./studio-ai-adapter";
import { bottom, phoneLayout, studioAllocationData } from "./studio-dashboard-data";
import { latestPayoutDefinition, payoutPipelineDefinition, payoutShortLabel, type DashboardRegistry } from "./studio-widgets";

const usd = { format: "currencyFormat", formatOptions: { format: "$#,##0.00" } } as const;

// ---------------------------------------------------------------- look

// The site's palette: ink, lime accent, olive, paper and line, with amber and terracotta for waiting and failed.
const INK = "#20221d", LIME = "#d6ef73", OLIVE = "#657b19", PAPER = "#f6f5ef", WHITE = "#fffef9", LINE = "#dddfd4", MUTED = "#707168";
const SANS = "DM Sans, Arial, sans-serif";
// Site colours: green first, then ink, amber and terracotta. Categorical only: a series colour never means a payout state.
const SERIES = ["#9ab832", INK, "#d9b45a", "#c98a72", "#718e24", "#93978a", "#5d7325", "#d6ef73"];
const theme = studioTheme.withParams({
  studioAiPanelWidth: 350,
  fontFamily: SANS, studioCanvasFontFamily: SANS, chartFontFamily: SANS,
  studioWidgetTitleFontFamily: SANS, studioWidgetSubtitleFontFamily: SANS, studioWidgetCaptionFontFamily: SANS,
  studioWidgetTitleFontSize: 14, studioWidgetTitleFontWeight: 600, studioWidgetTitleTextColor: INK,
  studioWidgetSubtitleTextColor: MUTED, studioWidgetCaptionTextColor: MUTED,
  foregroundColor: INK, textColor: INK, subtleTextColor: MUTED, chartTextColor: INK, chartSubtleTextColor: MUTED,
  accentColor: OLIVE, chartAccentColor: OLIVE, borderColor: LINE, chartBorderColor: LINE, iconColor: INK,
  backgroundColor: WHITE, studioCanvasBackgroundColor: PAPER, studioWidgetBackgroundColor: WHITE,
  studioWidgetBorder: { width: 1, color: LINE }, studioWidgetBorderRadius: 7, studioWidgetPadding: 6,
  studioWrapperBackgroundColor: PAPER, studioPanelContainerBackgroundColor: WHITE,
  studioToggleButtonActiveBackgroundColor: LIME, studioToggleButtonActiveBorderColor: OLIVE, studioToggleButtonActiveColor: INK,
  studioValueWidgetFontSize: 28,
  rowHoverColor: "#f7f8f0",
  // Studio's own frame would otherwise refuse to shrink below 600 x 600: the page sizes it instead.
  studioMinWidth: 0, studioMinHeight: 0,
  // The page draws the frame (border, radius); Studio's own inset would only take width from phones.
  studioWrapperSpacing: 0, studioCanvasBorder: false, studioCanvasShadow: "none",
  chartPaletteFills1Color: SERIES[0], chartPaletteFills2Color: SERIES[1], chartPaletteFills3Color: SERIES[2], chartPaletteFills4Color: SERIES[3],
  chartPaletteFills5Color: SERIES[4], chartPaletteFills6Color: SERIES[5], chartPaletteFills7Color: SERIES[6], chartPaletteFills8Color: SERIES[7],
  chartPaletteStrokes1Color: OLIVE, chartPaletteStrokes2Color: INK, chartPaletteStrokes3Color: "#9a7417", chartPaletteStrokes4Color: "#8a3b25",
  chartPaletteStrokes5Color: "#5d7325", chartPaletteStrokes6Color: "#707168", chartPaletteStrokes7Color: "#3f4f12", chartPaletteStrokes8Color: OLIVE,
});

// ---------------------------------------------------------------- layout

const ROW_HEIGHT = 16, PAGE_PADDING = 8, PHONE_MAX = 600;
const FILL = { width: "100%", height: "100%" } as const;
const title = (text: string, subtitle?: string) => ({
  title: { enabled: true, text },
  ...(subtitle ? { subtitle: { enabled: true, text: subtitle } } : {}),
});
const valueLabel = (text: string) => ({
  style: { label: { enabled: true, text, position: "above" as const }, textAlign: "left" as const, verticalAlign: "top" as const },
});

const initialState: AgReportState<DashboardRegistry> = {
  pages: [{
    id: "earnings",
    widgets: {
      "allocated-total": {
        type: "value",
        dataMapping: { value: [{ id: "allocations.allocation_usd", aggregation: "sum" }], sparklineX: [{ id: "allocations.created_on" }] },
        format: valueLabel("Allocated to you"),
      },
      "paid-total": {
        type: "value",
        dataMapping: { value: [{ id: "allocations.paid_usd", aggregation: "sum" }] },
        format: valueLabel("Paid out by PayPal"),
      },
      "latest-payout": {
        type: "latest-payout",
        dataMapping: {
          date: [{ id: "allocations.created_at" }], amount: [{ id: "allocations.allocation_usd", aggregation: "sum" }],
          status: [{ id: "allocations.payout_state" }], agent: [{ id: "allocations.agent" }],
        },
      },
      "win-count": {
        type: "value",
        dataMapping: { value: [{ id: "allocations.allocation_count", aggregation: "sum" }] },
        format: valueLabel("Winning entries"),
      },
      "payout-pipeline": {
        type: "payout-pipeline",
        dataMapping: {
          stage: [{ id: "allocations.payout_state" }], amount: [{ id: "allocations.allocation_usd", aggregation: "sum" }],
          count: [{ id: "allocations.allocation_count", aggregation: "sum" }],
        },
      },
      "earnings-over-time": {
        type: "area-chart",
        dataMapping: { categoryKey: [{ id: "allocations.created_on" }], valueKey: [{ id: "allocations.cumulative_usd", aggregation: "max" }] },
        format: { ...title("Earnings over time", "Running total allocated, USD, by day"), style: { custom: { categoryAxisMode: "continuous" } } },
      },
      "by-agent": {
        type: "bar-chart-grouped",
        dataMapping: { categoryKey: [{ id: "allocations.agent" }], valueKey: [{ id: "allocations.allocation_usd", aggregation: "sum" }] },
        format: title("By agent", "Allocated, USD"),
        sort: [{ field: { id: "allocations.allocation_usd", aggregation: "sum" }, direction: "desc" }],
      },
      "by-status": {
        type: "donut-chart",
        dataMapping: { categoryKey: [{ id: "allocations.payout_state" }], valueKey: [{ id: "allocations.allocation_usd", aggregation: "sum" }] },
        format: title("By payout state", "Allocated, USD"),
      },
    },
    // The canvas is never drawn narrower than the page's minimum width, so lower it for phones; match the site's
    // paper background and card borders.
    layout: {
      minWidth: 280, rowHeight: ROW_HEIGHT, pagePadding: PAGE_PADDING, widgetPadding: 6,
      backgroundColor: PAPER, widgetBackgroundColor: WHITE,
      widgetBorderEnabled: true, widgetBorderColor: LINE, widgetBorderWidth: 1, widgetBorderRadius: 7,
    },
    widgetLayout: {
      "allocated-total": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 8 },
      "paid-total": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 8 },
      "latest-payout": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 8 },
      "win-count": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 8 },
      "payout-pipeline": { xTrack: 0, yTrack: 8, xSpan: 24, ySpan: 10 },
      "earnings-over-time": { xTrack: 0, yTrack: 18, xSpan: 11, ySpan: 17 },
      "by-agent": { xTrack: 11, yTrack: 18, xSpan: 6, ySpan: 17 },
      "by-status": { xTrack: 17, yTrack: 18, xSpan: 7, ySpan: 17 },
    },
  }],
  selectedPageId: "earnings",
} as AgReportState<DashboardRegistry>;

// ---------------------------------------------------------------- assistant

const PROMPT_STARTERS: AgAiPromptStarter[] = [
  { label: "Earnings by agent this week", prompt: "Show my earnings by agent for the last 7 days as a bar chart." },
  { label: "What's not paid yet?", prompt: "How much of my allocated money has not been paid out yet, and in which payout states?" },
  { label: "Earnings per day", prompt: "Add a column chart of allocated earnings per day." },
];

const LOCALE_TEXT = { aiMessageInputPlaceholder: "Ask about your earnings, or for a new chart" };
// Studio's delegate_to takes the target as an object ({ id, ...its params }). Haiku sometimes sent a bare agent name,
// which Studio rejects ("no target agent specified"), so the description says it in so many words, for every agent.
const AI_TEXT = {
  "tools.delegate_to.description": "Delegate a subtask to a specialised sub-agent, which runs it and returns a summary. You retain control of the conversation. Pick the target agent and give it a concise task. `type` must be an object holding the agent id and that agent's parameters, never a bare string: for example {\"type\": {\"id\": \"page\", \"pageId\": \"earnings\"}, \"instructions\": \"...\"} or {\"type\": {\"id\": \"widget\", \"widgetType\": \"bar-chart-grouped\", \"widgetId\": \"<id of the widget on the page>\"}, \"instructions\": \"...\"}.",
};

const ANALYST_INSTRUCTIONS = `You are the payout analyst on a provable.bid agent operator's earnings dashboard.
The data is one table, "allocations": one row per winning entry by one of this operator's agents.
- allocation_usd: the operator's share of a buyer's payment (95% of the price), in US dollars. Allocated money is owed, not necessarily received.
- paid_usd: allocation_usd when PayPal reported the payout as paid (or the demo recorded it as simulated), else 0.
- payout_state: paid (PayPal Payouts success), pending (sent, awaiting PayPal, includes unclaimed), queued or not_scheduled (not sent yet), failed, blocked (on hold, e.g. a dispute), simulated (demo mode, no money moved).
- ledger_state: allocated, held or reversed. agent: the winning agent's name. created_at: when the allocation was made; created_on: its day.
- cumulative_usd: running total of allocation_usd in created order (use aggregation max over time).
Rules: answer from the data only (run execute_query); never invent amounts. Always format money with $ and two decimals. Say "allocated" for money owed and "paid" only for paid payouts. In PayPal sandbox the money is test money.
When the user asks to show, chart, plot, compare, add, change, move or remove something, they want the dashboard changed: delegate to the lead agent with a precise brief naming the widget type, fields, aggregations and any date filter (for example a widget filter on created_at for "this week"), then say in one or two sentences what was added and what it shows. Answer pure questions (how much, which, why) yourself with execute_query. Keep replies short.`;

// ---------------------------------------------------------------- component

export default function OperatorStudioCanvas({ rows, licenseKey, assistant }: {
  rows: OperatorStudioRow[];
  licenseKey?: string;
  /** The operator's API base and credential, when the API offers the dashboard assistant. */
  assistant?: { baseUrl: string; token: string } | null;
}) {
  const { allocations, missingAmounts } = useMemo(() => studioAllocationData(rows), [rows]);
  const data = useMemo<AgDataSourcesDefinition<DashboardRegistry>>(() => ({
    sources: [{
      id: "allocations",
      name: "Allocations",
      data: allocations,
      fields: [
        { id: "created_at", name: "Created", format: "dateTimeFormat", formatOptions: { format: "d mmm, h:mm am/pm" }, description: "When the allocation was made." },
        { id: "created_on", name: "Day", format: "dateFormat", formatOptions: { format: "d mmm" }, description: "The day the allocation was made." },
        { id: "agent", name: "Agent", format: "textFormat", description: "The winning agent's name." },
        // Raw contract states, shown in the site's words.
        { id: "payout_state", name: "Payout status", format: "textFormat", createValueFormatter: () => (value: string) => payoutShortLabel(value), description: "paid, pending, queued, not_scheduled, failed, blocked or simulated." },
        { id: "ledger_state", name: "Ledger status", format: "textFormat", description: "allocated, held or reversed." },
        { id: "allocation_usd", name: "Allocated (USD)", ...usd, description: "The operator's share of the buyer's payment, in dollars." },
        { id: "paid_usd", name: "Paid (USD)", ...usd, description: "The allocation, when PayPal reported the payout as paid; else 0." },
        { id: "cumulative_usd", name: "Running total (USD)", ...usd, description: "Running total of allocations in created order." },
        { id: "allocation_count", name: "Allocations", format: "integerFormat", description: "1 per allocation; sum it to count wins." },
      ],
    }],
  }) as AgDataSourcesDefinition<DashboardRegistry>, [allocations]);

  const widgets = useMemo(() => createWidgets<DashboardRegistry>({
    additionalTypes: [payoutPipelineDefinition, latestPayoutDefinition],
  } as never), []);

  // Size Studio's frame to the canvas Studio is actually showing, so nothing is clipped inside it: the layout
  // functions below are called by Studio for the breakpoint in use, and report how many rows they laid out.
  const [mode, setMode] = useState<AgStudioMode>("view");
  // On a phone the assistant panel takes the whole frame (its default 350px would be cut off); the dashboard is one tap away.
  const frame = useRef<HTMLDivElement>(null);
  const [narrowWidth, setNarrowWidth] = useState(0);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      setNarrowWidth(width > 0 && width < 420 ? width : 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const studioThemeForWidth = useMemo(() => (narrowWidth ? theme.withParams({ studioAiPanelWidth: narrowWidth }) : theme), [narrowWidth]);
  const [rowsShown, setRowsShown] = useState(bottom(Object.values(initialState.pages[0].widgetLayout ?? {}) as AgWidgetLayoutState[]));
  const reportRows = useCallback((count: number) => queueMicrotask(() => setRowsShown((prev) => (prev === count ? prev : count))), []);
  const breakpoints = useMemo<AgResponsiveLayoutBreakpoint[]>(() => [
    { maxWidth: PHONE_MAX, layout: (candidates, { columns }) => { const out = phoneLayout(candidates, columns); reportRows(bottom(out)); return out; } },
    { layout: (candidates) => { const out = candidates.map((c) => c.layout); reportRows(bottom(out)); return out; } },
  ], [reportRows]);
  const height = mode === "edit" ? Math.max(720, rowsShown * ROW_HEIGHT + 2 * PAGE_PADDING + 24) : rowsShown * ROW_HEIGHT + 2 * PAGE_PADDING + 6;

  const adapter = useMemo(() => (assistant ? studioAiAdapter(assistant) : null), [assistant]);
  // A custom agent of ours fronts the conversation and hands dashboard changes to Studio's built-in lead, which
  // delegates to the page and widget agents. All of them run Studio's loop in the page against Claude via our API.
  const ai = useMemo<AgAiHarnessSetup | undefined>(() => adapter ? ({ api }) => createAiHarness(api as AgStudioApi, ({ builtIn, tools }) => ({
    agents: [
      ...Object.values(builtIn).map((definition) => directLlmRunner({ ...definition, adapter })),
      directLlmRunner({
        id: "payout-analyst",
        name: "Payout analyst",
        description: "Answers questions about this operator's allocations and payouts, and asks the lead agent to change the dashboard.",
        adapter,
        schema: (s) => s.undefined(),
        instructions: () => ANALYST_INSTRUCTIONS,
        tools: () => [tools.studio.viewSchema(), tools.studio.viewPage(), tools.studio.executeQuery(), tools.renameThread(), tools.delegateTo(["lead"])],
        maxTurns: 24,
      }),
    ],
    primary: "payout-analyst",
    promptStarters: PROMPT_STARTERS,
  })) : undefined, [adapter]);
  const modules = useMemo(() => (ai ? [AgStudioAiModule] : []), [ai]);

  return (
    <section className="studio-dashboard" aria-label="Allocation dashboard">
      <div className="studio-dashboard-head">
        <div>
          <h3>Earnings dashboard</h3>
          <p className="muted">From your loaded allocations only. Allocated is what you are owed; paid is what PayPal reported as paid.</p>
        </div>
        {ai && (
          <div className="studio-mode" role="group" aria-label="Dashboard mode">
            <button type="button" className={mode === "view" ? "active" : ""} aria-pressed={mode === "view"} onClick={() => setMode("view")}>Dashboard</button>
            <button type="button" className={mode === "edit" ? "active" : ""} aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>Ask Claude</button>
          </div>
        )}
      </div>
      {missingAmounts > 0 && <p role="status">{missingAmounts} loaded allocation{missingAmounts === 1 ? " has" : "s have"} no valid amount and {missingAmounts === 1 ? "is" : "are"} excluded from amount totals.</p>}
      <div className={`studio-canvas ${mode}`} ref={frame} style={{ height }}>
        <AgStudioProvider licenseKey={licenseKey} modules={modules}>
          <AgStudio<DashboardRegistry>
            // `ai` is read once, when Studio is created.
            key={ai ? "assistant" : "plain"}
            style={FILL}
            data={data}
            initialState={initialState}
            mode={mode}
            theme={studioThemeForWidth}
            widgets={widgets}
            ai={ai}
            // No filters are configured, so the view-mode Filters panel would only say "No filters available".
            panels={{ view: {}, edit: { right: ["ai"] } }}
            localeText={LOCALE_TEXT}
            aiText={AI_TEXT}
            responsiveLayoutBreakpoints={breakpoints}
          />
        </AgStudioProvider>
      </div>
    </section>
  );
}
