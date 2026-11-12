import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { JSDOM } from "jsdom";

const narrative = {
  overall_verdict: "A warm, readable page that puts opening hours and the pre-order button above the fold.",
  strengths: ["Opening hours sit in their own section", "Pre-order button is high-contrast"],
  weaknesses: ["Story section is one line <b>thin</b>"],
  best_for: "best if you want a simple, warm page",
};
const qualification = (extra: object = {}) => ({
  status: "qualified" as const, failure_code: null, checks: [], reason: "Meets every requirement with clear evidence.",
  evaluator_version: "claude-judge-v1:claude-haiku-5-5", artifact_hashes: [{ asset_id: "asset_1", sha256: "a".repeat(64) }], ...extra,
});

test("gallery card: the AI judge's advisory take, strengths and weaknesses, and the summary when there is no narrative", async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>');
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const [{ createRoot }, { JudgeNotes, JudgeTake }] = await Promise.all([import("react-dom/client"), import("../src/components/judge-narrative.js")]);
  const container = dom.window.document.getElementById("app")!;
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    for (const [key, d] of saved) {
      if (d) Object.defineProperty(globalThis, key, d);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  });

  await act(async () => root.render(<><JudgeTake qualification={qualification({ narrative })} /><JudgeNotes narrative={narrative} /></>));
  const take = container.querySelector(".judge-take")!;
  assert.equal(take.querySelector(".judge-take-label")?.textContent, "AI judge's take (advisory, you choose)");
  assert.equal(take.querySelector(".judge-take-verdict")?.textContent, narrative.overall_verdict);
  assert.equal(take.querySelector(".judge-take-fit")?.textContent, narrative.best_for);
  assert.ok(!take.textContent?.includes("Meets every requirement"), "the narrative replaces the one-line summary");
  const groups = [...container.querySelectorAll(".judge-notes-group")];
  assert.deepEqual(groups.map((g) => g.querySelector("h4")?.textContent), ["Strengths", "Weaknesses"]);
  assert.deepEqual([...groups[0].querySelectorAll("li")].map((li) => li.lastElementChild?.textContent), narrative.strengths);
  assert.equal(groups[1].querySelector("li")?.lastElementChild?.textContent, "Story section is one line <b>thin</b>", "plain text, never markup");
  assert.equal(container.querySelector("b"), null);
  assert.equal(groups[0].querySelector("li > span")?.getAttribute("aria-hidden"), "true", "list markers are decorative");

  // No narrative: the judge's one-line summary, and no empty lists.
  await act(async () => root.render(<><JudgeTake qualification={qualification()} /><JudgeNotes narrative={undefined} /></>));
  assert.equal(container.querySelector(".judge-take-verdict")?.textContent, "Meets every requirement with clear evidence.");
  assert.equal(container.querySelector(".judge-take-fit"), null);
  assert.equal(container.querySelector(".judge-notes"), null);
  // The keyword fallback is labelled as what it is.
  await act(async () => root.render(<JudgeTake qualification={qualification({ evaluator_version: "heuristic-v1" })} />));
  assert.equal(container.querySelector(".judge-take-label")?.textContent, "Keyword check (advisory, you choose)");
});
