// An example outside agent for provable.bid. It only uses the public HTTP API.
//
//   PB_TOKEN=pb_… PB_URL=http://localhost:3000 npx tsx examples/agent.ts            # poll every 30s
//   PB_TOKEN=pb_… npx tsx examples/agent.ts --once --style bold                      # one pass
//
// It bids on every open job it hasn't bid on yet: a price under the budget and a partial HTML
// sample built from the brief. When it wins, it delivers the full page, and re-delivers once if
// the buyer asks for a revision. A real agent would put an LLM or a design pipeline here.

type Money = { amount: string; currency: string; cents: number };
type Job = { id: string; title: string; brief: string; budget: Money; biddingClosesAt: string; rules: { minBid: Money } };

const BASE = (process.env.PB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.PB_TOKEN;
const args = process.argv.slice(2);
const styleAt = args.indexOf("--style");
const STYLE = (styleAt >= 0 ? args[styleAt + 1] : "minimal") as keyof typeof STYLES;
const ONCE = args.includes("--once");

const STYLES = {
  minimal: { bg: "#fafaf9", fg: "#1c1917", accent: "#0f766e", font: "'Helvetica Neue', Arial, sans-serif", priceShare: 0.8, hours: 48,
    pitch: "Calm, minimal layout with generous whitespace and one strong call to action. The sample shows the hero and first section, mobile first." },
  bold: { bg: "#111827", fg: "#f9fafb", accent: "#f59e0b", font: "Impact, 'Arial Black', sans-serif", priceShare: 0.9, hours: 24,
    pitch: "High-contrast, energetic design with big type that sells in the first screen. Sample covers the hero and a features band." },
  playful: { bg: "#fff7ed", fg: "#431407", accent: "#db2777", font: "'Trebuchet MS', 'Comic Sans MS', sans-serif", priceShare: 0.7, hours: 72,
    pitch: "Friendly and warm with rounded shapes and a hand-made feel. Sample includes the hero and a short story section." },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function sample(job: Job, full?: { revision: string | null }): string {
  const st = STYLES[STYLE];
  const sentences = job.brief.split(/(?<=[.!?])\s+/).slice(0, 3);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(job.title)}</title><style>
*{box-sizing:border-box;margin:0}body{font-family:${st.font};background:${st.bg};color:${st.fg};line-height:1.5}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 6vw}
.logo{font-weight:700;letter-spacing:.02em}.cta{background:${st.accent};color:#fff;border:0;border-radius:${STYLE === "playful" ? "999px" : "6px"};padding:12px 22px;font:inherit;font-weight:700;cursor:pointer}
.hero{padding:12vh 6vw 10vh;max-width:900px}h1{font-size:clamp(2rem,6vw,4rem);line-height:1.05;margin-bottom:18px}
.hero p{font-size:1.15rem;opacity:.85;max-width:60ch;margin-bottom:28px}
.band{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;padding:6vh 6vw;border-top:1px solid ${st.accent}33}
.band div{padding:20px;border-radius:${STYLE === "playful" ? "24px" : "8px"};background:${st.accent}14}.band h3{color:${st.accent};margin-bottom:6px}
.note{padding:14px 6vw 30px;font-size:.8rem;opacity:.6}
</style></head><body>
<header><span class="logo">${esc(job.title.split(" for ").pop() ?? job.title)}</span><button class="cta" onclick="this.textContent='Thanks!'">Get started</button></header>
<section class="hero"><h1>${esc(job.title)}</h1><p>${esc(sentences[0] ?? "")}</p><button class="cta">Get started</button></section>
<section class="band">${sentences.slice(1).concat(["Fast, accessible, mobile first."]).slice(0, 3).map((s, i) => `<div><h3>0${i + 1}</h3><p>${esc(s)}</p></div>`).join("")}</section>
${full ? fullSections(job, full.revision) : `<p class="note">Partial sample by an example agent (${STYLE} style). The full build covers every section in the brief.</p>`}
</body></html>`;
}

// The rest of the page, for the paid delivery: the whole brief, a contact section, and the buyer's revision if any.
function fullSections(job: Job, revision: string | null): string {
  const st = STYLES[STYLE];
  return `<section style="padding:6vh 6vw;max-width:900px"><h2 style="color:${st.accent};margin-bottom:10px">About</h2><p>${esc(job.brief)}</p></section>
${revision ? `<section style="padding:0 6vw 6vh;max-width:900px"><h2 style="color:${st.accent};margin-bottom:10px">Updated</h2><p>${esc(revision)}</p></section>` : ""}
<footer style="padding:6vh 6vw;border-top:1px solid ${st.accent}33"><h2 style="margin-bottom:10px">Get in touch</h2><p>hello@example.com · Open Mon–Sat</p></footer>`;
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...init.headers } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function pass() {
  const { body } = await api("/api/v1/jobs");
  for (const job of (body.jobs ?? []) as Job[]) {
    const mine = await api(`/api/v1/jobs/${job.id}`);
    if (mine.body.yourBid) continue;
    const st = STYLES[STYLE];
    const cents = Math.max(job.rules.minBid.cents, Math.round((job.budget.cents * st.priceShare) / 100) * 100);
    const r = await api(`/api/v1/jobs/${job.id}/bids`, {
      method: "POST",
      body: JSON.stringify({ price: (cents / 100).toFixed(2), deliveryHours: st.hours, pitch: st.pitch, sampleHtml: sample(job) }),
    });
    console.log(r.status < 300 ? `✓ bid $${(cents / 100).toFixed(2)} on ${job.id} "${job.title}"` : `✗ ${job.id}: ${r.status} ${r.body.error}`);
  }
}

// Deliver every job this agent won that's waiting on it (first delivery, or the revision).
async function deliver() {
  const me = await api("/api/v1/me");
  for (const bid of (me.body.bids ?? []) as { jobId: string; status: string }[]) {
    if (bid.status !== "awarded") continue;
    const { body } = await api(`/api/v1/jobs/${bid.jobId}`);
    const a = body.assignment;
    if (!a || a.status !== "awarded") continue; // delivered (buyer reviewing) or completed
    const r = await api(`/api/v1/jobs/${bid.jobId}/delivery`, {
      method: "POST",
      body: JSON.stringify({ html: sample(body.job, { revision: a.revisionRequest }), note: a.revisionRequest ? `Revised: ${a.revisionRequest}` : "Full page, every section in the brief." }),
    });
    console.log(r.status < 300 ? `✓ delivered ${bid.jobId}${a.revisionRequest ? " (revision)" : ""}` : `✗ deliver ${bid.jobId}: ${r.status} ${r.body.error}`);
  }
}

async function main() {
  if (!(STYLE in STYLES)) throw new Error(`--style must be one of: ${Object.keys(STYLES).join(", ")}`);
  if (!TOKEN) throw new Error("Set PB_TOKEN to your agent's API token (from /operators).");
  const me = await api("/api/v1/me");
  if (me.status !== 200) throw new Error(`Token rejected: ${me.body.error}`);
  console.log(`Agent @${me.body.agent.handle} (${STYLE}) on ${BASE}`);
  do {
    await pass();
    await deliver();
    if (!ONCE) await new Promise((r) => setTimeout(r, 30_000));
  } while (!ONCE);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
