"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  Agent,
  AgentRun,
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
  runs: AgentRun[];
  gallery: Submission[];
  purchases: Purchase[];
  payments: Record<string, Payment>;
};
type Checkout = components["schemas"]["Checkout"];
type Decision =
  | { kind: "first" | "additional"; submission: Submission }
  | { kind: "reject" };

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
  const [tab, setTab] = useState<"work" | "brief" | "activity">("work");
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
            let runs: AgentRun[] = [];
            const payments: Record<string, Payment> = {};
            let canonicalPurchases: Purchase[] = [];
            if (owner) {
              const results = await Promise.all([
                readGallery(api, id, signal),
                api
                  .GET("/v1/competitions/{competition_id}/agent-runs", {
                    params: { path, query: { limit: 100 } },
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
              runs = results[1].items;
              canonicalPurchases = results[2];
              for (const payment of results[3]) payments[payment.id] = payment;
            }
            return {
              competition: comp,
              owner,
              agents: registry.items,
              runs,
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
              Loading the brief, agent progress, and qualified work…
            </p>
          </>
        )}
      </div>
    );
  const { owner, agents, runs, gallery, purchases, payments } = snapshot;
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
  const available = agents
    .filter(
      (agent) =>
        agent.internal &&
        agent.status === "available" &&
        !runs.some((run) => run.agent_id === agent.id),
    )
    .slice(0, 3);
  const canRun =
    owner &&
    !blocked &&
    !busy &&
    comp.state === "open" &&
    !!comp.submission_deadline &&
    now < Date.parse(comp.submission_deadline) &&
    available.length > 0;
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
            <span className="eyebrow-separator">/</span>Scene + image
          </div>
          <h1>{comp.title}</h1>
          <p className="competition-deck">
            One brief. Different worlds. Choose the work that moves you.
          </p>
        </div>
        <div className="agent-stack" aria-label="Registered creative agents">
          {agents.slice(0, 3).map((agent) => (
            <AgentAvatar key={agent.id} agent={agent} size={44} />
          ))}
          <span>
            {agents.length} creative{" "}
            {agents.length === 1 ? "identity" : "identities"}
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
            This is a published brief. Its work, agent activity, purchases, and
            delivery are private to the buyer.
          </span>
        </div>
      )}
      {comp.outcome === "no_qualifiers" && (
        <div className="notice">
          No submissions qualified. The backend finalized this competition
          without a participation fee. Authorization release is shown in the
          funding status.
        </div>
      )}
      {comp.outcome === "infrastructure_failure" && (
        <div className="notice">
          Qualification could not be completed reliably. The backend cancelled
          this undecided competition without a participation fee. Check the
          funding status for authorization release.
        </div>
      )}
      {comp.outcome === "participation_fee" && (
        <div className="notice">
          The backend committed the agreed{" "}
          {comp.policy.participation_fee_bps / 100}% participation fee after
          rejection or the decision deadline. Its capture status is shown
          separately. No originals or purchase license are included.
        </div>
      )}
      {comp.outcome === "cancelled" && (
        <div className="notice">
          The backend cancelled this competition. Funding status shows the
          current authorization and capture outcome.
        </div>
      )}
      <div className="competition-layout">
        <div className="competition-main">
          <section className="brief-intro">
            <span className="eyebrow">The creative challenge</span>
            <p>{comp.brief}</p>
            <div className="brief-tags">
              <span>Original perspectives</span>
              <span>Text + image</span>
              <span>Objective qualification</span>
            </div>
          </section>
          {owner && (
            <>
              <div className="competition-tabs" aria-label="Competition views">
                {(["work", "brief", "activity"] as const).map((key) => (
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
                    ) : (
                      <>
                        Agent activity <span>{runs.length}</span>
                      </>
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
                          ? "Same brief. A different point of view."
                          : "Great work starts with an invitation."}
                      </h2>
                      <p>
                        Only entries that pass qualification appear here.
                        Previews are protected; originals are purchased
                        separately.
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
                        const image = submission.artifacts.find(
                          (a) => a.type === "image",
                        );
                        const text = submission.artifacts.find(
                          (a) => a.type === "text",
                        );
                        const purchase = purchases.find(
                          (p) => p.submission_id === submission.id,
                        );
                        const payment = purchase
                          ? payments[purchase.payment_id]
                          : undefined;
                        return (
                          <article
                            className={`submission-card ${purchase ? "selected-card" : ""}`}
                            key={submission.id}
                          >
                            <div className="submission-art">
                              {image ? (
                                <AssetPreview
                                  artifact={image}
                                  alt={`${agent?.name || "Agent"} — ${submission.title}`}
                                />
                              ) : (
                                text && <AssetPreview artifact={text} />
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
                                      ? `By ${agent.operator_name}`
                                      : "Registered creative identity"}
                                  </span>
                                </div>
                                <span className="entry-number">
                                  0{index + 1}
                                </span>
                              </div>
                              <h3>{submission.title}</h3>
                              <p className="agent-style">{agent?.style}</p>
                              <div className="qualified-line">
                                <span>
                                  <Icon name="check" size={14} />
                                  Qualified
                                </span>
                                <span>
                                  {submission.artifacts.length}{" "}
                                  {submission.artifacts.length === 1
                                    ? "artifact"
                                    : "artifacts"}{" "}
                                  · {money(comp.bid.amount_minor)}
                                </span>
                              </div>
                              {text && image && (
                                <details className="scene-detail">
                                  <summary>
                                    Read scene excerpt{" "}
                                    <span aria-hidden="true">+</span>
                                  </summary>
                                  <AssetPreview artifact={text} />
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
                                        verify={() =>
                                          void act(
                                            `capture:${purchase.id}`,
                                            () =>
                                              command(
                                                `capture:${purchase.id}`,
                                                null,
                                                (key, signal) =>
                                                  api.POST(
                                                    "/v1/purchases/{purchase_id}/capture",
                                                    {
                                                      signal,
                                                      params: {
                                                        path: {
                                                          purchase_id:
                                                            purchase.id,
                                                        },
                                                        header: {
                                                          "Idempotency-Key":
                                                            key,
                                                        },
                                                      },
                                                    },
                                                  ),
                                              ),
                                          )
                                        }
                                      />
                                    )}
                                  <PurchaseDelivery
                                    purchase={purchase}
                                    disabled={blocked || !!busy}
                                    onRefresh={refresh}
                                  />
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
                        {comp.state === "draft" ||
                        comp.state === "awaiting_authorization"
                          ? "Your brief is ready for its first act."
                          : ["closed", "cancelled"].includes(comp.state)
                            ? "No qualified entries to show."
                            : runs.length
                              ? "The work is in. Qualification comes next."
                              : "Invite a few different perspectives."}
                      </h3>
                      <p>
                        {runs.length
                          ? "Submitted agent runs do not establish qualification. This gallery will update when the API confirms eligible entries."
                          : "Once your brief is open, invite registered agents. Qualified work will appear here as it is confirmed."}
                      </p>
                      {canRun && (
                        <button
                          className="button primary"
                          onClick={() =>
                            void act("agents", () => {
                              const body = {
                                agent_ids: available.map((a) => a.id),
                              };
                              return command(
                                `runs:${id}:${body.agent_ids.join(",")}`,
                                body,
                                (key, signal) =>
                                  api.POST(
                                    "/v1/competitions/{competition_id}/agent-runs",
                                    {
                                      signal,
                                      params: {
                                        path: { competition_id: id },
                                        header: { "Idempotency-Key": key },
                                      },
                                      body,
                                    },
                                  ),
                              );
                            })
                          }
                        >
                          Invite {available.length} creative agents{" "}
                          <Icon name="arrow" size={17} />
                        </button>
                      )}
                    </div>
                  )}
                </section>
              )}
              {tab === "brief" && (
                <section className="brief-details">
                  <h2>The essentials, in black and white.</h2>
                  <p>
                    These requirements were frozen when the brief was created.
                    They determine eligibility; your taste determines your
                    selection.
                  </p>
                  {comp.requirements.map((requirement, index) => (
                    <div className="requirement-row" key={requirement.id}>
                      <span>0{index + 1}</span>
                      <p>{requirement.description}</p>
                    </div>
                  ))}
                  <div className="notice">
                    Qualification gets {comp.policy.qualification_grace_seconds}{" "}
                    seconds after submissions close. Your separate decision
                    window is {comp.decision_window_seconds} seconds. The
                    backend finalizes eligibility and fees.
                  </div>
                </section>
              )}
              {tab === "activity" && (
                <section className="agent-activity">
                  <div className="section-heading">
                    <div>
                      <h2>Creative minds, at work.</h2>
                      <p className="muted">
                        Run progress is separate from qualification.
                      </p>
                    </div>
                    {canRun && (
                      <button
                        className="button secondary small"
                        onClick={() =>
                          void act("agents", () => {
                            const body = {
                              agent_ids: available.map((a) => a.id),
                            };
                            return command(
                              `runs:${id}:${body.agent_ids.join(",")}`,
                              body,
                              (key, signal) =>
                                api.POST(
                                  "/v1/competitions/{competition_id}/agent-runs",
                                  {
                                    signal,
                                    params: {
                                      path: { competition_id: id },
                                      header: { "Idempotency-Key": key },
                                    },
                                    body,
                                  },
                                ),
                            );
                          })
                        }
                      >
                        Invite agents <Icon name="plus" size={16} />
                      </button>
                    )}
                  </div>
                  {agents.map((agent) => {
                    const run = runs.find((r) => r.agent_id === agent.id);
                    return (
                      <div className="agent-run" key={agent.id}>
                        <AgentAvatar agent={agent} size={44} />
                        <div>
                          <strong>{agent.name}</strong>
                          <p>{agent.style}</p>
                          <small>Operated by {agent.operator_name}</small>
                        </div>
                        <span
                          className={`run-status ${run?.status === "submitted" ? "submitted" : ""}`}
                        >
                          {run?.status === "submitted"
                            ? gallery.some((s) => s.agent_id === agent.id)
                              ? "Submitted · qualified"
                              : "Submitted · awaiting qualification"
                            : run?.status.replaceAll("_", " ") || "Not invited"}
                        </span>
                      </div>
                    );
                  })}
                  <p className="field-help">
                    Internal creative identities share the platform operator and
                    economic payout recipient. Run completion does not guarantee
                    qualification or compensation.
                  </p>
                </section>
              )}
              <div className="gallery-footnote">
                <Icon name="lock" size={15} />
                <span>
                  Protected previews. Backend-confirmed payment and entitlement
                  unlock originals and the nonexclusive purchase license.
                </span>
              </div>
            </>
          )}
        </div>
        <aside className="competition-sidebar">
          <div className="bid-card">
            <div className="eyebrow">A good idea, at your price</div>
            <div className="bid-price">
              {money(comp.bid.amount_minor)}
              <span>USD</span>
            </div>
            <p className="bid-caption">per selected entry</p>
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
                    Authorize the bid to open your competition.
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
                          !config.capabilities.authorization ||
                          !config.capabilities.final_partial_capture
                        }
                        onClick={() => void initialCheckout()}
                      >
                        {busy === "checkout"
                          ? "Preparing checkout…"
                          : checkout
                            ? "Renew expired checkout"
                            : `Authorize ${money(comp.bid.amount_minor)}`}
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
                          verify={() =>
                            void act("authorize", () =>
                              command(
                                `authorize:${id}:${checkout.provider_order_id}`,
                                null,
                                (key, signal) =>
                                  api.POST(
                                    "/v1/competitions/{competition_id}/authorize",
                                    {
                                      signal,
                                      params: {
                                        path: { competition_id: id },
                                        header: { "Idempotency-Key": key },
                                      },
                                    },
                                  ),
                              ),
                            )
                          }
                        />
                      )
                    )}
                  </>
                )}
                {comp.state === "deciding" && !comp.first_purchase_id && (
                  <button
                    className="text-button reject-button"
                    disabled={!!busy || blocked || !decisionOpen}
                    onClick={() => setDecision({ kind: "reject" })}
                  >
                    Reject all ·{" "}
                    {money(
                      Math.floor(
                        (comp.bid.amount_minor *
                          comp.policy.participation_fee_bps) /
                          10000,
                      ),
                    )}{" "}
                    fee
                  </button>
                )}
              </>
            )}
            <div className="sidebar-policy">
              <span>
                <Icon name="check" size={14} />
                First choice: full bid capture
              </span>
              <span>
                <Icon name="plus" size={14} />
                Extra choices: full price each
              </span>
              <span>
                <Icon name="clock" size={14} />
                {comp.policy.participation_fee_bps / 100}% fee if you reject or
                miss the decision
              </span>
            </div>
            <p className="field-help">
              No qualifying work: no participation fee, subject to finalization.
              No compensation is guaranteed.
            </p>
            <span className="terms-label">
              Frozen policy · {comp.policy.terms_version}
            </span>
          </div>
          {mock && (
            <div className="mock-note">
              <strong>Demo, clearly marked.</strong>
              <p>
                Images and scenes are deterministic fixtures. Qualification and
                capture confirmations require the separate local fixture runner.
              </p>
            </div>
          )}
        </aside>
      </div>
      <dialog
        ref={dialog}
        className="decision-dialog"
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
        <h2>
          {decision?.kind === "reject"
            ? "Reject all qualifying work?"
            : decision?.kind === "additional"
              ? "Make this one yours, too."
              : "Found your favorite?"}
        </h2>
        <p>
          {decision?.kind === "reject"
            ? `This commits the agreed ${money(Math.floor((comp.bid.amount_minor * comp.policy.participation_fee_bps) / 10000))} participation fee and ends your decision. It does not license any originals.`
            : decision?.kind === "additional"
              ? `This creates a separate ${money(comp.bid.amount_minor)} PayPal capture checkout. Approve it and wait for confirmed payment before accessing originals.`
              : `Choosing “${decision?.submission.title || ""}” commits capture of the full ${money(comp.bid.amount_minor)} authorization. This first selection is final, including if payment later fails.`}
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
              ? "Confirm rejection & fee"
              : decision?.kind === "additional"
                ? "Create additional checkout"
                : `Select & capture ${money(comp.bid.amount_minor)}`}
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
