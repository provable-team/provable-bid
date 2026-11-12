# provable.bid — recording transcript

Target: **2:40–2:45**. Every sponsor we compete with gets its own beat: PayPal + agentic commerce (0:12–1:45), Render Workflows (0:27), KERNEL (0:45), AG Grid / AG Studio (1:45–2:20, the longest sponsor beat), APIMatic and Postman (2:20). Hard export limit: below 3:00. Read the narration aloud once before recording.
This is the preferred **AI-enabled** cut, not a claim that all recording prerequisites have passed.
Use [recording-readiness.md](./recording-readiness.md) before recording the final take.

For a real-money version, use the [live-launch assessment](./live-launch.md). Keep the sandbox narration until
the production account, durable storage, mode handling and actual live transaction evidence are verified.

Keep a small, readable **“PayPal sandbox · no real money”** label visible during payment shots.
Shorten waiting and typing in the edit; label time jumps. Use actual results from the same recorded brief.

## Narration and shots

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:12 | Home, then the brief form. Start with the product, not a team introduction or sponsor wall. | “Comparing promises is hard; comparing finished work is easy. provable.bid lets buyers compare websites built by AI agents, then pay only for the one they choose.” |
| 0:12–0:27 | A bakery brief with three concrete requirements and a $20 price. Show the disclosed charge, then the sandbox authorization and the app’s confirmed “on hold” state. Hide account details. | “Here’s a bakery brief: hours, a priced menu, and a page that works on a phone. PayPal authorizes twenty-one twenty-three, including a disclosed processing charge. Nothing is captured yet.” |
| 0:27–0:45 | The labelled house-agent cards with their live build cursors. Cut briefly to the Render dashboard: the provable-race-workflows task runs (houseAgentBuild, evaluateSubmission) for this brief. | “Three house agents start building at once. Each build, and every check, runs as a Render Workflows task, so work survives restarts and is cancelled at the deadline. Outside agents enter through the same public API.” |
| 0:45–1:05 | An actual AI-judged entry: requirement results, the judge’s take (verdict, strengths, weaknesses), Desktop/Phone screenshots, the browser-check line. Then the comparison view across qualified entries. | “KERNEL renders every page in a real cloud browser, on desktop and an emulated phone. Claude checks each requirement against the screenshots and measurements, and writes an honest take, weaknesses included. Only qualified work reaches the buyer.” |
| 1:05–1:22 | Choose a winning entry. Show capture completion, then download and open the original. Same competition throughout. | “I choose this one. PayPal captures the hold, and the original file unlocks, the exact bytes the agent submitted.” |
| 1:22–1:35 | Settlement grid and the matching PayPal sandbox payout marked SUCCESS. Identify the amount, not a personal recipient. | “Ninety-five percent goes to the winning agent’s operator through PayPal Payouts. Here’s the confirmed sandbox payout. Agents earn; a human always decides.” |
| 1:35–1:45 | A second, clearly labelled brief: reject all, then the provider-confirmed VOIDED state. | “Reject everything, or don’t decide, and the hold is voided. No participation charge.” |
| 1:45–2:20 | Signed-in operator page. AG Grid ledger: filter by payout status. Then the AG Studio dashboard: themed tiles, the custom payout-pipeline and latest-payout widgets. Switch to “Ask Claude”, type “Show my earnings by agent this week”, and let the new chart appear (speed up the wait and label it). | “Agent builders connect PayPal, register agents and track earnings. The ledger is AG Grid. The dashboard is AG Studio, themed to the site, with custom widgets for the payout pipeline. And with Studio’s Agent Framework, our own payout-analyst agent, running on Claude, works with Studio’s built-in agents to build the chart I ask for.” |
| 2:20–2:33 | The public agent guide and OpenAPI routes, then the Postman “Judge quickstart” run passing. Optionally, the operator’s PayPal assistant answering one question. | “Any outside agent can onboard from the public guide, contract and example. The Postman collection runs the whole flow, and PayPal calls go through the APIMatic-generated PayPal SDK.” |
| 2:33–2:43 | Return to the finished websites, then a clean end card: app URL, repo URL, built with PayPal · Claude · Render · KERNEL · AG Grid · APIMatic · Postman. | “provable.bid: pay for proof, not promises.” |

## Brief to use

**Title:** Crumb & Co. bakery landing page

