import { test } from "node:test";
import assert from "node:assert/strict";
import type { AgAiEvent, AgLlmRequest } from "ag-studio";
import { fromTurn, studioAiAdapter, toTurnRequest } from "../src/components/studio-ai-adapter";
import { phoneLayout, studioAllocationData } from "../src/components/studio-dashboard-data";

test("dashboard data is the loaded ledger: dollars, paid only when PayPal said so, running total in created order", () => {
  const { allocations, missingAmounts } = studioAllocationData([
    { created_at: "2026-11-10T10:00:00Z", agent: "Loom", payout_state: "pending", ledger_state: "allocated", amount_minor: 3325 },
    { created_at: "2026-11-08T10:00:00Z", agent: "Pixel", payout_state: "paid", ledger_state: "allocated", amount_minor: 1900 },
    { created_at: "2026-11-09T10:00:00Z", agent: "Pixel", payout_state: "failed", ledger_state: "allocated", amount_minor: null },
  ]);
  assert.equal(missingAmounts, 1);
  assert.deepEqual(allocations.map((a) => [a.agent, a.allocation_usd, a.paid_usd, a.cumulative_usd]), [
    ["Pixel", 19, 19, 19],
    ["Pixel", null, 0, 19],
    ["Loom", 33.25, 0, 52.25],
  ]);
  assert.ok(allocations[0].created_at instanceof Date);
});

test("phone layout pairs small tiles, stacks the rest full width, and returns layouts in the order given", () => {
  const c = (xTrack: number, yTrack: number, xSpan: number, ySpan: number, min = 2) => ({ layout: { xTrack, yTrack, xSpan, ySpan }, minSize: { xSpan: min, ySpan: 4 } });
  const out = phoneLayout([c(12, 18, 12, 17), c(0, 0, 6, 8), c(6, 0, 6, 8), c(0, 8, 24, 10), c(12, 0, 6, 8, 20)], 24);
  assert.deepEqual(out[1], { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 8 });
  assert.deepEqual(out[2], { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 8 });
  assert.deepEqual(out[4], { xTrack: 0, yTrack: 8, xSpan: 24, ySpan: 8 }, "a tile too wide to pair goes full width at its own height");
  assert.deepEqual(out[3], { xTrack: 0, yTrack: 16, xSpan: 24, ySpan: 14 }, "the full-width strip gets room for stacked stages");
  assert.deepEqual(out[0], { xTrack: 0, yTrack: 30, xSpan: 24, ySpan: 17 });
});

const request = {
  instructions: "Analyst",
  input: [
    { id: "1", kind: "input", type: "message", role: "user", status: "completed", content: [{ type: "text", text: "Chart it" }, { type: "image", detail: "auto", imageUrl: "x" }] },
    { id: "2", kind: "output", type: "reasoning", summary: [] },
    { id: "3", kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: "Looking.", annotations: [] }] },
    { id: "4", kind: "output", type: "function_call", callId: "call:1", name: "view_schema", arguments: "{}" },
    { type: "function_call_output", callId: "call:1", output: "{}", status: "completed" },
  ],
  tools: [
    { name: "view_schema", description: "Schema", parameters: { type: "object" } },
    { name: "web_search", description: "Hosted", parameters: { type: "object" }, kind: "provided", provider: { type: "web_search" } },
  ],
  toolChoice: { name: "view_schema" },
  responseFormat: { type: "text" },
} as unknown as AgLlmRequest;

test("Studio turns map onto the API's turn format; hosted tools, reasoning and attachments stay behind", () => {
  const body = toTurnRequest(request);
  assert.deepEqual(body.input, [
    { type: "message", role: "user", text: "Chart it" },
    { type: "message", role: "assistant", text: "Looking." },
    { type: "tool_call", call_id: "call_1", name: "view_schema", arguments: "{}" },
    { type: "tool_result", call_id: "call_1", output: "{}" },
  ]);
  assert.deepEqual(body.tools.map((t) => t.name), ["view_schema"]);
  assert.deepEqual(body.tool_choice, { name: "view_schema" });
  assert.equal(body.instructions, "Analyst");
});

test("the adapter posts with the operator's credential, replays the turn as events, and reports failures on complete", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const turn = { id: "msg_1", model: "claude-haiku-5-5", status: "completed", server_time: "2026-11-12T10:00:00Z", usage: { input_tokens: 12, output_tokens: 3, cached_input_tokens: 10 },
    output: [{ type: "message", text: "Adding." }, { type: "tool_call", call_id: "toolu_1", name: "delegate_to", arguments: "{\"agent\":\"lead\"}" }] };
  const ok = studioAiAdapter({ baseUrl: "http://api.test/", token: "pbo_x", fetchImpl: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify(turn), { status: 200 }); }) as typeof fetch });
  const handler = ok.executeTurn(request);
  const events: AgAiEvent[] = [];
  for await (const event of handler.stream) events.push(event);
  const response = await handler.complete;
  assert.equal(calls[0].url, "http://api.test/v1/operators/me/studio-ai/turns");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer pbo_x");
  assert.ok((calls[0].init.headers as Record<string, string>)["Idempotency-Key"]);
  assert.deepEqual(events.map((e) => e.type), ["TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END", "TOOL_CALL_START", "TOOL_CALL_ARGS", "TOOL_CALL_END"]);
  assert.equal(response.output[1].type, "function_call");
  assert.equal(response.usage?.inputTokens, 12);
  assert.equal(fromTurn({ ...turn, status: "refused", output: [] } as never).response.output.length, 1, "a refusal is said, not silently empty");

  const failing = studioAiAdapter({ baseUrl: "http://api.test", token: "pbo_x", fetchImpl: (async () => new Response(JSON.stringify({ detail: "Daily limit reached." }), { status: 429 })) as unknown as typeof fetch });
  const failed = failing.executeTurn(request);
  for await (const _ of failed.stream) assert.fail("no events for a failed turn");
  await assert.rejects(failed.complete, /Daily limit reached/);
});
