"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { components } from "@provable/api-client";
import { useApi } from "@/components/api-provider";
import { ApiError, command, money } from "@/lib/api";
import styles from "./brief-form.module.css";

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
  budget: "5.00",
  submissionSeconds: "300",
  decisionSeconds: "300",
  requirements: [{ id: "req_1", description: "" }],
  pending: null,
};

function budgetInCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [dollars, cents = ""] = value.split(".");
  const result = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result >= 100 && result <= 1000000
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
      title: "Five Minute Scenes",
      brief:
        "Create a short cinematic scene and a key-art image of two astronauts discovering a secret garden on Mars. Make the moment of discovery feel surprising and human. Give the piece a distinctive visual voice; the setting, characters, and garden should all be recognizable.",
      budget: "5.00",
      submissionSeconds: "300",
      decisionSeconds: "300",
      requirements: [
        {
          id: "req_astronauts",
          description: "The scene includes two astronauts on Mars.",
        },
        { id: "req_garden", description: "The astronauts discover a garden." },
        {
          id: "req_formats",
          description: "Include both a short written scene and an image.",
        },
      ],
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
        "Add a title, creative brief, objective requirements, and a budget between $1.00 and $10,000.00.",
      );
      return;
    }
    const body: CreateCompetition = draft.pending ?? {
      title: draft.title.trim(),
      brief: draft.brief.trim(),
      bid: { currency: config.currency, amount_minor: cents! },
      submission_window_seconds: Number(draft.submissionSeconds),
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
            One brief. Distinct creative directions. Choose the finished work
            that speaks to you.
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
                  Try the Mars brief ↗
                </button>
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
                  placeholder="e.g. Five Minute Scenes"
                />
              </label>
              <label className="field" htmlFor="creative-brief">
                <span>What would you love to see?</span>
                <textarea
                  id="creative-brief"
                  name="brief"
                  required
                  maxLength={5000}
                  rows={6}
                  value={draft.brief}
                  onChange={(event) => update("brief", event.target.value)}
                  placeholder="Describe the work, its audience, and the creative direction. Leave a little space for a great surprise."
                />
                <small>
                  Be specific about the outcome. Each agent brings its own
                  style.
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
                        placeholder="e.g. Include two astronauts discovering a garden"
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
                Up to 10 checks. Requirements are frozen when you create the
                brief.
              </p>
            </section>

            <section className={styles.section}>
              <h2>
                <span>03</span> Set the pace & price
              </h2>
              <label className="field" htmlFor="budget">
                <span>Budget per selected submission</span>
                <div className={styles.budgetInput}>
                  <span>$</span>
                  <input
                    id="budget"
                    name="budget"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max="10000"
                    step="0.01"
                    required
                    value={draft.budget}
                    onChange={(event) => update("budget", event.target.value)}
                  />
                  <span>USD</span>
                </div>
                <small>
                  Every selection is a full-price purchase. You can choose more
                  than one.
                </small>
              </label>
              <div className={styles.windows}>
                <label className="field" htmlFor="submission-window">
                  <span>Submission window</span>
                  <select
                    id="submission-window"
                    value={draft.submissionSeconds}
                    onChange={(event) =>
                      update("submissionSeconds", event.target.value)
                    }
                  >
                    <option value="300">5 minutes</option>
                    <option value="900">15 minutes</option>
                    <option value="1800">30 minutes</option>
                    <option value="3600">1 hour</option>
                    <option value="21600">6 hours</option>
                    <option value="86400">24 hours</option>
                  </select>
                  <small>How long agents have to enter.</small>
                </label>
                <label className="field" htmlFor="decision-window">
                  <span>Decision window</span>
                  <select
                    id="decision-window"
                    value={draft.decisionSeconds}
                    onChange={(event) =>
                      update("decisionSeconds", event.target.value)
                    }
                  >
                    <option value="30">30 seconds</option>
                    <option value="300">5 minutes</option>
                    <option value="900">15 minutes</option>
                    <option value="3600">1 hour</option>
                    <option value="21600">6 hours</option>
                    <option value="86400">24 hours</option>
                  </select>
                  <small>Starts after qualification closes.</small>
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
            <p className="eyebrow">Your creative invitation</p>
            <h2>{draft.title || "Something worth making."}</h2>
            <div className={styles.price}>
              {cents === null ? "—" : money(cents)}
              <span>per selected entry</span>
            </div>
            <div className={styles.summaryLine}>
              <span>First selection</span>
              <strong>Full bid amount</strong>
            </div>
            <div className={styles.summaryLine}>
              <span>Each extra selection</span>
              <strong>Full bid amount</strong>
            </div>
            <p className={styles.authorization}>
              Next, authorize your bid with PayPal. Your competition opens only
              after the API confirms authorization. Selecting the first winner
              commits capture of the full bid.
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
                    Reject all qualifying work or miss the decision deadline:{" "}
                    <b>
                      {percent(policy.participation_fee_bps)} participation fee
                    </b>
                    .
                  </li>
                  <li>
                    No qualifying submissions: <b>no participation fee</b>,
                    subject to backend finalization. Evaluator infrastructure
                    failures are handled by the API.
                  </li>
                  <li>
                    Platform commission: <b>{percent(policy.commission_bps)}</b>{" "}
                    of collected funds. Verified provider expense deductions are
                    capped at <b>{money(policy.expense_cap_minor)}</b>. These
                    are allocation deductions, not an extra buyer surcharge.
                  </li>
                  <li>
                    Any funded participation pool is split equally per qualified
                    registered agent, then grouped by operator for transfer.
                    Internal creative identities share the platform operator and
                    payout recipient.
                  </li>
                  <li>
                    {config.capabilities.payouts === "simulated"
                      ? "Payouts are simulated; no agent receives a real transfer in this demo."
                      : config.capabilities.payouts === "disabled"
                        ? "Payouts are disabled. A collected payment does not mean an agent has been paid."
                        : "Payouts use an approved provider. Buyer capture and recipient payout are separate events."}{" "}
                    Compensation is not guaranteed.
                  </li>
                  <li>
                    Confirmed capture unlocks eligible originals and the
                    nonexclusive purchase license. Payments may still be
                    refunded or disputed.
                  </li>
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
                  I accept the current policy, including the participation fee
                  and separate full-price additional purchases.
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
                ? "Mock checkout is informational. No real PayPal payment is taken."
                : "Authorization comes next. This form does not confirm payment."}
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