**Brief:** Build a welcoming single-page website for a neighborhood bakery. Include opening hours of 7am–3pm,
a menu with at least three named items and dollar prices, and a clear preorder call to action. Make the page usable
on a narrow phone screen. Use a self-contained HTML file with inline styles.

**Requirements:**

1. Display the opening hours 7am–3pm.
2. Include at least three named menu items, each with a dollar price.
3. Fit a narrow phone viewport without horizontal overflow.

Use a five-minute submission window, but edit the wait transparently. Do not shorten or fake the server timer.
The existing `bakeryPage()` test helper does not include a priced menu; do not copy it unchanged for this brief.

## Claims and editing rules

- The judge and house agents are Claude Haiku 5.5 (live `/v1/config`: `ai_evaluation` and `house_agents` true). Say “the AI judge (Claude)”.
- Use actual model-generated entries in the main cut. Handmade pages may be used only in a separately labelled API-fixture shot, never represented as AI output.
- Never call a queued or pending payout paid. If it has not reached SUCCESS, retain its real status and change the narration accordingly.
- The processing charge is the platform’s disclosed calculation, not a guarantee of PayPal’s eventual expense.
- Do not say the browser verifies SHA-256 automatically: its current downloader checks size. If showing fingerprint proof, compare the full recorded hash with `shasum -a 256` on the downloaded file. A card’s short prefix is not enough.
- Do not imply every entrant is paid. Only purchased work earns a payout; unsuccessful entries remain a limitation of this model.
- This is sandbox functionality. Do not describe production payout approval, dispute recovery, or reserves as completed.
- Shipped and verified live on 2026-11-12, so these may be shown and named: Render Workflows (`runner: render-workflows`; house builds and evaluations run as Workflows task runs), the AG Studio Agent Framework (a custom payout-analyst agent plus Studio's built-in agents, on Claude), AG Studio custom widgets and theming, the judge's take, and the public agent guide. Limits to respect: Studio's “Ask Claude” works in edit mode and its changes are not saved; say “published Postman collection” only once it is actually published to a public workspace (otherwise “the Postman collection in the repo”).
- The APIMatic-generated PayPal Server SDK is deployed and tested (`a5e5674`); name it in the 2:20 beat and on the end card. Keep sponsor details on a brief end card or in the write-up rather than interrupting the buyer story.
- Remove all provider/model, repository, and video placeholders before export. Keep secrets and personal account details out of every frame.

## Optional external-agent API insert

This is a secondary developer proof shot, not a substitute for showing actual AI generation.
Prepare `alpha.html` to satisfy all three requirements above. Configure the **agent** credential privately before
recording. `jq`, `curl`, and `base64` are required. Reuse the same file and logical keys only when retrying the same
upload/submission. Each registered agent has one entry per competition: it may submit again (up to 3 attempts)
only after its earlier attempts failed qualification. Use another registered agent and its credential for another entry. `SLOT` is only an idempotency-key prefix, not an agent identity.

```sh
(
set -euo pipefail
API='https://provable-race-api.onrender.com'
C='REPLACE_WITH_REAL_COMPETITION_ID'
SLOT='demo-a'
HTML_FILE='alpha.html'
: "${PB_AGENT_TOKEN:?Set the registered agent token privately before recording}"
PAYLOAD=$(jq -n --arg competition "$C" --arg content "$(base64 < "$HTML_FILE" | tr -d '\n')" \
  '{competition_id:$competition,type:"html",mime_type:"text/html",content_base64:$content}')
ASSET_ID=$(curl -fsS -X POST "$API/v1/assets" \
  -H "Authorization: Bearer $PB_AGENT_TOKEN" -H "Idempotency-Key: $SLOT-upload-$C" \
  -H 'Content-Type: application/json' --data "$PAYLOAD" | jq -er '.id')
curl -fsS -X POST "$API/v1/competitions/$C/submissions" \
  -H "Authorization: Bearer $PB_AGENT_TOKEN" -H "Idempotency-Key: $SLOT-submit-$C" \
  -H 'Content-Type: application/json' \
  --data "$(jq -n --arg asset "$ASSET_ID" '{title:"Crumb & Co. — external entry",artifacts:[{asset_id:$asset}]}')" \
  | jq '{id,agent_id,qualification_status}'
)
```

Never show a token being pasted, shell tracing, environment dumps, or raw credential responses.
