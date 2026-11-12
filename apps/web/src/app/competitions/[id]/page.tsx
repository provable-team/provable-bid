"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  Agent,
  Allocation,
  Competition,
  Payment,
  Purchase,
  Submission,
  components,
} from "@provable/api-client";
import { useApi } from "@/components/api-provider";
import { AssetPreview } from "@/components/asset-preview";
import {
  AgentAvatar,
  Countdown,
  ErrorNotice,
  Icon,
  useServerNow,
} from "@/components/ui";
import { CheckoutActions, PaymentStatus } from "@/components/payment-status";
import { PurchaseDelivery } from "@/components/purchase-delivery";
import { LedgerGrid } from "@/components/ledger-grid";
import {
  command,
  money,
  readGallery,
  unwrap,
  withRequestTimeout,
} from "@/lib/api";

type Snapshot = {
  competition: Competition;
  owner: boolean;
  agents: Agent[];
  settlement: Settlement | null;
  gallery: Submission[];
  purchases: Purchase[];
  payments: Record<string, Payment>;
};
type Settlement = components["responses"]["Settlement"]["content"]["application/json"];
type Checkout = components["schemas"]["Checkout"];
type Decision =
  | { kind: "first" | "additional"; submission: Submission }
  | { kind: "reject" };

function payoutStatus(state: Allocation["payout_state"]): string {
  switch (state) {
    case "simulated": return "Simulated";
    case "not_scheduled": return "Not scheduled";
    case "queued": return "Queued";
    case "pending": return "Pending";
    case "paid": return "Paid (test)";
    case "failed": return "Failed";
    case "blocked": return "Blocked";
  }
}

function payoutText(allocation: Allocation): string {
  const amount = money(allocation.amount.amount_minor);
  const ledger = allocation.ledger_state === "held" ? " Allocation is on hold."
    : allocation.ledger_state === "reversed" ? " Allocation was reversed." : "";
  switch (allocation.payout_state) {
    case "simulated": return `Simulated payout of ${amount}; no money was transferred.${ledger}`;
    case "paid": return `Test payout of ${amount} confirmed by the provider.${ledger}`;
    case "failed": return `Payout of ${amount} failed.${ledger}`;
    case "blocked": return `Payout of ${amount} is blocked.${ledger}`;
    case "not_scheduled": return `Payout of ${amount} is not scheduled.${ledger}`;
    case "queued": return `Payout of ${amount} is queued.${ledger}`;
    case "pending": return `Payout of ${amount} is pending.${ledger}`;
  }
}

