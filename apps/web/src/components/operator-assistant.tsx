"use client";

import { useRef, useState, type FormEvent } from "react";
import type { AssistantAnswer, AssistantLookup } from "@provable/api-client";
import { ApiError, unwrap, withRequestTimeout, type Api } from "@/lib/api";
import { Icon } from "@/components/ui";

const SUGGESTIONS = ["Where's my latest payout?", "Has the buyer's payment been captured?", "What did I earn today?"];
const MAX_LENGTH = 500;

/** Which PayPal (or ledger) lookup the assistant made, in plain words. */
function lookupLabel(lookup: AssistantLookup): string {
  if (lookup.status === "refused") return "Not looked up";
  if (lookup.source === "ledger") return "Checked your ledger";
  if (lookup.source === "paypal_payouts") return "Checked PayPal Payouts";
  return `Checked PayPal (Agent Toolkit ${lookup.tool})`;
}

/**
 * "Ask about my earnings": Claude answers from the operator's own allocations and live PayPal data, and every lookup
 * it made is listed under the answer.
 */
export function OperatorAssistant({ client }: { client: Api }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(AssistantAnswer & { question: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(client);
  active.current = client;

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true); setError(null);
    try {
      const answer = await withRequestTimeout(async (signal) =>
        unwrap(await client.POST("/v1/operators/me/assistant", { body: { question: q }, signal })), { timeoutMs: 90_000 });
      if (active.current === client) { setResult({ ...answer, question: q }); setQuestion(""); }
    } catch (err) {
      if (active.current !== client) return;
      setError(err instanceof ApiError && err.status === 429 ? "That's 10 questions this minute. Try again shortly."
        : err instanceof ApiError && err.status === 408 ? "The assistant took too long. Try again."
        : err instanceof Error ? err.message : "The assistant could not answer.");
    } finally { if (active.current === client) setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section className="operator-card assistant-card" aria-labelledby="assistant-title">
      <h2 id="assistant-title">Ask about your earnings</h2>
      <p className="muted assistant-intro">Claude checks your allocations and the PayPal records behind them, through PayPal&apos;s Agent Toolkit. It can only see your own payments and payouts, and it can&apos;t move money.</p>
      <form className="assistant-form" onSubmit={submit}>
        <label className="field assistant-field" htmlFor="assistant-question">
          Your question
          <input id="assistant-question" value={question} maxLength={MAX_LENGTH} onChange={(e) => setQuestion(e.target.value)}
            placeholder="Where's my payout for the bakery brief?" autoComplete="off" disabled={busy} />
        </label>
        <button className="button primary" type="submit" disabled={busy || !question.trim()}>
          {busy ? "Checking PayPal…" : "Ask"} {!busy && <Icon name="arrow" size={16} />}
        </button>
      </form>
      <div className="assistant-suggestions" aria-label="Example questions">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip-button" disabled={busy} onClick={() => { setQuestion(s); void ask(s); }}>{s}</button>
        ))}
      </div>
      <div className="assistant-output" aria-live="polite" aria-busy={busy} data-testid="assistant-answer">
        {error && <p className="error-message" role="alert">{error}</p>}
        {result && !error && (
          <>
            <p className="assistant-question"><span className="visually-hidden">You asked: </span>{result.question}</p>
            <p className="assistant-answer">{result.answer}</p>
            {result.lookups.length > 0 && (
              <ul className="assistant-lookups" aria-label="Lookups behind this answer">
                {result.lookups.map((lookup, i) => (
                  <li key={i} className={`lookup-${lookup.status}`}>
                    <Icon name={lookup.status === "ok" ? "check" : "close"} size={13} />
                    <span><b>{lookupLabel(lookup)}</b>{lookup.ref ? <> · <code>{lookup.ref}</code></> : null}: {lookup.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
