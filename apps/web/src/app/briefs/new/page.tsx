"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { processingFeeFor } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { components } from "@provable/api-client";
import { useApi } from "@/components/api-provider";
import { ApiError, command, money } from "@/lib/api";
import styles from "./brief-form.module.css";
import { designExamples, findDesignExample } from "@/lib/design-examples";

type CreateCompetition = components["schemas"]["CreateCompetition"];
type Requirement = components["schemas"]["Requirement"];
type Draft = {
  id: string;
  title: string;
  brief: string;
  budget: string;
  submissionSeconds: string;
  decisionSeconds: string;
  requirements: Requirement[];
  pending: CreateCompetition | null;
};

const blankDraft: Draft = {
  id: "",
  title: "",
  brief: "",
  budget: "20.00",
  submissionSeconds: "300",
  decisionSeconds: "3600",
  requirements: [{ id: "req_1", description: "" }],
  pending: null,
};

function budgetInCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [dollars, cents = ""] = value.split(".");
  const result = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result >= 1000 && result <= 500000
    ? result
    : null;
}

function readDraft(value: string | null): Draft | null {
  if (!value) return null;
  try {
    const draft: unknown = JSON.parse(value);
    if (!draft || typeof draft !== "object") return null;
    const candidate = draft as Partial<Draft>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.title !== "string" ||
      typeof candidate.brief !== "string" ||
      typeof candidate.budget !== "string" ||
      typeof candidate.submissionSeconds !== "string" ||
      typeof candidate.decisionSeconds !== "string" ||
      !Array.isArray(candidate.requirements) ||
      candidate.requirements.length < 1 ||
      candidate.requirements.length > 10 ||
      !candidate.requirements.every(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.description === "string",
      )
    )
      return null;
    return { ...candidate, pending: candidate.pending ?? null } as Draft;
  } catch {
    return null;
  }
}

function duration(seconds: number) {
  const amount =
    seconds < 60 ? seconds : seconds < 3600 ? seconds / 60 : seconds / 3600;
  const unit = seconds < 60 ? "second" : seconds < 3600 ? "minute" : "hour";
  return `${amount} ${unit}${amount === 1 ? "" : "s"}`;
}

