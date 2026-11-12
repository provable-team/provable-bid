import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { BrowserCheck, Submission } from "@provable/api-client";
import { EntryComparison } from "../src/components/entry-comparison.js";

const measured: BrowserCheck = {
  phone_fits: true, phone_overflow_px: 0, phone_layout_width: 390,
  console_errors: 0, blocked_requests: 0, focus_stops: 6, focus_visible: 6,
  focus_complete: true, load_ms: 412, render_ms: 6100,
  replay_url: null, replay_expires_at: null,
};

function entry(id: string, browser_check?: BrowserCheck): Submission {
  return {
    id, competition_id: "competition", agent_id: `agent-${id}`, operator_id: "operator",
    title: `Finished site ${id}`, qualification_status: "qualified",
    created_at: "2026-11-12T12:00:00Z", server_time: "2026-11-12T12:00:00Z", artifacts: [],
    qualification: {
      status: "qualified", reason: "Private evaluator explanation",
      evaluator_version: "private-model-details", failure_code: null, artifact_hashes: [],
      checks: [
        { requirement_id: "one", passed: true, reason: "Private evaluator check" },
        { requirement_id: "two", passed: true, reason: "Private evaluator check" },
      ],
    },
    ...(browser_check ? { browser_check } : {}),
  };
}

const render = (submissions: Submission[]) => renderToStaticMarkup(
  <EntryComparison submissions={submissions} agents={[]} requirementCount={2} />,
);

test("comparison offers observed evidence and a preview link, without exposing evaluator prose or purchase actions", () => {
  const out = render([entry("one", measured), entry("two", measured)]);
  assert.match(out, /Compare the evidence/);
  assert.match(out, /2 of 2 passed/);
  assert.match(out, /Fits a 390px phone/);
  assert.match(out, /Visible on 6 of 6 Tab stops/);
  assert.match(out, /href="#entry-one"/);
  assert.match(out, /href="#entry-two"/);
  assert.match(out, /scope="col"/);
  assert.match(out, /scope="row"/);
  assert.doesNotMatch(out, /Private evaluator|private-model|<button|best entry|recommended winner/i);
});

test("missing checks stay unknown and capped keyboard samples are explicit", () => {
  const out = render([
    entry("unknown"),
    entry("sampled", { ...measured, focus_stops: 20, focus_visible: 18, focus_complete: false, phone_fits: false, phone_layout_width: 980, phone_overflow_px: 590 }),
  ]);
  assert.match(out, /Not measured/);
  assert.match(out, /Visible on 18 of the first 20 Tab stops/);
  assert.match(out, /Phone zooms out from a 980px layout/);
  assert.match(out, /Checks describe one browser run, not a design ranking/);
});

test("only qualified entries appear and a single entry does not create a comparison", () => {
  const failed = { ...entry("failed"), qualification_status: "failed" as const };
  assert.equal(render([entry("one"), failed]), "");
  assert.doesNotMatch(render([entry("one"), entry("two"), failed]), /Finished site failed/);
});

test("zero keyboard stops and sideways scrolling are useful notes, not passes", () => {
  const out = render([
    entry("one", { ...measured, phone_fits: false, phone_overflow_px: 24, focus_stops: 0, focus_visible: 0 }),
    entry("two", { ...measured, focus_stops: null, focus_visible: null }),
  ]);
  assert.match(out, /24px sideways scrolling/);
  assert.match(out, /No controls reached by Tab/);
  assert.match(out, /Not measured/);
});
