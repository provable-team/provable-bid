import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HowItWorksContent, LIVE_API } from "../src/components/how-it-works.js";

const html = renderToStaticMarkup(<HowItWorksContent notice={null} stats={null} />);
const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

test("the page renders its key sections, with headings in order", () => {
  const headings = [...html.matchAll(/<h([1-3])[^>]*>(.*?)<\/h\1>/g)].map(([, level, body]) => `${level}:${body.replace(/<[^>]+>/g, "")}`);
  assert.equal(headings[0], "1:How provable.bid works");
  assert.equal(headings.filter((h) => h.startsWith("1:")).length, 1, "one h1");
  for (const h2 of ["Who it is for", "Where the money goes", "How entries are checked", "Built to be trusted",
    "Verified on the live sandbox, Nov 12 2026", "Connect your agent", "What&#x27;s next"]) {
    assert.ok(headings.some((h) => h === `2:${h2}`), `missing h2 ${h2}`);
  }
  let previous = 1;
  for (const h of headings) {
    const level = Number(h[0]);
    assert.ok(level <= previous + 1, `heading level jumps at ${h}`);
    previous = level;
  }
});

test("it names the PayPal pieces and the money flow", () => {
  for (const piece of ["AUTHORIZE", "CAPTURE", "Void", "Payouts", "Log in with PayPal", "Verified webhooks", "95%"]) {
    assert.match(text, new RegExp(piece), piece);
  }
  assert.match(text, /requests a void of the PayPal authorization/);
  assert.match(text, /KERNEL cloud browser/);
  assert.match(text, /Render Workflows/);
  assert.match(text, /Neon Postgres/);
});

test("the sandbox proof is exact and the agent snippets are the documented ones", () => {
  assert.match(text, /12 Render Workflows task runs, finishing within about 50 seconds of the hold being approved/);
  assert.match(text, /qualified 4\/4, was picked by the buyer, and its operator received a \$9\.50 PayPal Payout \(status paid\)/);
  assert.match(text, /Rejected or undecided briefs request a void\. A PayPal-confirmed void means no charge\./);
  assert.match(text, /node agent\.mjs connect/);
  assert.ok(text.includes(`claude mcp add --transport http provable ${LIVE_API}/mcp --header "Authorization: Bearer $PB_TOKEN"`));
  assert.match(html, /href="\/operators"/);
  assert.match(html, /href="\/operators\/activate"/);
  assert.ok(html.includes(`href="${LIVE_API}/agent-guide.md"`));
  assert.ok(html.includes(`href="${LIVE_API}/examples/agent.mjs"`));
});

test("no IDs, tokens or em dashes on the page", () => {
  assert.doesNotMatch(html, /\b(agent|sub|cmp|pay|op|alloc)_[A-Za-z0-9]/);
  assert.doesNotMatch(html, /pba_|pbo_|PAYID|@[a-z0-9-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(html, /—/);
});

test("payment environment copy distinguishes live, test and unknown", async () => {
  const { paymentEnvironmentText } = await import("../src/components/payment-environment-notice.js");
  assert.match(paymentEnvironmentText("paypal_live"), /real money/);
  assert.doesNotMatch(paymentEnvironmentText("paypal_live"), /no real charges|test money/);
  assert.match(paymentEnvironmentText("paypal_sandbox"), /test money/);
  assert.match(paymentEnvironmentText("mock"), /fake payments/);
  assert.match(paymentEnvironmentText(null), /unavailable/);
  assert.match(paymentEnvironmentText("unexpected"), /unavailable/);
});
