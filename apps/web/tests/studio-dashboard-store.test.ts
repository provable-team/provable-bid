import { test } from "node:test";
import assert from "node:assert/strict";
import { createAutosaver, loadDashboard, persistableState, restorableState, type SaveStatus } from "../src/components/studio-dashboard-store";

const page = (extra: Record<string, unknown> = {}) => ({
  id: "earnings",
  widgets: { "by-agent": { type: "bar-chart-grouped", dataMapping: { categoryKey: [{ id: "allocations.agent" }] } } },
  widgetLayout: { "by-agent": { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 16 } },
  ...extra,
});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("saved dashboard state keeps layout, widgets and format, never view state or values picked from the data", () => {
  const kept = persistableState({
    pages: [page({ selection: { widgetId: "by-agent", values: ["Pixel"] }, crossFilter: { filters: [{ value: "Pixel" }] } })],
    selectedPageId: "earnings", panels: { ai: { width: 500 } }, schema: { fields: {} }, version: "3.1.0", rows: [{ amount: 1 }],
  });
  assert.deepEqual(kept, { pages: [page()], selectedPageId: "earnings", schema: { fields: {} }, version: "3.1.0" });
  assert.equal(persistableState({ pages: [] }), null);
  assert.equal(persistableState("x"), null);
});

test("a saved state is restored only when Studio can start from it", () => {
  assert.deepEqual(restorableState({ pages: [page()], selectedPageId: "earnings" }), { pages: [page()], selectedPageId: "earnings" });
  for (const bad of [null, "x", [], {}, { pages: [] }, { pages: [{}] }, { pages: [page({ widgets: [] })] }, { pages: [page()], selectedPageId: "gone" }]) {
    assert.equal(restorableState(bad), null, JSON.stringify(bad));
  }
});

test("loading reads the operator's dashboard with their credential; an unusable or missing one is null", async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const respond = (body: unknown, status = 200) => (async (url: string, init?: RequestInit) => { seen.push({ url, init }); return new Response(JSON.stringify(body), { status }); }) as unknown as typeof fetch;
  const saved = await loadDashboard({ baseUrl: "http://api.test/", token: "pbo_x", fetchImpl: respond({ state: { pages: [page()] }, version: 3, updated_at: null, server_time: "x" }) });
  assert.equal(seen[0].url, "http://api.test/v1/operators/me/studio-dashboard");
  assert.equal((seen[0].init?.headers as Record<string, string>).Authorization, "Bearer pbo_x");
  assert.deepEqual(saved, { state: { pages: [page()] }, version: 3 });
  assert.deepEqual(await loadDashboard({ baseUrl: "http://api.test", token: "t", fetchImpl: respond({ state: null, version: 0, updated_at: null, server_time: "x" }) }), { state: null, version: 0 });
  assert.deepEqual(await loadDashboard({ baseUrl: "http://api.test", token: "t", fetchImpl: respond({ state: { pages: "bad" }, version: 2, updated_at: null, server_time: "x" }) }), { state: null, version: 2 });
  await assert.rejects(loadDashboard({ baseUrl: "http://api.test", token: "t", fetchImpl: respond({ code: "NOT_FOUND" }, 404) }));
});

test("the autosaver waits for a pause, saves the latest state once against the last version, and skips unchanged states", async () => {
  const puts: { body: any; key: string }[] = [];
  let version = 1;
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    puts.push({ body: JSON.parse(String(init.body)), key: (init.headers as Record<string, string>)["Idempotency-Key"] });
    return new Response(JSON.stringify({ version: ++version, updated_at: "2026-11-12T10:00:00Z", server_time: "2026-11-12T10:00:00Z" }), { status: 200 });
  }) as unknown as typeof fetch;
  const statuses: SaveStatus[] = [];
  const loaded = { pages: [page()] };
  const saver = createAutosaver({ account: { baseUrl: "http://api.test", token: "t", fetchImpl }, version: 1, saved: loaded, delayMs: 20, onStatus: (s) => statuses.push(s) });
  saver.schedule({ pages: [page()], panels: { ai: { width: 300 } } });
  await wait(40);
  assert.equal(puts.length, 0, "the state it was loaded with is not saved again");
  saver.schedule({ pages: [page({ layout: { rowHeight: 10 } })] });
  saver.schedule({ pages: [page({ layout: { rowHeight: 20 } })] });
  await wait(10);
  assert.equal(puts.length, 0, "debounced");
  await wait(40);
  assert.equal(puts.length, 1);
  assert.deepEqual(puts[0].body, { state: { pages: [page({ layout: { rowHeight: 20 } })] }, version: 1 });
  assert.equal(saver.version, 2);
  assert.deepEqual(statuses, ["saving", "saved"]);
  saver.schedule({ pages: [page({ layout: { rowHeight: 30 } })] });
  await saver.flush();
  assert.equal(puts[1].body.version, 2, "the next save replaces the version just saved");
  assert.notEqual(puts[1].key, puts[0].key);
});

test("the autosaver retries an unknown outcome with the same key, stops on a conflict, and refuses an oversized state", async () => {
  const keys: string[] = [];
  let next: () => Response | Promise<Response> = () => { throw new TypeError("network down"); };
  const fetchImpl = (async (_url: string, init: RequestInit) => { keys.push((init.headers as Record<string, string>)["Idempotency-Key"]); return next(); }) as unknown as typeof fetch;
  const statuses: SaveStatus[] = [];
  const saver = createAutosaver({ account: { baseUrl: "http://api.test", token: "t", fetchImpl }, version: 0, delayMs: 5, onStatus: (s) => statuses.push(s) });
  saver.schedule({ pages: [page()] });
  await saver.flush();
  assert.equal(statuses.at(-1), "error");
  next = () => new Response(JSON.stringify({ version: 1, updated_at: "2026-11-12T10:00:00Z", server_time: "2026-11-12T10:00:00Z" }), { status: 200 });
  await saver.retry();
  assert.equal(statuses.at(-1), "saved");
  assert.equal(keys[0], keys[1], "a retry of the same state reuses its Idempotency-Key");

  next = () => new Response(JSON.stringify({ code: "INVALID_STATE" }), { status: 409 });
  saver.schedule({ pages: [page({ layout: { rowHeight: 5 } })] });
  await saver.flush();
  assert.equal(statuses.at(-1), "conflict");
  saver.schedule({ pages: [page({ layout: { rowHeight: 6 } })] });
  await wait(20);
  assert.equal(keys.length, 3, "no more saves after another window saved");

  const big = createAutosaver({ account: { baseUrl: "http://api.test", token: "t", fetchImpl }, version: 0, delayMs: 5, onStatus: (s) => statuses.push(s) });
  big.schedule({ pages: [page({ notes: "x".repeat(200_001) })] });
  await wait(20);
  assert.equal(statuses.at(-1), "too-large");
  assert.equal(keys.length, 3);
});
