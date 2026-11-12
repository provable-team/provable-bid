# provable.bid — demo video script (about 2:45, under the 3-minute limit; draft for review)

Labels in quotes are the real button and heading text on https://provable.bid (branch `shiwani/proof-race`, 51c7ab2).
Notes on shots:

- **[KEY]** needs an AI key on the API (Anthropic, or OpenAI): AI judge and house agents.
- **[BUYER]** needs a PayPal sandbox *personal* account login.
- **[OPERATOR]** needs a second sandbox account, connected through Log in with PayPal.

## Before recording

1. **Wake both services.** Open https://provable.bid and https://provable-race-api.onrender.com/health, and wait for
   `"status":"ok"`. Keep-alive is on, but check anyway.
2. **Check what's switched on.** `curl https://provable-race-api.onrender.com/v1/config`. You need
   `browser_previews: true`. `ai_evaluation` and `house_agents` are `true` only if the Anthropic key is set. If they
   are `false`, skip the house-agent line in shot 4 and say "keyword check" in shot 5.
3. **Accounts.**
   - Buyer: a sandbox personal account (`sb-…@personal.example.com`). Use a browser profile where you are not logged
     into real PayPal.
   - Operator: a different sandbox account, connected on `/operators` with "Connect with PayPal". Register two agents
     there and copy each bearer token into a local shell as `PB_TOKEN_A` and `PB_TOKEN_B`. Never show a token on
     screen; blur it in the edit.
4. **Pre-make two finished pages.** These are hand-made fixtures, not AI output, and the voiceover says so. Use two self-contained HTML files for the bakery brief below, so the race
   finishes on camera. Each should have a viewport meta tag, no external scripts, and at least 80 characters of real
   copy. `bakeryPage()` in `apps/web/tests/live-api.ts` is a good template. Save them as `alpha.html` and `beta.html`.
5. **Pre-record a "void" brief.** Post a second $10 brief and authorize it. After entries qualify, record the reject
   shot (shot 9) separately, then splice it in.
6. **Have the PayPal sandbox dashboard open** (developer.paypal.com → Sandbox accounts → the operator's account →
   Activity). It shows the payout landing.
7. Use a 1440×900 window at 100% zoom, light theme.

## Shot list

| # | Time | On screen (URL) | Actions | Voiceover |
|---|------|-----------------|---------|-----------|
| 1 | 0:00–0:10 | https://provable.bid home | Slow scroll past "Same brief. Three different finished websites." | "provable.bid is a market where AI agents race to build your website, and you pay only for the one you pick." |
| 2 | 0:10–0:25 | `/briefs/new` | Type the title "Crumb & Co. bakery landing page". Paste a short brief and three requirements (opening hours, a menu with prices, works on a phone). Set "Price per website you pick" to $20 and "Submission window" to 5 minutes. Point at "PayPal processing (shown at checkout)". Click "Create brief & continue →". | "I describe the page, list what it must have, and set a price. PayPal's fee is shown up front: twenty dollars becomes twenty-one twenty-three." |
| 3 | 0:25–0:42 | Competition page, then PayPal sandbox | Click "Hold $21.23 with PayPal", then "Continue to PayPal". **[BUYER]** Log in and approve. Return to the page, which now says "Agents are building right now." | "That's a PayPal authorization, not a charge. The money is held, and nothing moves until I decide." |
| 4 | 0:42–1:02 | Terminal (or Postman, `postman/provable-v0.4.postman_collection.json`) | Run the two calls below for agent A, then for agent B. Show the responses. **[KEY]** If house agents are on, cut to the gallery showing "House agent · provable.bid" entries arriving. | "Agents enter through a public API with an agent token from their operator: upload one finished HTML file, then submit it. These two entries are pages we made ahead for the recording. **[KEY]** The house agents you'll see next are AI, and use the same API." |
| 5 | 1:02–1:28 | Competition page, "Qualified submission gallery" | Wait for the cards. Toggle "Desktop" and "Phone". Open "How it was checked" on one card and point at "Meets all 3 requirements", the judge line and the fingerprint. | "Every entry is loaded in a real browser on KERNEL, at desktop and phone width. A judge checks each requirement and says why. **[KEY]** Here it's Claude, which sees the screenshots too. I only see screenshots, never the source, until I pay." |
| 6 | 1:28–1:43 | Same page | On the best card, click "Choose this entry", then "Pick it · pay $21.23". Wait for the winner badge and "Get originals". | "I pick this one. PayPal captures the hold." |
| 7 | 1:43–1:55 | Same page | Click "Get originals", then the `.html` file. Open it in a new tab. Point at the fingerprint on the card. | "I get the exact file the agent submitted. Its SHA-256 fingerprint matches the one recorded when it was entered." |
| 8 | 1:55–2:12 | Card status, then the "Settlement" tab, then the PayPal sandbox dashboard | Wait for "Payout of $19.00 …" on the card. Click "Settlement". Cut to the operator's sandbox Activity showing the payout. | "Ninety-five percent, nineteen dollars, goes straight to the agent's operator through PayPal Payouts. The settlement grid shows every payment and payout." |
| 9 | 2:12–2:24 | The pre-recorded void brief | Click "None of these · release my hold" and confirm. Show "Hold released · you paid nothing". | "And if nothing's good enough, I reject them all. PayPal voids the hold, and I pay nothing." |
| 10 | 2:24–2:38 | `/operators` | **[OPERATOR]** Show "PayPal sandbox account connected", the registered agents, and "Allocations and payouts" (AG Grid, with the AG Studio dashboard below). | "Operators connect with PayPal, register agents, and see every allocation and payout in one ledger." |
| 11 | 2:38–2:43 | https://provable.bid | Logo and URL. | "provable.bid: pay for proof, not promises." |

### Calls for shot 4 (agent A; repeat with `PB_TOKEN_B` and `beta.html`)

```sh
API=https://provable-race-api.onrender.com
C='<competition id from the page URL>'
ASSET=$(curl -s -X POST $API/v1/assets -H "Authorization: Bearer $PB_TOKEN_A" -H "Idempotency-Key: a-up-$C" \
  -H 'Content-Type: application/json' \
  -d "{\"competition_id\":\"$C\",\"type\":\"html\",\"mime_type\":\"text/html\",\"content_base64\":\"$(base64 < alpha.html | tr -d '\n')\"}" | jq -r .id)
curl -s -X POST $API/v1/competitions/$C/submissions -H "Authorization: Bearer $PB_TOKEN_A" -H "Idempotency-Key: a-sub-$C" \
  -H 'Content-Type: application/json' -d "{\"title\":\"Crumb & Co. — Alpha\",\"artifacts\":[{\"asset_id\":\"$ASSET\"}]}" | jq '{id, qualification_status}'
```

## Fallbacks

- **No AI key:** the judge is a deterministic keyword check and no house agents run; say so on camera, and don't
  imply the entries were AI-generated. Record the AI judge and house agents once a key is live.
  Keep shots 4–5 and drop the house-agent cut; the judge line on each card reads "keyword check".
- **Payout still pending at shot 8:** show "Payout of $19.00 is pending" and cut to the sandbox dashboard later in
  the edit. Sandbox payouts usually reach SUCCESS in about 10–15 seconds.
- **KERNEL slow:** entries appear as they pass ("Agents are building. Entries appear as they pass."). Cut the wait.
