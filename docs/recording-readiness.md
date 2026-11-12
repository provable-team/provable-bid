# Recording readiness and judging coverage

This checklist is for the final recording, not a statement that the deployment has passed it.

## Record only after these checks pass

- [ ] The deployed commit is identified and its contract/API and web checks pass.
- [ ] Deployments are paused for the recording window, and buyer/operator sessions are fresh after the final deploy. The current free hosting disk may reset state on redeploy; keep each payment proof sequence on one deployment.
- [ ] Live `/v1/config` reports `ai_evaluation`, `house_agents`, and `browser_previews` as true for the preferred AI-enabled cut.
- [ ] A fresh brief produces two distinct actual model-generated house-agent entries that qualify for the gallery. A capability flag alone is not proof.
- [ ] The displayed evaluator label agrees with the verified deployed provider/model. OpenAI must not be labelled as a keyword fallback.
- [ ] The recording brief’s required hours, priced menu, and phone layout are present in the chosen entry.
- [ ] Desktop and phone screenshot previews load, with originals unavailable before purchase.
- [ ] A sandbox buyer has approved an authorization, capture is confirmed, and the matching operator payout item has reached SUCCESS. Keep the competition/payment IDs consistent across shots.
- [ ] A separate rejection brief has a provider-confirmed VOIDED authorization, not merely a “reject requested” banner.
- [ ] The signed-in operator’s AG Grid ledger and licensed AG Studio dashboard render with real allocations. Hide tokens, recipient details, and sandbox login information.
- [ ] Any claimed SDK migration is actually merged and deployed. A planned sponsor integration stays out of the narration.
- [ ] The final read-through and exported video are below 3:00; aim for 2:40–2:45.

If AI remains off, record only honest product/payment B-roll. Do not present that footage as the completed PayPal-plus-AI demo.
Do not fabricate generation, qualification, payment outcomes, provider confirmations, or elapsed time.

## Judging coverage

The [official rubric](https://paypalaihackathon.devpost.com/) has five equally weighted criteria.
This table is an editorial plan, not a prediction of a score.

| Criterion | Visible proof in the video |
| --- | --- |
| Technological implementation | Actual AI generation and evaluation; PayPal authorization, capture, payout and void with confirmed states. |
| Design | One coherent brief → gallery → choice → download → settlement journey, including phone previews. |
| Potential impact | A specific small-business buyer and agent-builder workflow; no invented customers, traction or savings. |
| Innovation | Compare completed sites and connect the selected result to payment; avoid “first ever” claims. |
| Presentation | Clear audience/problem, a consistent example, legible proof, and an under-three-minute finish. |

The [AG Grid sponsor guidance](https://paypalaihackathon.devpost.com/details/aggrid) favors Studio polish and agent features.
Show the working allocation dashboard and its purpose; do not claim an unimplemented Studio agent.
Put secondary sponsor implementation details in the written submission so the main video remains understandable.

## Submission checks after the video is ready

- [ ] Public, licensed repository link points to the final reviewed build; visibility and `main` changes require Yosun’s approval.
- [ ] Publicly visible YouTube URL is added to the entry, with no placeholders remaining.
- [ ] Write-up names the actual AI provider/model and only the sponsor integrations that shipped.
- [ ] The hosted demo or complete setup instructions let judges reproduce the described functionality.
- [ ] Submission and demo remain explicitly PayPal sandbox, with known limitations stated.
- [ ] Any journal/restart-recovery claim is scoped to retained storage; do not imply the current free deployment keeps its database across redeploys.

Source: [official rules](https://paypalaihackathon.devpost.com/rules). The deadline shown there is November 12, 2026 at noon Pacific.
