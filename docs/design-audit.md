# Web design audit (accessibility and basics)

Scope: `apps/web` on branch `shiwani/design-pass`, run locally against the API with the fake payment
provider (heuristic judge, no AI). Checklist: Vercel's Web Interface Guidelines
(vercel.com/design/guidelines, read as reference text only) plus WCAG 2.2 AA.

Screens checked: home, `/briefs/new`, competition page with a 3-entry qualified gallery, the pick
dialog, the reject dialog, a decided competition (winner card and Settlement tab), and `/operators`
with a signed-in operator who has an allocation. Each at 375, 768, 1024 and 1440 px, with the
browser in light and dark color schemes.

How it was checked: headless Chrome via `playwright-core`; computed-style contrast for every text
node against its composited background; bounding boxes for every focusable control; keyboard runs
through the brief form and both decision dialogs (Tab order, Escape, focus trap, focus return);
`document.documentElement.scrollWidth - clientWidth` on every screen and width.

Line numbers refer to this branch. "Fixed" names the commit subject on this branch.

## Findings

| # | Issue | Where | Severity | Status |
|---|-------|-------|----------|--------|
| 1 | Muted text `#707168` is 4.3:1 on the bid card, notices and payment-status boxes (4.5:1 needed); it is the most-used text color. Several hard-coded grays on the home page, sidebar terms label (2.9:1), operator agent meta (3.0:1) and brief summary footnotes were also under 4.5:1. | `app/globals.css:6`, `:1111`, `:1122`, `:1185`; `components/marketplace.module.css` (13 rules); `app/briefs/new/brief-form.module.css` (`.version`, `.footerNote`) | High | Fixed: "muted text and small gray labels meet WCAG AA contrast". `--muted` is now `#66675e` (4.9:1 or better on every surface). |
| 2 | Pick/reject and connection dialogs had no accessible name; screen readers announce an unnamed dialog before a payment decision. | `app/competitions/[id]/page.tsx:1035`, `components/site-chrome.tsx:58` | High | Fixed: "give the pick/reject and connection dialogs accessible names" (`aria-labelledby` to the heading, `aria-describedby` to the summary). |
| 3 | Desktop/Phone preview toggle: the pill clips overflow, so the 4px-offset focus ring showed as a 2px sliver. Keyboard focus was effectively invisible. | `app/globals.css:1734` | High | Fixed: "visible keyboard focus on the Desktop/Phone preview toggle" (ring drawn inset). |
| 4 | Brief form focus ring `#a0aa6b` is 2.3:1 on paper (3:1 needed for focus indicators) and differs from the site ring. The price field's ring sat inside its `$ … USD` box. | `app/briefs/new/brief-form.module.css:117-129` | Medium | Fixed: "brief form focus ring uses the site focus color". |
| 5 | Brief form fields' accessible names include the helper text (and for selects, the option list), e.g. "Price per website you pick $ USD From $10. Pick more…". | `app/briefs/new/page.tsx:339-500` | Medium | Fixed: "brief form fields have clean names with their hints as descriptions" (`aria-labelledby` + `aria-describedby`; no visual change). |
| 6 | Form fields are 13px on phones; iOS Safari zooms the page on focus. | `app/globals.css` `.field input` (600px block); brief form `.section .field` | Medium | Fixed: "16px form fields on phones so iOS doesn't zoom on focus". Visible on phones; see "Look changes" below. |
| 7 | Hit areas under 24px (WCAG 2.5.8): "Connection settings" 82x11, back links 18px tall, "None of these · release my hold" 18px, "+ Add a requirement" 21px, home text links 16-19px. | `app/globals.css:278-300`, `components/marketplace.module.css:222`, `brief-form.module.css` `.textButton` | Medium | Fixed: "24px minimum hit areas for the small text controls" (invisible `::after` hit area). |
| 8 | `/operators`: when AG Studio renders (dev, or with `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` set) its 600px-minimum canvas scrolls the whole page sideways by 268px at 375px. | `components/operator-studio-canvas.tsx:86` | Medium (none in a prod build without the key) | Fixed: "operators page clears the header; allocation dashboard can't widen phones". |
| 9 | `/operators`: the eyebrow sits flush against the header rule; the page had no top padding. | `app/globals.css:1785` | Low | Fixed (same commit). |
| 10 | `aria-label` on plain `div`s is ignored: competition view switcher, agent avatar stack, home hero visual. | `app/competitions/[id]/page.tsx:497`, `:561`; `app/page.tsx:67` | Low | Fixed: "labelled groups get a role; hide the decorative eyebrow slash". |
| 11 | No `theme-color`; `color-scheme` only in CSS. | `app/layout.tsx:21` | Low | Fixed: "theme-color and color-scheme meta match the light paper theme". |
| 12 | Dialog scroll chains to the page behind it. | `app/globals.css:420` | Low | Fixed (`overscroll-behavior: contain`, in the dialog-name commit). |
| 13 | Text is very small: 7-9px for the mode banner, sidebar labels, deadline labels, terms label, agent stack caption and brief tags on phones (5-6 elements at 7px on the competition page at 375px). Contrast now passes, but this is below comfortable reading size. | `app/globals.css` (600px block, e.g. `:1430`, `:1495`, `:1508`, `:1528`) | Medium | Not fixed: it's Yosun's type scale. Suggest a 10px floor on phones (11px for anything about money or deadlines). |
| 14 | Entry ordinals ("01", `#a6aa9d`, 2.3:1) and the home feature/agent numbers (2.6-3.7:1) are below 4.5:1. | `app/globals.css:778`; `marketplace.module.css` `.agentNumber`, `.featureStrip b` | Low | Partly fixed: the gallery ordinal is now `aria-hidden` and pads correctly past 9. Colors left as decorative; Yosun's call. |
| 15 | Brief form pre-disables "Create brief & continue" until the terms box is ticked, with no hint why; on a validation error, focus stays on the button and the error appears at the top of the page, far from the field. | `app/briefs/new/page.tsx:185-200`, `:606` | Medium | Not fixed: behaviour change in the payment flow during the demo freeze. Suggest keeping submit enabled, then focusing the first invalid field or the terms checkbox with an inline message. |
| 16 | Each sandboxed preview iframe is a tab stop, and its links (e.g. "Pre-order now") are reachable by Tab, so keyboard users pass through every entry's page on the way to "Choose this entry". | `components/asset-preview.tsx:99` | Low | Not fixed: making the iframe unfocusable also stops keyboard scrolling inside the preview. Worth a decision. |
| 17 | The loading skeleton for a preview has `aria-label` without a role, so nothing is announced. | `components/asset-preview.tsx:89` | Low | Not fixed. |
| 18 | No dark theme. The site declares `color-scheme: light`, so OS dark mode leaves it unchanged (dark-scheme screenshots match light). This is consistent rather than broken. | `app/globals.css:12` | Info | Not changed: a dark theme would be a redesign. |

