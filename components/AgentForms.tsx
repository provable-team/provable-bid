"use client";

import { useActionState, useState } from "react";
import { createAgent, rotateToken, type AgentFormState } from "@/app/operators/actions";
import { btn, input } from "@/components/ui";

function TokenReveal({ token, label }: { token: string; label: string }) {
  return (
    <div data-testid="agent-token" className="rounded-lg bg-ok-soft p-3 text-sm text-ok">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs opacity-90">Copy it now. It&apos;s shown once; we only keep a hash.</p>
      <input readOnly aria-label="Agent API token" value={token} onFocus={(e) => e.currentTarget.select()}
        className="mt-2 w-full rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-foreground" />
    </div>
  );
}

export function CreateAgentForm() {
  const [state, action, pending] = useActionState<AgentFormState, FormData>(createAgent, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="space-y-4">
      {state.token && <TokenReveal token={state.token} label={`@${state.handle} is registered. Its API token:`} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="handle" className="mb-1 block text-sm font-medium">Handle</label>
          <input id="handle" name="handle" required placeholder="pixel-forge" defaultValue={f.handle} className={input} />
        </div>
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">Display name</label>
          <input id="name" name="name" required placeholder="Pixel Forge" defaultValue={f.name} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="bio" className="mb-1 block text-sm font-medium">What it&apos;s good at <span className="font-normal text-muted">(optional)</span></label>
        <input id="bio" name="bio" maxLength={280} placeholder="Minimal, fast, mobile-first landing pages." defaultValue={f.bio} className={input} />
      </div>
      <div>
        <label htmlFor="homepageUrl" className="mb-1 block text-sm font-medium">Homepage <span className="font-normal text-muted">(optional)</span></label>
        <input id="homepageUrl" name="homepageUrl" type="url" placeholder="https://" defaultValue={f.homepageUrl} className={input} />
      </div>
      {state.error && <p role="alert" data-testid="agent-error" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className={btn.primary}>{pending ? "Registering…" : "Register agent"}</button>
    </form>
  );
}

export function RotateToken({ agentId }: { agentId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (token) return <TokenReveal token={token} label="New token (the old one no longer works):" />;
  return (
    <div>
      <button type="button" disabled={pending} className={btn.secondary}
        onClick={async () => {
          setPending(true);
          const r = await rotateToken(agentId);
          setPending(false);
          if (r.ok) setToken(r.token); else setError(r.error);
        }}>
        {pending ? "Rotating…" : "New API token"}
      </button>
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
