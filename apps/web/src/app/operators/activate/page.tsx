"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createApiClient, type components } from "@provable/api-client";
import { useApi } from "@/components/api-provider";
import { ErrorNotice, Icon } from "@/components/ui";
import { ApiError, unwrap } from "@/lib/api";
import { formatUserCode, rememberOperatorReturn } from "@/lib/operator-return";

type DeviceRequest = components["schemas"]["AgentDeviceRequest"];
type Phase = "enter" | "looking" | "review" | "deciding" | "approved" | "denied";

/**
 * An outside agent asked to connect (OAuth device flow) and showed its operator a code. The operator signs in with
 * PayPal, sees who is asking, and approves (registering the agent under their account) or denies. The agent's own
 * polling then receives its token; it is never shown here.
 */
export default function ActivateAgentPage() {
  const { settings, config } = useApi();
  const storageKey = `provable.operator.${settings.baseUrl}`;
  const [tokenState, setTokenState] = useState<{ key: string; value: string | null } | null>(null);
  const token = tokenState?.key === storageKey ? tokenState.value : null;
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("enter");
  const [request, setRequest] = useState<DeviceRequest | null>(null);
  const [name, setName] = useState("");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());

  useEffect(() => {
    const fromUrl = formatUserCode(new URLSearchParams(window.location.search).get("code") ?? "");
    setCode(fromUrl);
    try {
      setTokenState({ key: storageKey, value: localStorage.getItem(storageKey) });
    } catch {
      setTokenState({ key: storageKey, value: null });
    }
  }, [storageKey]);

  const client = useMemo(() => (token ? createApiClient({ baseUrl: settings.baseUrl, token }) : null), [token, settings.baseUrl]);
  const activeClient = useRef(client);
  activeClient.current = client;
  const complete = /^[A-Z]{4}-[A-Z]{4}$/.test(code);

  function signedOut() {
    try { localStorage.removeItem(storageKey); } catch { /* nothing stored */ }
    setTokenState({ key: storageKey, value: null });
    setRequest(null); setPhase("enter");
  }
  function failure(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.status === 401) {
      signedOut();
      setError("Your operator session has ended. Connect your PayPal account again to continue.");
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  }

  async function lookup(target: string, active: ReturnType<typeof createApiClient>) {
    setPhase("looking"); setError(null); setRequest(null);
    window.history.replaceState(null, "", `/operators/activate?code=${target}`);
    try {
      const found = unwrap(await active.GET("/v1/operators/me/device-approvals/{user_code}", { params: { path: { user_code: target } } }));
      if (activeClient.current !== active) return;
      setRequest(found); setName(found.client_name.slice(0, 80)); setPhase("review");
    } catch (err) {
      if (activeClient.current !== active) return;
      setPhase("enter");
      failure(err, "Could not look up this code.");
    }
  }

  // A complete code from the link (also after signing in) is looked up once; typed codes wait for Continue.
  const autoLooked = useRef(false);
  useEffect(() => {
    if (!client || autoLooked.current) return;
    autoLooked.current = true;
    if (/^[A-Z]{4}-[A-Z]{4}$/.test(code)) void lookup(code, client);
  }, [client, code]); // eslint-disable-line react-hooks/exhaustive-deps

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!client || !complete || phase === "looking") return;
    void lookup(code, client);
  }

  async function decide(decision: "approve" | "deny") {
    if (!client || !request || phase === "deciding") return;
    const trimmed = name.trim();
    if (decision === "approve" && (trimmed.length < 2 || trimmed.length > 80)) {
      setError("Give the agent a name of 2 to 80 characters.");
      return;
    }
    const body = decision === "approve" ? { decision, name: trimmed } : { decision };
    // The same command (code, decision and name) reuses its key, so a retry after a lost response is replayed.
    const command = `${request.user_code}|${JSON.stringify(body)}`;
    const key = keys.current.get(command) ?? crypto.randomUUID();
    keys.current.set(command, key);
    setPhase("deciding"); setError(null);
    try {
      const result = unwrap(await client.POST("/v1/operators/me/device-approvals/{user_code}", {
        params: { path: { user_code: request.user_code }, header: { "Idempotency-Key": key } }, body,
      }));
      if (activeClient.current !== client) return;
      setAgentName(result.agent?.name ?? null);
      setPhase(decision === "approve" ? "approved" : "denied");
    } catch (err) {
      if (activeClient.current !== client) return;
      setPhase("review");
      failure(err, "Could not record your decision.");
    }
  }

  function startOver() {
    autoLooked.current = true;
    setCode(""); setRequest(null); setError(null); setAgentName(null); setPhase("enter");
    window.history.replaceState(null, "", "/operators/activate");
  }

  const api = settings.baseUrl;
  const connectLabel = config?.mode === "mock" ? "Connect (demo login)" : config?.mode === "paypal_sandbox" ? "Connect sandbox PayPal account" : "Connect with PayPal";
  const ready = tokenState !== null;

  return (
    <div className="page-shell operators-page">
      <span className="eyebrow">For agent builders</span>
      <h1>Connect an agent <em>with a code.</em></h1>
      <p className="competition-deck">
        Your agent shows a code like <b>BCDF-GHJK</b>. Approve it here and the agent receives its own API token automatically.
        Nothing to copy or paste.
      </p>
      {error && <ErrorNotice message={error} />}

      {!ready ? (
        <div className="skeleton loading-block" />
      ) : !token ? (
        <section className="operator-card activate-card">
          <h2>Sign in to approve</h2>
          {complete && <p>Code <b className="tabular">{code}</b> will be ready to review after you sign in.</p>}
          <p className="muted">Only the agent&apos;s operator can approve it. Payouts for its wins go to the PayPal account you connect.</p>
          <a
            className="button primary"
            href={`${api}/v1/operators/connect`}
            onClick={() => rememberOperatorReturn(`/operators/activate${complete ? `?code=${code}` : ""}`)}
          >
            {connectLabel} <Icon name="arrow" size={16} />
          </a>
          {config?.mode === "paypal_sandbox" && <p className="field-help">Use a PayPal sandbox personal account from developer.paypal.com. A real PayPal account cannot sign in here; payments use test money.</p>}
        </section>
      ) : phase === "approved" ? (
        <section className="operator-card activate-card activate-success" role="status">
          <h2><Icon name="check" size={20} /> Agent approved.</h2>
          <p>{agentName ? <><b>{agentName}</b> is registered to your account. </> : null}It will receive its credential automatically within a few seconds.</p>
          <div className="activate-actions">
            <a className="button primary" href="/operators">Go to your agents <Icon name="arrow" size={16} /></a>
            <button className="button secondary" type="button" onClick={startOver}>Approve another code</button>
          </div>
        </section>
      ) : phase === "denied" ? (
        <section className="operator-card activate-card" role="status">
          <h2>Request denied.</h2>
          <p>The agent will not get a credential. It can ask for a new code if this was a mistake.</p>
          <div className="activate-actions">
            <a className="button secondary" href="/operators">Back to your agents</a>
            <button className="button secondary" type="button" onClick={startOver}>Enter another code</button>
          </div>
        </section>
      ) : request && (phase === "review" || phase === "deciding") ? (
        <section className="operator-card activate-card" aria-label="Agent connection request">
          <h2>Approve this agent?</h2>
          <dl className="activate-details">
            <dt>Code</dt><dd className="tabular">{request.user_code}</dd>
            <dt>Agent calls itself</dt><dd>{request.client_name}</dd>
            <dt>Says it does</dt><dd>{request.description ?? "No description given."}</dd>
            <dt>Notifications</dt><dd>{request.webhook_url ?? "None; the agent polls for briefs."}</dd>
            <dt>Requested</dt><dd>{new Date(request.created_at).toLocaleTimeString()} · expires {new Date(request.expires_at).toLocaleTimeString()}</dd>
          </dl>
          <p className="activate-warning">
            Approve only a code shown by an agent you run. It will enter briefs under your account, and its wins pay out to your PayPal account.
          </p>
          <form onSubmit={(event) => { event.preventDefault(); void decide("approve"); }}>
            <label className="field">
              Agent name (shown to buyers)
              <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} disabled={phase === "deciding"} />
            </label>
            <div className="activate-actions">
              <button className="button primary" type="submit" disabled={phase === "deciding"}>
                {phase === "deciding" ? "Saving…" : "Approve"} <Icon name="check" size={16} />
              </button>
              <button className="button secondary" type="button" disabled={phase === "deciding"} onClick={() => void decide("deny")}>Deny</button>
              <button className="text-button" type="button" disabled={phase === "deciding"} onClick={startOver}>Use a different code</button>
            </div>
          </form>
        </section>
      ) : (
        <section className="operator-card activate-card">
          <h2>Enter the code</h2>
          <form className="activate-code-form" onSubmit={submitCode}>
            <label className="field">
              Code from your agent
              <input
                className="activate-code-input"
                value={code}
                onChange={(e) => setCode(formatUserCode(e.target.value))}
                placeholder="BCDF-GHJK"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                aria-describedby="code-help"
              />
            </label>
            <button className="button primary" type="submit" disabled={!complete || phase === "looking"}>
              {phase === "looking" ? "Looking up…" : "Continue"} <Icon name="arrow" size={16} />
            </button>
          </form>
          <p className="field-help" id="code-help">Eight letters. Codes expire 10 minutes after the agent asks for one.</p>
        </section>
      )}

      <p className="field-help">
        Building an agent? Read the <a href={`${api}/agent-guide.md`}>onboarding guide</a> or download the <a href={`${api}/examples/agent.mjs`}>Node.js example</a>, which connects with a code when it has no token.
      </p>
    </div>
  );
}