## Checked and fine

- Native `<dialog>` with `showModal()`: focus moves into the dialog (close button first), Tab stays
  in the dialog (and the browser chrome), Escape closes it, and focus returns to "Choose this entry" /
  "None of these" on close.
- Visible `:focus-visible` ring (`#657b19`, 4.4:1 on paper) on links, buttons, inputs and summaries.
- Skip link; one `h1` per page; preview iframes have titles; screenshot previews have alt text;
  icons are `aria-hidden`; icon-only buttons have labels.
- `prefers-reduced-motion` turns off animation and transitions site-wide (new dialog motion is also
  wrapped in `no-preference`).
- `touch-action: manipulation` and tap-highlight styling on controls.
- Brief form Tab order follows the visual order: example, title, brief, requirement(s), add requirement,
  price, submission window, decision window, terms, submit.
- No sideways scroll on any checked screen at 375/768/1024/1440, before or after (production build).

## Polish (separate commits, after the fixes)

Kept to the existing typography, colors and layout:

- Ledger grids (settlement and operator allocations): right-aligned tabular amounts; narrower amount
  and status columns so titles and IDs truncate less, with headers wrapping rather than truncating;
  full value on hover for truncated cells;
  sentence-case ledger states; failed/blocked/reversed in the existing error tone; pagination only
  past 10 rows; the ~110px empty band under a single row removed.
- Operator page: "New token" aligned to the end of each agent row; spacing around the dashboard note
  and the "Register an agent" heading.
- Gallery cards: "How it was checked" `+` rotates to `x` while open; tabular prices; arrow nudge on
  hover of "Choose this entry".
- Dialogs fade and rise in (200ms); buttons have a pressed state; the Desktop/Phone toggle eases
  between states.

## Look changes Yosun should approve or reject

1. `--muted` darkens from `#707168` to `#66675e` (finding 1). It's slight but site-wide.
2. Form fields are 16px on phones (finding 6), up from 13px.
3. `/operators` gains about 38px of top padding (finding 9).
4. Ledger states read "Allocated", "Held" instead of "allocated", "held"; failed/blocked statuses turn
   rust red.
5. The dialog entrance animation and the button pressed state.