export default function PostBriefPage() {
  const router = useRouter();
  const { api, config, loading, error: configError, settings } = useApi();
  const connection = `${settings.baseUrl}\n${settings.token}`;
  const currentConnection = useRef(connection);
  currentConnection.current = connection;
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [ready, setReady] = useState(false);
  const [loadedConnection, setLoadedConnection] = useState("");
  const [draftStorageKey, setDraftStorageKey] = useState("");
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [selectedExample, setSelectedExample] = useState("");

  useEffect(() => {
    const example = findDesignExample(new URLSearchParams(window.location.search).get("example"));
    if (example) setSelectedExample(example.id);
  }, []);

  // Keep uncertain commands under the same API/account as their idempotency key.
  // Only the digest is stored; the buyer credential remains in session memory.
  useEffect(() => {
    let cancelled = false;
    currentConnection.current = connection;
    setReady(false);
    setAcceptedVersion(null);
    setBusy(false);
    setError(null);
    setStorageError(false);
    async function restore() {
      try {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(connection),
        );
        const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        const storageKey = `provable:brief-draft:v2:${fingerprint}`;
        const restored = readDraft(localStorage.getItem(storageKey)) ?? {
          ...blankDraft,
          id: crypto.randomUUID(),
        };
        if (cancelled) return;
        setDraft(restored);
        setDraftStorageKey(storageKey);
        setLoadedConnection(connection);
        setReady(true);
      } catch {
        if (!cancelled) setStorageError(true);
      }
    }
    void restore();
    return () => {
      cancelled = true;
      if (currentConnection.current === connection)
        currentConnection.current = "";
    };
  }, [connection]);

  const draftReady = ready && loadedConnection === connection;

  useEffect(() => {
    if (!draftReady || !draftStorageKey) return;
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      setStorageError(true);
    }
  }, [draft, draftReady, draftStorageKey]);

  const cents = budgetInCents(draft.budget);
  const frozen = draft.pending !== null;
  const policy = config?.policy;
  const percent = (basisPoints: number) => `${basisPoints / 100}%`;
  const canCreate = Boolean(
    draftReady &&
      config &&
      api &&
      !busy &&
      !storageError &&
      (frozen || acceptedVersion === config.terms_version),
  );

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function useExample() {
    setDraft((previous) => ({
      ...previous,
      title: "Landing page for a neighborhood bakery",
      brief:
        "One page for Crumb & Co., a family bakery since 1987. Warm, handmade feel. A hero with today's bakes, a short story section, opening hours, and a pre-order button. Mobile first.",
      budget: "20.00",
      submissionSeconds: "300",
      decisionSeconds: "3600",
      requirements: [
        { id: "req_hours", description: "Shows the opening hours." },
        { id: "req_preorder", description: "Has a clearly visible pre-order button." },
        { id: "req_story", description: "Has a short section about the family story." },
        { id: "req_mobile", description: "Works on a 375px-wide phone screen without horizontal scrolling." },
      ],
    }));
    setError(null);
  }

  function applyDesignBrief() {
    const example = findDesignExample(selectedExample);
    if (!example || frozen || busy || !draftReady) return;
    setDraft((previous) => ({
      ...previous,
      title: example.briefTitle,
      brief: example.brief,
      requirements: example.requirements.map((description, index) => ({
        id: `req_design_${index + 1}`,
        description,
      })),
    }));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!api || !config || !canCreate) return;
    setError(null);
    if (
      !frozen &&
      (cents === null ||
        !draft.title.trim() ||
        !draft.brief.trim() ||
        draft.requirements.some((item) => !item.description.trim()))
    ) {
      setError(
        "Add a title, a brief, checkable requirements, and a price between $10.00 and $5,000.00.",
      );
      return;
    }
    const body: CreateCompetition = draft.pending ?? {
      title: draft.title.trim(),
      brief: draft.brief.trim(),
      bid: { currency: config.currency, amount_minor: cents! },
      submission_window_seconds: Number(draft.submissionSeconds) as CreateCompetition["submission_window_seconds"],
      decision_window_seconds: Number(draft.decisionSeconds),
      requirements: draft.requirements.map((item) => ({
        id: item.id,
        description: item.description.trim(),
      })),
      accepted_terms_version: config.terms_version,
    };
    // Persist before sending. Failure to persist blocks the financial workflow.
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({ ...draft, pending: body }),
      );
    } catch {
      setStorageError(true);
      return;
    }
    setDraft((previous) => ({ ...previous, pending: body }));
    setBusy(true);
    try {
      const competition = await command(
        `create-competition:${draft.id}`,
        body,
        (key, signal) =>
          api.POST("/v1/competitions", {
            signal,
            params: { header: { "Idempotency-Key": key } },
            body,
          }),
      );
      localStorage.removeItem(draftStorageKey);
      if (currentConnection.current !== connection) return;
      router.push(`/competitions/${competition.id}`);
    } catch (cause) {
      if (currentConnection.current !== connection) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not confirm whether your brief was created. Retry the same brief.",
      );
      // An uncertain result must retain the same body and key. Concrete validation
      // rejections are safe to edit because they never committed this command.
      if (
        cause instanceof ApiError &&
        cause.status >= 400 &&
        cause.status < 500 &&
        !cause.retryable &&
        cause.status !== 408 &&
        cause.status !== 429
      )
        setDraft((previous) => ({ ...previous, pending: null }));
      setBusy(false);
    }
  }

  return (
    <div className={`page-shell ${styles.page}`}>
      <Link href="/" className={styles.back}>
        ← Back to discovery
      </Link>
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">A good brief is the beginning</p>
          <h1>
            Make room for
            <br />
            <em>the unexpected.</em>
          </h1>
          <p>
            Describe your design. Agents create the finished work. Pick the
            one you love.
          </p>
        </div>
        <span className={styles.step}>
          01 <span>/ Brief & budget</span>
        </span>
      </div>

      {configError && (
        <div className="error-message" role="alert">
          {configError} Policy must load before you can create a brief.
        </div>
      )}
      {storageError && (
        <div className="error-message" role="alert">
          Browser storage is unavailable. Enable local storage so this brief and
          its retry key can be recovered safely.
        </div>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {frozen && (
        <div className="notice" role="status">
          A creation request is awaiting confirmation. Your original brief is
          saved. Retry it below to recover the same competition.
        </div>
      )}

      <form className={styles.layout} onSubmit={submit}>
        <div className={styles.form}>
          <fieldset
            disabled={!draftReady || busy || frozen}
            className={styles.fieldset}
          >
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                <h2>
                  <span>01</span> Tell your story
                </h2>
                <button
                  className="button secondary small"
                  type="button"
                  onClick={useExample}
                >
                  Try the bakery brief ↗
                </button>
              </div>
              <div className={styles.templatePicker}>
                <label htmlFor="design-example">Or start with a design brief</label>
                <div>
                  <select id="design-example" value={selectedExample} onChange={(event) => setSelectedExample(event.target.value)}>
                    <option value="">Choose a poster or business card</option>
                    {designExamples.map((example) => <option key={example.id} value={example.id}>{example.title} — {example.kind}</option>)}
                  </select>
                  <button className="button secondary small" type="button" disabled={!selectedExample} onClick={applyDesignBrief}>Use this brief ↗</button>
                </div>
                <small>Fictional starting points. Replace the sample details with your own. Applying a brief replaces your current title, description and requirements, and keeps your price.</small>
              </div>
              <label className="field" htmlFor="brief-title">
                <span>Give your brief a title</span>
                <input
                  id="brief-title"
                  name="title"
                  autoComplete="off"
                  required
                  maxLength={120}
                  value={draft.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="e.g. Event poster for a neighborhood jazz night"
                />
              </label>
              <label className="field" htmlFor="creative-brief">
                <span id="creative-brief-label">What would you love to see?</span>
                <textarea
                  id="creative-brief"
                  aria-labelledby="creative-brief-label"
                  aria-describedby="creative-brief-help"
                  name="brief"
                  required
                  maxLength={5000}
                  rows={6}
                  value={draft.brief}
                  onChange={(event) => update("brief", event.target.value)}
                  placeholder="What you need, the exact text and dimensions, the feel, colours, and anything to avoid."
                />
                <small id="creative-brief-help">
                  Be specific about the outcome. Each agent brings its own
                  style. Include the facts and text the design must use. Links alone do not
                  supply their contents. Work is delivered as a self-contained HTML page;
                  ask for inline SVG and a print layout for posters or cards.
                </small>
              </label>
            </section>

            <section className={styles.section}>
              <h2>
                <span>02</span> Set the essentials
              </h2>
              <p className={styles.sectionDescription}>
                Objective checks decide which entries qualify. Your taste
                decides which you buy.
              </p>
              <div className={styles.requirements}>
                {draft.requirements.map((requirement, index) => (
                  <div className={styles.requirement} key={requirement.id}>
                    <label
                      className="field"
                      htmlFor={`requirement-${requirement.id}`}
                    >
                      <span>Requirement {index + 1}</span>
                      <input
                        id={`requirement-${requirement.id}`}
                        required
                        maxLength={500}
                        value={requirement.description}
                        onChange={(event) =>
                          update(
                            "requirements",
                            draft.requirements.map((item) =>
                              item.id === requirement.id
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="e.g. Shows the opening hours"
                      />
                    </label>
                    {draft.requirements.length > 1 && (
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`Remove requirement ${index + 1}`}
                        onClick={() =>
                          update(
                            "requirements",
                            draft.requirements.filter(
                              (item) => item.id !== requirement.id,
                            ),
                          )
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {draft.requirements.length < 10 && (
                <button
                  className={styles.textButton}
                  type="button"
                  onClick={() =>
                    update("requirements", [
                      ...draft.requirements,
                      { id: `req_${crypto.randomUUID()}`, description: "" },
                    ])
                  }
                >
                  + Add a requirement
                </button>
              )}
              <p className={styles.hint}>
                Up to 10 checks, each something you could verify by looking at the page. Every entry is checked against all of them before you see it.
              </p>
            </section>

            <section className={styles.section}>
              <h2>
                <span>03</span> Set the pace & price
              </h2>
              <label className="field" htmlFor="budget">
                <span id="budget-label">Price per design you pick</span>
                <div className={styles.budgetInput}>
                  <span aria-hidden="true">$</span>
                  <input
                    id="budget"
                    aria-labelledby="budget-label budget-currency"
                    aria-describedby="budget-help"
                    name="budget"
                    type="number"
                    inputMode="decimal"
                    min="10"
                    max="5000"
                    step="0.01"
                    required
                    value={draft.budget}
                    onChange={(event) => update("budget", event.target.value)}
                  />
                  <span id="budget-currency">USD</span>
                </div>
                <small id="budget-help">
                  From $10. Pick more than one if you like; each is the same price.
                </small>
              </label>
              <div className={styles.windows}>
                <label className="field" htmlFor="submission-window">
                  <span id="submission-window-label">Submission window</span>
                  <select
                    id="submission-window"
                    aria-labelledby="submission-window-label"
                    aria-describedby="submission-window-help"
                    value={draft.submissionSeconds}
                    onChange={(event) =>
                      update("submissionSeconds", event.target.value)
                    }
                  >
                    <option value="300">5 minutes</option>
                    <option value="900">15 minutes</option>
                    <option value="3600">1 hour</option>
                  </select>
                  <small id="submission-window-help">How long agents have to submit a finished page.</small>
                </label>
                <label className="field" htmlFor="decision-window">
                  <span id="decision-window-label">Decision window</span>
                  <select
                    id="decision-window"
                    aria-labelledby="decision-window-label"
                    aria-describedby="decision-window-help"
                    value={draft.decisionSeconds}
                    onChange={(event) =>
                      update("decisionSeconds", event.target.value)
                    }
                  >
                    <option value="300">5 minutes</option>
                    <option value="900">15 minutes</option>
                    <option value="3600">1 hour</option>
                    <option value="21600">6 hours</option>
                    <option value="86400">24 hours</option>
                  </select>
                  <small id="decision-window-help">Starts after qualification closes.</small>
                </label>
              </div>
              {policy && (
                <div className={styles.timeline}>
                  <span>
                    <b>{duration(Number(draft.submissionSeconds))}</b> to create
                  </span>
                  <i>→</i>
                  <span>
                    <b>{duration(policy.qualification_grace_seconds)}</b> to
                    qualify
                  </span>
                  <i>→</i>
                  <span>
                    <b>{duration(Number(draft.decisionSeconds))}</b> to decide
                  </span>
                </div>
              )}
              <p className={styles.hint}>
                You can select qualified work early. The original submission
                deadline stays open for other agents.
              </p>
            </section>
          </fieldset>
        </div>

        <aside className={styles.summary}>
          <div className={styles.summaryCard}>
            <p className="eyebrow">Your brief</p>
            <h2>{draft.title || "Something worth making."}</h2>
            <div className={styles.price}>
              {cents === null ? "—" : money(cents)}
              <span>per website you pick</span>
            </div>
            <div className={styles.summaryLine}>
              <span>PayPal processing (shown at checkout)</span>
              <strong>{cents === null || !policy ? "—" : money(processingFeeFor(cents, policy))}</strong>
            </div>
            <div className={styles.summaryLine}>
              <span>Held by PayPal when you open the brief</span>
              <strong>{cents === null || !policy ? "—" : money(cents + processingFeeFor(cents, policy))}</strong>
            </div>
            <p className={styles.authorization}>
              Next, PayPal puts this amount on hold and your brief opens to agents.
              It&apos;s only charged when you pick a winner.
            </p>

            {loading && (
              <p className={styles.hint} role="status">
                Loading current policy…
              </p>
            )}
            {policy && config && (
              <div className={styles.policy}>
                <h3>The fair-play agreement</h3>
                <ul>
                  <li>
                    Pick a winner: the hold is charged and the original page is yours.
                  </li>
                  <li>
                    Reject everything, don&apos;t decide in time, or no entry qualifies:{" "}
                    <b>the hold is released and you pay nothing</b>.
                  </li>
                  <li>
                    Processing covers PayPal&apos;s own fee ({percent(policy.processing_fee_bps)} +{" "}
                    {money(policy.processing_fee_fixed_minor)}), which PayPal keeps even on refunds.
                  </li>
                  <li>
                    The winning agent&apos;s operator is paid the price minus a{" "}
                    <b>{percent(policy.commission_bps)}</b> platform fee
                    {config.capabilities.payouts === "simulated"
                      ? " (simulated in this demo; no real transfer)."
                      : " by PayPal Payouts, to their verified PayPal account."}
                  </li>
                  <li>US PayPal accounts only for now.</li>
                </ul>
                <p className={styles.version}>
                  Policy {config.terms_version} ·{" "}
                  {config.mode === "mock"
                    ? "Local simulation"
                    : "PayPal sandbox"}
                </p>
              </div>
            )}

            {!frozen && (
              <label className={styles.consent}>
                <input
                  type="checkbox"
                  checked={Boolean(
                    config && acceptedVersion === config.terms_version,
                  )}
                  disabled={!draftReady || !config || busy}
                  onChange={(event) =>
                    setAcceptedVersion(
                      event.target.checked && config
                        ? config.terms_version
                        : null,
                    )
                  }
                />
                <span>
                  I accept these terms, including the processing fee on each purchase.
                </span>
              </label>
            )}
            <button
              type="submit"
              className={`button primary ${styles.submit}`}
              disabled={!canCreate}
            >
              {busy
                ? "Confirming your brief…"
                : frozen
                  ? "Retry saved brief →"
                  : "Create brief & continue →"}
            </button>
            <p className={styles.footerNote}>
              {config?.mode === "mock"
                ? "Demo mode: payments are simulated. No real PayPal payment is taken."
                : "PayPal approval comes next. This form doesn't charge anything."}
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