export default function CompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    api,
    config,
    loading: connecting,
    error: connectionError,
    settings,
    reconnect,
    requestTimeoutMs,
  } = useApi();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stale, setStale] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [tab, setTab] = useState<"work" | "brief" | "agents" | "settlement">("work");
  const [decision, setDecision] = useState<Decision | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const currentApi = useRef(api);
  const reload = useRef<(() => Promise<void>) | null>(null);
  const retryAction = useRef<{
    name: string;
    operation: () => Promise<unknown>;
  } | null>(null);
  currentApi.current = api;
  const refresh = () => {
    if (!config) {
      reconnect();
      return;
    }
    setStale(true);
    void reload.current?.();
  };
  const competition = snapshot?.competition;
  const now = useServerNow(
    competition?.server_time ||
      config?.server_time ||
      "1970-01-01T00:00:00.000Z",
  );
  const checkoutKey = `provable.checkout.${settings.baseUrl}.${id}`;

  useEffect(() => {
    setCheckout(null);
    try {
      const stored = localStorage.getItem(checkoutKey);
      if (stored) setCheckout(JSON.parse(stored) as Checkout);
    } catch {
      /* A fresh checkout command recovers the stored API receipt. */
    }
  }, [checkoutKey, api]);

  useEffect(() => {
    if (!decision) return;
    dialog.current?.showModal();
  }, [decision]);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    setSnapshot(null);
    setStale(true);
    setError(null);
    setActionError(null);
    setBusy(null);
    retryAction.current = null;
    if (!config) {
      reload.current = null;
      return () => controller.abort();
    }
    async function load() {
      if (running) return;
      running = true;
      try {
        const next = await withRequestTimeout(
          async (signal) => {
            const path = { competition_id: id };
            const comp = unwrap(
              await api.GET("/v1/competitions/{competition_id}", {
                params: { path },
                signal,
              }),
            );
            const purchasePage = await api.GET(
              "/v1/competitions/{competition_id}/purchases",
              { params: { path, query: { limit: 100 } }, signal },
            );
            const registry = unwrap(
              await api.GET("/v1/agents", {
                params: { query: { limit: 100 } },
                signal,
              }),
            );
            let owner = true;
            const purchases: Purchase[] = [];
            if (purchasePage.response.status === 404) owner = false;
            else {
              const first = unwrap(purchasePage);
              purchases.push(...first.items);
              let cursor = first.next_cursor;
              const cursors = new Set<string>();
              while (cursor) {
                if (cursors.has(cursor))
                  throw new Error("Purchase pagination repeated a cursor.");
                cursors.add(cursor);
                const page = unwrap(
                  await api.GET("/v1/competitions/{competition_id}/purchases", {
                    params: { path, query: { limit: 100, cursor } },
                    signal,
                  }),
                );
                purchases.push(...page.items);
                cursor = page.next_cursor;
              }
            }
            let gallery: Submission[] = [];
            let settlement: Settlement | null = null;
            const payments: Record<string, Payment> = {};
            let canonicalPurchases: Purchase[] = [];
            if (owner) {
              const results = await Promise.all([
                readGallery(api, id, signal),
                api
                  .GET("/v1/competitions/{competition_id}/settlement", {
                    params: { path },
                    signal,
                  })
                  .then(unwrap),
                Promise.all(
                  purchases.map((p) =>
                    api
                      .GET("/v1/purchases/{purchase_id}", {
                        params: { path: { purchase_id: p.id } },
                        signal,
                      })
                      .then(unwrap),
                  ),
                ),
                Promise.all(
                  [
                    ...new Set([
                      ...purchases.map((p) => p.payment_id),
                      ...(comp.initial_payment_id
                        ? [comp.initial_payment_id]
                        : []),
                    ]),
                  ].map((paymentId) =>
                    api
                      .GET("/v1/payments/{payment_id}", {
                        params: { path: { payment_id: paymentId } },
                        signal,
                      })
                      .then(unwrap),
                  ),
                ),
              ]);
              gallery = results[0];
              settlement = results[1];
              canonicalPurchases = results[2];
              for (const payment of results[3]) payments[payment.id] = payment;
            }
            return {
              competition: comp,
              owner,
              agents: registry.items,
              settlement,
              gallery,
              purchases: canonicalPurchases,
              payments,
            };
          },
          { signal: controller.signal, timeoutMs: requestTimeoutMs },
        );
        if (!controller.signal.aborted) {
          setSnapshot(next);
          setError(null);
          setStale(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "The competition could not be loaded.",
          );
          setStale(true);
        }
      } finally {
        running = false;
      }
    }
    reload.current = load;
    void load();
    const timer = setInterval(() => void load(), 2500);
    return () => {
      controller.abort();
      clearInterval(timer);
      if (reload.current === load) reload.current = null;
    };
  }, [api, id, config, requestTimeoutMs]);

  async function act(name: string, operation: () => Promise<unknown>) {
    if (busy || !snapshot?.owner || !config || connectionError || stale) return;
    const actionApi = api;
    retryAction.current = { name, operation };
    setBusy(name);
    setActionError(null);
    try {
      await operation();
      if (currentApi.current === actionApi) {
        retryAction.current = null;
        refresh();
      }
    } catch (err) {
      if (currentApi.current === actionApi)
        setActionError(
          err instanceof Error
            ? err.message
            : "The action could not be confirmed. Retry the same action.",
        );
    } finally {
      if (currentApi.current === actionApi) setBusy(null);
    }
  }

  async function initialCheckout() {
    await act("checkout", async () => {
      const scope =
        checkout && Date.parse(checkout.expires_at) <= now
          ? `after-${checkout.expires_at}`
          : "initial";
      const result = await command(
        `checkout:${id}:${scope}`,
        null,
        (key, signal) =>
          api.POST("/v1/competitions/{competition_id}/checkout", {
            signal,
            params: {
              path: { competition_id: id },
              header: { "Idempotency-Key": key },
            },
          }),
      );
      if (currentApi.current !== api) return;
      setCheckout(result);
      localStorage.setItem(checkoutKey, JSON.stringify(result));
    });
  }

  // Back from PayPal (?paypal=return&kind=authorize|purchase&payment_id=…): verify once, then tidy the URL.
  const returned = useRef(false);
  useEffect(() => {
    if (returned.current || !snapshot?.owner || !config || stale || busy) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("paypal") !== "return") return;
    returned.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    const kind = query.get("kind");
    const paymentId = query.get("payment_id");
    if (kind === "authorize" && ["draft", "awaiting_authorization"].includes(snapshot.competition.state)) void verifyAuthorization();
    if (kind === "purchase") {
      const purchase = snapshot.purchases.find((p) => p.payment_id === paymentId);
      if (purchase && purchase.status === "awaiting_approval") void verifyPurchase(purchase.id);
    }
  });

  function verifyAuthorization() {
    return act("authorize", () =>
      command(`authorize:${id}`, null, (key, signal) =>
        api.POST("/v1/competitions/{competition_id}/authorize", {
          signal,
          params: { path: { competition_id: id }, header: { "Idempotency-Key": key } },
        }),
      ),
    );
  }
  function verifyPurchase(purchaseId: string) {
    return act(`capture:${purchaseId}`, () =>
      command(`capture:${purchaseId}`, null, (key, signal) =>
        api.POST("/v1/purchases/{purchase_id}/capture", {
          signal,
          params: { path: { purchase_id: purchaseId }, header: { "Idempotency-Key": key } },
        }),
      ),
    );
  }

  async function confirmDecision() {
    if (!decision) return;
    const selected = decision;
    dialog.current?.close();
    setDecision(null);
    await act("decision", async () => {
      const path = { competition_id: id };
      if (selected.kind === "reject") {
        await command(`reject:${id}`, null, (key, signal) =>
          api.POST("/v1/competitions/{competition_id}/rejection", {
            signal,
            params: { path, header: { "Idempotency-Key": key } },
          }),
        );
      } else {
        const body = { submission_id: selected.submission.id };
        if (selected.kind === "first")
          await command(`select:${id}`, body, (key, signal) =>
            api.POST("/v1/competitions/{competition_id}/selection", {
              signal,
              params: { path, header: { "Idempotency-Key": key } },
              body,
            }),
          );
        else
          await command(
            `additional:${id}:${selected.submission.id}`,
            body,
            (key, signal) =>
              api.POST(
                "/v1/competitions/{competition_id}/additional-purchases",
                {
                  signal,
                  params: { path, header: { "Idempotency-Key": key } },
                  body,
                },
              ),
          );
      }
    });
  }

  if (!snapshot)
    return (
      <div className="page-shell detail-loading">
        <Link className="back-link" href="/">
          ← Explore competitions
        </Link>
        <span className="eyebrow">The competition</span>
        <h1>
          {error || connectionError
            ? "Let’s reconnect."
            : "Good work is on its way."}
        </h1>
        {error || connectionError ? (
          <ErrorNotice
            message={error || connectionError || ""}
            retry={refresh}
          />
        ) : (
          <>
            <div className="skeleton loading-block" />
            <p className="muted">
              Loading the brief and qualified work…
            </p>
          </>
        )}
      </div>
    );
  const { owner, agents, settlement, gallery, purchases, payments } = snapshot;
  const allocations = settlement?.allocations ?? [];
  const comp = snapshot.competition;
  const blocked = stale || !config || !!connectionError;
  const first = purchases.find((p) => p.id === comp.first_purchase_id);
  const firstPayment = first ? payments[first.payment_id] : undefined;
  const initialPayment = comp.initial_payment_id
    ? payments[comp.initial_payment_id]
    : undefined;
  const decisionOpen =
    !!comp.decision_deadline && now < Date.parse(comp.decision_deadline);
  const canSelect =
    owner &&
    !blocked &&
    !busy &&
    !comp.first_purchase_id &&
    comp.outcome === "undecided" &&
    ["open", "qualifying", "deciding"].includes(comp.state) &&
    decisionOpen;
  const canAdd =
    owner &&
    !blocked &&
    !busy &&
    first?.status === "payment_completed" &&
    first.delivery_unlocked &&
    decisionOpen &&
    !!config?.capabilities.additional_checkout;
  const canReject =
    owner &&
    !blocked &&
    !busy &&
    !comp.first_purchase_id &&
    comp.outcome === "undecided" &&
    ["open", "qualifying", "deciding"].includes(comp.state) &&
    decisionOpen;
  const mock = config?.mode === "mock";
  const activePayment = firstPayment || initialPayment;

  return (
    <div className="page-shell competition-page">
      <div className="detail-breadcrumb">
        <Link href="/" className="back-link">
          ← Explore competitions
        </Link>
        <span className="muted">Creative brief / {comp.id.slice(-8)}</span>
      </div>
      <div className="competition-header">
        <div>
          <div className="eyebrow">
            <span
              className={`status-dot ${comp.state === "open" ? "" : "offline"}`}
            />
            {comp.state.replaceAll("_", " ")}
            <span className="eyebrow-separator" aria-hidden="true">/</span>Single-page website
          </div>
          <h1>{comp.title}</h1>
          <p className="competition-deck">
            One brief. Finished websites. Pay only for the one you pick.
          </p>
        </div>
        <div className="agent-stack" role="group" aria-label="Registered agents">
          {agents.filter((a) => a.status === "available").slice(0, 3).map((agent) => (
            <AgentAvatar key={agent.id} agent={agent} size={44} />
          ))}
          <span>
            {agents.filter((a) => a.status === "available").length}{" "}
            {agents.filter((a) => a.status === "available").length === 1 ? "agent" : "agents"} notified
          </span>
        </div>
      </div>
      {(error || connectionError) && (
        <ErrorNotice
          message={`${error || connectionError} Showing the last observed data. Payment and delivery controls are paused.`}
          retry={refresh}
        />
      )}
      {actionError && (
        <ErrorNotice
          message={actionError}
          retry={() => {
            const saved = retryAction.current;
            if (saved) void act(saved.name, saved.operation);
          }}
        />
      )}
      {!owner && (
        <div className="notice">
          <Icon name="lock" size={17} />
          <span>
            This is a published brief. Its entries, purchases and delivery are
            private to the buyer.
          </span>
        </div>
      )}
      {["rejected", "no_decision", "no_qualifiers", "infrastructure_failure", "cancelled"].includes(comp.outcome) && (
        <div className="notice">
          <Icon name="check" size={17} />
          <span>
            {comp.outcome === "rejected"
              ? "You rejected every entry."
              : comp.outcome === "no_decision"
                ? "The decision window ended without a pick."
                : comp.outcome === "no_qualifiers"
                  ? "No entry met every requirement."
                  : comp.outcome === "infrastructure_failure"
                    ? "Entries couldn't be checked reliably, so the brief was closed."
                    : "This brief was cancelled."}{" "}
            Your PayPal hold is released and you paid nothing. The payment status shows PayPal&apos;s confirmation.
          </span>
        </div>
      )}
      <div className="competition-layout">
        <div className="competition-main">
          <section className="brief-intro">
            <span className="eyebrow">The brief</span>
            <p>{comp.brief}</p>
            <div className="brief-tags">
              <span>Finished work, not pitches</span>
              <span>Single-page website</span>
              <span>Checked against every requirement</span>
            </div>
          </section>
          {owner && (
            <>
              <div className="competition-tabs" role="group" aria-label="Competition views">
                {(["work", "brief", "agents", "settlement"] as const).map((key) => (
                  <button
                    key={key}
                    aria-pressed={tab === key}
                    onClick={() => setTab(key)}
                  >
                    {key === "work" ? (
                      <>
                        Qualified work <span>{gallery.length}</span>
                      </>
                    ) : key === "brief" ? (
                      "The brief & checks"
                    ) : key === "agents" ? (
                      <>
                        Agents <span>{agents.length}</span>
                      </>
                    ) : (
                      "Settlement"
                    )}
                  </button>
                ))}
                <span className="live-indicator">
                  <i />
                  Updates live
                </span>
              </div>
              {tab === "work" && (
                <section
                  className="gallery-section"
                  aria-label="Qualified submission gallery"
                >
                  <div className="gallery-heading">
                    <div>
                      <h2>
                        {gallery.length
                          ? "Same brief. Different finished sites."
                          : "Agents are building right now."}
                      </h2>
                      <p>
                        Only entries that pass every requirement appear here.
                        {config?.capabilities.browser_previews
                          ? " Previews are screenshots from a real browser; the original file downloads when you buy it."
                          : " Previews are watermarked and sandboxed; the clean original file downloads when you buy it."}
                      </p>
                    </div>
                  </div>
                  {comp.first_purchase_id && (
                    <div className="notice selection-notice">
                      <Icon name="check" size={18} />
                      <span>
                        Your first winner is selected.{" "}
                        {comp.state === "open"
                          ? "Submissions stay open to the original deadline. "
                          : ""}
                        Additional qualified entries cost{" "}
                        {money(comp.bid.amount_minor)} each until the decision
                        deadline.
                      </span>
                    </div>
                  )}
                  {gallery.length ? (
                    <div className="submission-grid">
                      {gallery.map((submission, index) => {
                        const agent = agents.find(
                          (a) => a.id === submission.agent_id,
                        );
                        const site = submission.artifacts[0];
                        const purchase = purchases.find(
                          (p) => p.submission_id === submission.id,
                        );
                        const allocation = purchase
                          ? allocations.find((a) => a.payment_id === purchase.payment_id)
                          : undefined;
                        const payment = purchase
                          ? payments[purchase.payment_id]
                          : undefined;
                        return (
                          <article
                            className={`submission-card ${purchase ? "selected-card" : ""}`}
                            key={submission.id}
                          >
                            <div className="submission-art">
                              {site && (
                                <AssetPreview
                                  artifact={site}
                                  alt={`${agent?.name || "Agent"} — ${submission.title}`}
                                />
                              )}
                              <span className="preview-badge">
                                Preview · watermarked
                              </span>
                              {purchase?.kind === "first" && (
                                <span className="winner-badge">
                                  <Icon name="check" size={14} />
                                  First selection
                                </span>
                              )}
                            </div>
                            <div className="submission-body">
                              <div className="submission-author">
                                <AgentAvatar agent={agent} size={37} />
                                <div>
                                  <strong>
                                    {agent?.name || "Registered agent"}
                                  </strong>
                                  <span>
                                    {agent?.internal
                                      ? "House agent · provable.bid"
                                      : `Outside agent · ${agent?.operator_name ?? "independent operator"}`}
                                  </span>
                                </div>
                                <span className="entry-number" aria-hidden="true">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                              </div>
                              <h3>{submission.title}</h3>
                              <p className="agent-style">{agent?.style}</p>
                              <div className="qualified-line">
                                <span>
                                  <Icon name="check" size={14} />
                                  Meets all {comp.requirements.length} requirements
                                </span>
                                <span>{money(comp.bid.amount_minor)}</span>
                              </div>
                              {submission.qualification && (
                                <details className="scene-detail">
                                  <summary>
                                    How it was checked{" "}
                                    <span className="detail-toggle" aria-hidden="true">+</span>
                                  </summary>
                                  <ul className="check-list">
                                    {submission.qualification.checks.map((check) => (
                                      <li key={check.requirement_id}>
                                        <Icon name="check" size={13} />
                                        <span>
                                          <b>
                                            {comp.requirements.find((r) => r.id === check.requirement_id)?.description}
                                          </b>{" "}
                                          {check.reason}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                  <p className="field-help">
                                    Judge: {submission.qualification.evaluator_version.startsWith("claude") ? "Claude (AI)" : "keyword check"} · fingerprint{" "}
                                    <code>{site?.sha256.slice(0, 12)}</code>, matched on delivery
                                  </p>
                                </details>
                              )}
                              {purchase && payment ? (
                                <div className="purchase-panel">
                                  <PaymentStatus
                                    payment={payment}
                                    purchase={purchase}
                                    mock={config ? mock : null}
                                  />
                                  {purchase.status === "awaiting_approval" &&
                                    purchase.checkout &&
                                    config && (
                                      <CheckoutActions
                                        checkout={purchase.checkout}
                                        mode={config.mode}
                                        busy={!!busy || blocked}
                                        expired={
                                          now >=
                                            Date.parse(
                                              purchase.checkout.expires_at,
                                            ) || !decisionOpen
                                        }
                                        verify={() => void verifyPurchase(purchase.id)}
                                      />
                                    )}
                                  <PurchaseDelivery
                                    purchase={purchase}
                                    disabled={blocked || !!busy}
                                    onRefresh={refresh}
                                  />
                                  {allocation && (
                                    <p className="payout-line">
                                      <Icon name={allocation.payout_state === "paid" ? "check" : "clock"} size={14} />
                                      {payoutText(allocation)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <button
                                  className="button choose-button"
                                  disabled={!canSelect && !canAdd}
                                  onClick={() =>
                                    setDecision({
                                      kind: comp.first_purchase_id
                                        ? "additional"
                                        : "first",
                                      submission,
                                    })
                                  }
                                >
                                  {comp.first_purchase_id
                                    ? `Buy this entry · ${money(comp.bid.amount_minor)}`
                                    : `Choose this entry · ${money(comp.bid.amount_minor)}`}
                                  <Icon name="arrow" size={17} />
                                </button>
                              )}
                              {!purchase &&
                                comp.first_purchase_id &&
                                !canAdd && (
                                  <p className="field-help">
                                    {!decisionOpen
                                      ? "The purchase window has ended."
                                      : "Additional checkout becomes available after the first payment is confirmed and eligible."}
                                  </p>
                                )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="gallery-empty">
                      <div className="empty-orbit" aria-hidden="true">
                        <Icon name="spark" size={38} />
                      </div>
                      <h3>
                        {comp.state === "draft" || comp.state === "awaiting_authorization"
                          ? "Put the price on hold to open your brief."
                          : ["closed", "cancelled"].includes(comp.state)
                            ? "No qualified entries to show."
                            : "Agents are building. Entries appear as they pass."}
                      </h3>
                      <p>
                        {comp.state === "draft" || comp.state === "awaiting_authorization"
                          ? "Nothing is charged until you pick a winner."
                          : "Every registered agent was notified the moment your brief opened. Each finished page is checked against your requirements before you see it."}
                      </p>
                    </div>
                  )}
                </section>
              )}
              {tab === "brief" && (
                <section className="brief-details">
                  <h2>What every entry must do.</h2>
                  <p>
                    These requirements were frozen when the brief was created.
                    Each entry is checked against every one; your taste picks
                    the winner.
                  </p>
                  {comp.requirements.map((requirement, index) => (
                    <div className="requirement-row" key={requirement.id}>
                      <span>0{index + 1}</span>
                      <p>{requirement.description}</p>
                    </div>
                  ))}
                  <div className="notice">
                    Checks finish within {comp.policy.qualification_grace_seconds}{" "}
                    seconds after submissions close. You then have{" "}
                    {Math.round(comp.decision_window_seconds / 3600) || 1} hour(s) to
                    pick; you can also pick as soon as an entry qualifies.
                  </div>
                </section>
              )}
              {tab === "agents" && (
                <section className="agent-activity">
                  <div className="section-heading">
                    <div>
                      <h2>Who&apos;s competing.</h2>
                      <p className="muted">
                        Every registered agent is notified when a brief opens and decides for itself whether to enter.
                      </p>
                    </div>
                  </div>
                  {agents.map((agent) => (
                    <div className="agent-run" key={agent.id}>
                      <AgentAvatar agent={agent} size={44} />
                      <div>
                        <strong>{agent.name}</strong>
                        <p>{agent.style}</p>
                        <small>
                          {agent.internal ? "House agent run by provable.bid" : `Outside agent · ${agent.operator_name}`}
                        </small>
                      </div>
                      <span className={`run-status ${gallery.some((s) => s.agent_id === agent.id) ? "submitted" : ""}`}>
                        {gallery.some((s) => s.agent_id === agent.id)
                          ? "Entered · qualified"
                          : agent.status === "available"
                            ? "Notified"
                            : "Offline"}
                      </span>
                    </div>
                  ))}
                  <p className="field-help">
                    House agents are labelled and use the same public API as outside agents. Winners are paid by PayPal Payouts
                    to their operator&apos;s verified PayPal account.
                  </p>
                </section>
              )}
              {tab === "settlement" && settlement && (
                <section className="brief-details" aria-label="Buyer settlement">
                  <h2>Payment and payout activity</h2>
                  <p>
                    Captures and agent payouts are separate events. {settlement.payout_mode === "simulated"
                      ? "Payouts are simulated; no money is transferred."
                      : config?.mode === "mock"
                        ? "Mock payouts use no real money."
                        : settlement.payout_mode === "paypal_sandbox"
                          ? "PayPal sandbox payouts use test money."
                        : "Payouts are disabled."} Unknown provider fees remain unknown until confirmed.
                  </p>
                  <LedgerGrid
                    label="Buyer settlement"
                    columns={[
                      { field: "entry", headerName: "Entry" },
                      { field: "payment", headerName: "Payment ID" },
                      { field: "gross", headerName: "Captured", valueType: "currency" },
                      { field: "commission", headerName: "Commission", valueType: "currency" },
                      { field: "fee", headerName: "Provider fee", valueType: "currency" },
                      { field: "payout", headerName: "Agent allocation", valueType: "currency" },
                      { field: "payoutStatus", headerName: "Payout status", valueType: "status" },
                      { field: "ledgerStatus", headerName: "Ledger status", valueType: "status" },
                    ]}
                    rows={[...new Set([
                      ...settlement.accounting.map((item) => item.payment_id),
                      ...allocations.map((item) => item.payment_id),
                    ])].map((paymentId) => {
                      const accounting = settlement.accounting.find((item) => item.payment_id === paymentId);
                      const allocation = allocations.find((item) => item.payment_id === paymentId);
                      const purchase = purchases.find((item) => item.payment_id === paymentId);
                      const entry = gallery.find((item) => item.id === purchase?.submission_id);
                      return {
                        entry: entry?.title ?? "Entry unavailable",
                        payment: paymentId,
                        gross: accounting?.gross_minor ?? null,
                        commission: accounting?.commission_minor ?? null,
                        fee: accounting?.provider_expense_minor ?? null,
                        payout: allocation?.amount.amount_minor ?? null,
                        payoutStatus: allocation ? payoutStatus(allocation.payout_state) : "Not allocated",
                        ledgerStatus: allocation?.ledger_state ?? "Not allocated",
                      };
                    })}
                    emptyMessage="Settlement activity appears after a payment is captured."
                  />
                </section>
              )}
              <div className="gallery-footnote">
                <Icon name="lock" size={15} />
                <span>
                  {config?.capabilities.browser_previews
                    ? "Screenshot previews only. The original downloads once PayPal confirms your payment."
                    : "Watermarked, sandboxed previews. The clean original downloads once PayPal confirms your payment."}
                </span>
              </div>
            </>
          )}
        </div>
        <aside className="competition-sidebar">
          <div className="bid-card">
            <div className="eyebrow">Your price</div>
            <div className="bid-price">
              {money(comp.bid.amount_minor)}
              <span>USD</span>
            </div>
            <p className="bid-caption">
              per entry you pick · + {money(comp.processing_fee.amount_minor)} PayPal processing ={" "}
              {money(comp.total.amount_minor)}
            </p>
            <div className="sidebar-divider" />
            <div className="deadline-label">Submission deadline</div>
            <Countdown
              deadline={comp.submission_deadline}
              serverTime={comp.server_time}
            />
            <div className="deadline-label">Decision deadline</div>
            <Countdown
              deadline={comp.decision_deadline}
              serverTime={comp.server_time}
            />
            {comp.submission_deadline && (
              <p className="field-help">
                Times follow the API clock. The backend determines when each
                window closes.
              </p>
            )}
            {owner && (
              <>
                <div className="sidebar-divider" />
                {activePayment ? (
                  <PaymentStatus
                    payment={activePayment}
                    purchase={first}
                    mock={config ? mock : null}
                  />
                ) : (
                  <p className="muted">
                    Put {money(comp.total.amount_minor)} on hold with PayPal to open your brief. Nothing is charged until you pick.
                  </p>
                )}
                {["draft", "awaiting_authorization"].includes(comp.state) && (
                  <>
                    {!checkout || now >= Date.parse(checkout.expires_at) ? (
                      <button
                        className="button primary full-width"
                        disabled={
                          !!busy ||
                          stale ||
                          !config ||
                          !config.capabilities.authorization
                        }
                        onClick={() => void initialCheckout()}
                      >
                        {busy === "checkout"
                          ? "Preparing checkout…"
                          : checkout
                            ? "Renew expired checkout"
                            : `Hold ${money(comp.total.amount_minor)} with PayPal`}
                        <Icon name="arrow" size={16} />
                      </button>
                    ) : (
                      config && (
                        <CheckoutActions
                          checkout={checkout}
                          mode={config.mode}
                          initial
                          busy={!!busy || blocked}
                          expired={now >= Date.parse(checkout.expires_at)}
                          verify={() => void verifyAuthorization()}
                        />
                      )
                    )}
                  </>
                )}
                {canReject && (
                  <button
                    className="text-button reject-button"
                    onClick={() => setDecision({ kind: "reject" })}
                  >
                    None of these · release my hold
                  </button>
                )}
              </>
            )}
            <div className="sidebar-policy">
              <span>
                <Icon name="check" size={14} />
                Pick a winner: the hold is charged
              </span>
              <span>
                <Icon name="plus" size={14} />
                Want more? Extra entries at the same price
              </span>
              <span>
                <Icon name="clock" size={14} />
                Reject all or don&apos;t decide: you pay nothing
              </span>
            </div>
            <p className="field-help">
              The winning agent is paid {money(comp.bid.amount_minor - Math.floor((comp.bid.amount_minor * comp.policy.commission_bps + 5000) / 10000))}{" "}
              ({100 - comp.policy.commission_bps / 100}%) by PayPal Payouts.
            </p>
            <span className="terms-label">
              Frozen policy · {comp.policy.terms_version}
            </span>
          </div>
          {mock && (
            <div className="mock-note">
              <strong>Demo mode, clearly marked.</strong>
              <p>
                Payments are simulated by the API&apos;s fake PayPal provider. No real money moves.
              </p>
            </div>
          )}
        </aside>
      </div>
      <dialog
        ref={dialog}
        className="decision-dialog"
        aria-labelledby="decision-title"
        aria-describedby="decision-summary"
        onClose={() => setDecision(null)}
      >
        <div className="section-heading">
          <span className="eyebrow">
            {decision?.kind === "reject"
              ? "A final decision"
              : decision?.kind === "additional"
                ? "One more perspective"
                : "Your first selection"}
          </span>
          <button
            className="icon-button"
            aria-label="Close decision"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="decision-title">
          {decision?.kind === "reject"
            ? "None of these work for you?"
            : decision?.kind === "additional"
              ? "Make this one yours, too."
              : "Found your favorite?"}
        </h2>
        <p id="decision-summary">
          {decision?.kind === "reject"
            ? "This closes your brief and releases your PayPal hold. You pay nothing, and no originals are delivered."
            : decision?.kind === "additional"
              ? `This starts a separate ${money(comp.total.amount_minor)} PayPal checkout (price + processing). The original unlocks once PayPal confirms it.`
              : `Choosing “${decision?.submission.title || ""}” charges your ${money(comp.total.amount_minor)} hold and pays its agent. This choice is final.`}
        </p>
        {decision?.kind === "first" && (
          <p className="field-help">
            Submissions stay open to the advertised deadline. Later entries are
            separate full-price purchases.
          </p>
        )}
        {mock && (
          <div className="notice">Local mock · no real payment is taken.</div>
        )}
        <div className="button-row">
          <button
            className="button primary"
            disabled={!!busy || blocked}
            onClick={() => void confirmDecision()}
          >
            {decision?.kind === "reject"
              ? "Release my hold"
              : decision?.kind === "additional"
                ? "Continue to checkout"
                : `Pick it · pay ${money(comp.total.amount_minor)}`}
            <Icon name="arrow" size={17} />
          </button>
          <button
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Keep looking
          </button>
        </div>
      </dialog>
    </div>
  );
}
