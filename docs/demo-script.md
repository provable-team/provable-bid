# provable.bid — recording transcript

Target: **2:40–2:45**, with a hard export limit below 3:00. Read the narration aloud once before recording.
This is the preferred **AI-enabled** cut, not a claim that all recording prerequisites have passed.
Use [recording-readiness.md](./recording-readiness.md) before recording the final take.

For a real-money version, use the [live-launch assessment](./live-launch.md). Keep the sandbox narration until
the production account, durable storage, mode handling and actual live transaction evidence are verified.

Keep a small, readable **“PayPal sandbox · no real money”** label visible during payment shots.
Shorten waiting and typing in the edit; label time jumps. Use actual results from the same recorded brief.

## Narration and shots

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:13 | Home, then the brief form. Start with the product, not a team introduction or sponsor wall. | “A small business needs a landing page. Comparing promises is hard; comparing finished work is easier. provable.bid lets buyers compare websites from AI agents, then pay for the one they choose.” |
| 0:13–0:31 | A bakery brief with three concrete requirements and a $20 price. Show the disclosed charge, then the sandbox authorization and the app’s confirmed open state. Hide account details. | “Here’s a bakery brief: opening hours, a priced menu, and a page that works on a phone. The twenty-dollar price has a disclosed one-dollar-twenty-three processing charge. PayPal authorizes the total. It has not been captured.” |
| 0:31–0:57 | Actual house-agent entries generated for this brief, visibly labelled as house agents. Show two distinct results. Briefly show an agent submission response or API docs, with credentials hidden. | “Our labelled house agents generate different finished pages for this brief. External agents enter through the same public API, using agent credentials issued by their operators. KERNEL renders each page in a real browser at desktop and phone widths, recording screenshots and layout measurements.” |
| 0:57–1:15 | The qualification panel on an actual AI-judged entry. Show requirement results, evaluator label, and Desktop/Phone previews. Use the verified provider/model as a small caption. | “The AI judge checks the buyer’s requirements using the page, screenshots, and browser measurements. Only qualified work reaches the buyer’s gallery. On this deployment, buyers receive screenshot previews while the original HTML stays locked.” |
| 1:15–1:35 | Choose a winning entry. Show capture completion, then download and open the original. Use the same competition throughout. | “I choose this page. PayPal captures the authorization, and the submitted HTML becomes downloadable. The buyer gets a usable deliverable, not another promise or a mockup.” |
| 1:35–1:55 | Settlement grid and the matching PayPal sandbox payout item marked SUCCESS. Identify the amount, not a personal recipient. | “Nineteen dollars—ninety-five percent of the twenty-dollar price—is allocated to the winning operator. Here is the confirmed sandbox payout. The platform charges a one-dollar fee. Capture and payout are separate states, and the ledger shows both.” |
| 1:55–2:12 | A second, clearly labelled brief. Reject all and wait for the provider-confirmed VOIDED state. Do not use only the optimistic confirmation banner. | “If the buyer rejects everything, nothing qualifies, or the decision deadline expires, the authorization is voided. Here is the confirmed void on a separate brief. There is no participation charge.” |
| 2:12–2:32 | Signed-in operator page: agent list, AG Grid payout-status filter, then the AG Studio status breakdown using real allocations. | “Agent builders connect their PayPal account, register agents, and track their work. AG Grid makes individual allocations inspectable; AG Studio shows their payout-status breakdown. Pending, failed, and simulated amounts are kept distinct from confirmed payouts.” |
| 2:32–2:43 | Return to the two finished websites, then a clean app/repository end card. | “For buyers, proof before purchase. For agent builders, a clear path from a chosen result to payment. provable.bid: pay for proof, not promises.” |

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
- Do not claim AG Studio Agent Framework, custom AI dashboard agents, Render Workflows, or a published Postman collection unless those exact features are implemented and demonstrated.
- The APIMatic-generated PayPal SDK is deployed and tested (`a5e5674`); mention it on the end card or in the write-up. Keep sponsor details on a brief end card or in the write-up rather than interrupting the buyer story.
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
