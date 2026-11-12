import type { components } from "@provable/api-client";

// Saving the operator's AG Studio dashboard (layout, widgets, format) to the API, so changes made by hand or by the
// assistant survive reloads and other devices. No Studio runtime here, so it can be tested on its own.

type Saved = components["schemas"]["StudioDashboard"];
type SaveResult = components["schemas"]["StudioDashboardSaved"];
/** Studio's report state as stored: plain JSON, pages first. */
export type DashboardState = { pages: Record<string, unknown>[]; selectedPageId?: string } & Record<string, unknown>;

/** The API refuses larger states (413); stay a little under it. */
export const DASHBOARD_MAX_BYTES = 200_000;
export const SAVE_DELAY_MS = 1500;

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * What is worth keeping of Studio's state: pages (widgets, widget layout, page layout, filters) and the schema. View
 * state stays behind: panel sizes, and each page's selection and cross-filter (which hold values picked from the data).
 * Studio's state never holds the data rows themselves; the data sources always come from the live ledger.
 */
export function persistableState(state: unknown): DashboardState | null {
  if (!isObject(state) || !Array.isArray(state.pages) || state.pages.length === 0) return null;
  const pages = state.pages.filter(isObject).map((page) => {
    const { selection: _selection, crossFilter: _crossFilter, ...kept } = page;
    return kept;
  });
  const out: DashboardState = { pages };
  if (typeof state.selectedPageId === "string") out.selectedPageId = state.selectedPageId;
  if (isObject(state.schema)) out.schema = state.schema;
  if (typeof state.version === "string") out.version = state.version;
  // A JSON round trip: no functions, Dates or shared references from Studio's live objects.
  return JSON.parse(JSON.stringify(out)) as DashboardState;
}

/** A saved state Studio can start from, or null (start from the default layout instead). */
export function restorableState(saved: unknown): DashboardState | null {
  if (!isObject(saved) || !Array.isArray(saved.pages) || saved.pages.length === 0) return null;
  const pagesOk = saved.pages.every((page) => isObject(page) && typeof page.id === "string" && page.id.length > 0
    && (page.widgets === undefined || isObject(page.widgets)) && (page.widgetLayout === undefined || isObject(page.widgetLayout)));
  if (!pagesOk) return null;
  if (saved.selectedPageId !== undefined && !saved.pages.some((page) => (page as { id: string }).id === saved.selectedPageId)) return null;
  return persistableState(saved);
}

export type DashboardAccount = { baseUrl: string; token: string; fetchImpl?: typeof fetch };

async function problem(response: Response) {
  const body = await response.json().catch(() => null) as { detail?: string; code?: string } | null;
  return { status: response.status, code: body?.code };
}

/** Reads the saved dashboard: its state (null when none, or unusable) and version. Throws when the API can't say. */
export async function loadDashboard({ baseUrl, token, fetchImpl = fetch }: DashboardAccount, signal?: AbortSignal) {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/operators/me/studio-dashboard`, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!response.ok) throw Object.assign(new Error("Could not load the saved dashboard."), await problem(response));
  const saved = await response.json() as Saved;
  return { state: restorableState(saved.state), version: saved.version };
}

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict" | "too-large";

/**
 * Debounced saving. `schedule` takes Studio's current state on every change; after `delayMs` of quiet the latest one
 * is saved, one request at a time, against the version last saved (the API refuses a stale one: another window saved
 * meanwhile). A save whose outcome is unknown (network error, 5xx) stays the pending command: before any newer state
 * is sent it is replayed with the same Idempotency-Key, body and version, so the API either applies it once or returns
 * the result it already committed, and only a 409 after that replay is a real conflict.
 */
export function createAutosaver({ account, version, delayMs = SAVE_DELAY_MS, onStatus, saved }: {
  account: DashboardAccount;
  /** The version the dashboard was loaded at (0: nothing saved). */
  version: number;
  delayMs?: number;
  onStatus: (status: SaveStatus) => void;
  /** The state the dashboard was loaded with, as saved: an unchanged dashboard is not saved again. */
  saved?: DashboardState | null;
}) {
  const fetchImpl = account.fetchImpl ?? fetch;
  let current = version;
  let lastJson = saved ? JSON.stringify(saved) : null;
  let pending: string | null = null;
  /** A sent save whose outcome is unknown; replayed exactly (key, body, version) before anything newer. */
  let unresolved: { json: string; key: string; body: string } | null = null;
  let failed: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let stopped = false;

  type Outcome = "saved" | "unknown" | "conflict" | "rejected";
  async function put(command: { json: string; key: string; body: string }): Promise<Outcome> {
    onStatus("saving");
    try {
      const response = await fetchImpl(`${account.baseUrl.replace(/\/$/, "")}/v1/operators/me/studio-dashboard`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.token}`, "Idempotency-Key": command.key },
        body: command.body,
        // Lets a save started as the page closes finish (browsers cap keepalive bodies at 64 KB).
        keepalive: command.body.length < 60_000,
      });
      if (!response.ok) {
        const { status } = await problem(response);
        if (status >= 500) { unresolved = command; return "unknown"; }
        if (unresolved === command) unresolved = null;
        if (status === 409) { stopped = true; onStatus("conflict"); return "conflict"; }
        onStatus(status === 413 ? "too-large" : "error");
        return "rejected";
      }
      const result = await response.json() as SaveResult;
      current = result.version; lastJson = command.json;
      if (unresolved === command) unresolved = null;
      return "saved";
    } catch {
      unresolved = command;
      return "unknown";
    }
  }

  async function send(json: string) {
    // First settle a save whose outcome is unknown: same key, same body (and so the same base version).
    if (unresolved) {
      const outcome = await put(unresolved);
      if (outcome === "unknown") { failed = json; onStatus("error"); return; }
      if (outcome === "conflict") { failed = json; return; }
    }
    if (json === lastJson) { failed = null; if (!pending) onStatus("saved"); return; }
    const outcome = await put({ json, key: crypto.randomUUID(), body: `{"state":${json},"version":${current}}` });
    if (outcome === "saved") { failed = null; if (!pending) onStatus("saved"); return; }
    failed = json;
    if (outcome === "unknown") onStatus("error");
  }

  async function drain() {
    while (pending && !stopped) {
      const json = pending; pending = null;
      await send(json);
    }
  }

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!running) running = drain().finally(() => { running = null; if (pending && !stopped) flush(); });
    return running;
  }

  return {
    /** Studio's state changed. */
    schedule(state: unknown) {
      if (stopped) return;
      const kept = persistableState(state);
      if (!kept) return;
      const json = JSON.stringify(kept);
      if (json === lastJson && !running && !pending && !unresolved) return; // nothing changed (e.g. Studio re-checked its state on load)
      if (new TextEncoder().encode(json).length > DASHBOARD_MAX_BYTES) { pending = null; onStatus("too-large"); return; }
      pending = json;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delayMs);
    },
    /** Save now whatever is waiting (e.g. before the dashboard unmounts). */
    flush,
    /** Retry after a failure. */
    retry() { if (!pending && failed && !stopped) pending = failed; return flush(); },
    get version() { return current; },
  };
}
