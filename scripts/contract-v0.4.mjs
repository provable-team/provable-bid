// One-off migration of contracts/openapi.yaml from v0.3.0 to v0.4.0 (finished-website race).
// Kept in the repo so every contract change is reviewable in one place. Run: node scripts/contract-v0.4.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

const file = new URL('../contracts/openapi.yaml', import.meta.url);
const doc = parseDocument(readFileSync(file, 'utf8'));
const get = (path) => doc.getIn(path);
const set = (path, value) => doc.setIn(path, doc.createNode(value));
const del = (path) => doc.deleteIn(path);
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const problems = Object.fromEntries(['400', '401', '403', '404', '409', '422', '429', '503', 'default']
  .map((code) => [code, { $ref: '#/components/responses/Problem' }]));
const json = (description, schema, extraHeaders = {}) => ({
  description,
  headers: { 'X-Request-Id': { $ref: '#/components/headers/RequestId' }, ...extraHeaders },
  content: { 'application/json': { schema } },
});
const redirect = (description) => ({
  description,
  headers: { 'X-Request-Id': { $ref: '#/components/headers/RequestId' }, Location: { schema: { type: 'string', format: 'uri' } } },
});

// ---------------------------------------------------------------- info
set(['info', 'version'], '0.4.0');
set(['info', 'summary'], 'Agents race to submit finished single-page websites; buyers pay only for what they pick.');
set(['info', 'description'], [
  'v0.4.0: finished-website race. See CONTRACT-CHANGES.md for the changes from v0.3.0.',
  'A buyer posts a web page brief with a price (minimum $10.00) and a submission window. PayPal authorizes',
  'price + a disclosed processing fee; nothing is captured yet. Registered agents (outside agents and labelled',
  'house agents, all on this same API) submit one finished single-page HTML document each. Automated checks plus',
  'an evaluator decide qualification per requirement; only qualified work reaches the buyer. Selecting a winner',
  'captures the authorization in full; extra entries are separate full-price CAPTURE checkouts. Rejecting all,',
  'missing the decision deadline, or no qualifiers voids the authorization: the buyer pays nothing. Each',
  'completed purchase pays the winning agent operator by PayPal Payouts (price minus commission).',
  'USD only. Money uses integer minor units (cents). Timestamps are UTC RFC3339 ending Z.',
  'IDs are opaque and stable. Backend deadlines are authoritative and exclusive (now < deadline).',
  'Mutations require Idempotency-Key except verified webhooks, deduped by provider event ID. Same principal +',
  'method + path + key + canonical JSON replays the original status/body; a different payload returns 409.',
  'Every provider call reuses the PayPal-Request-Id persisted with its operation, so retries never create a',
  'second order, capture, void or payout. Never retry an unknown provider outcome with a fresh request ID.',
  'HTML originals are private; buyers see sandboxed, watermarked previews of qualified work only.',
  'POST /__mock/* exists only when the server runs with the fake payment provider; never in sandbox/production.',
  'Pagination uses opaque cursors in stable (created_at,id) order. Errors use application/problem+json.',
  'Every response includes X-Request-Id.',
].join('\n'));
set(['servers'], [
  { url: 'http://127.0.0.1:4010', description: 'Local API (fake or sandbox provider).' },
]);

// ---------------------------------------------------------------- tags
set(['tags'], [
  { name: 'System', description: 'Configuration and health.' },
  { name: 'Identity', description: 'Buyer sessions, operator onboarding (Log in with PayPal) and agent credentials.' },
  { name: 'Competitions', description: 'Briefs, deadlines, and buyer decisions.' },
  { name: 'Submissions', description: 'Immutable finished websites and qualification.' },
  { name: 'Payments', description: 'Authorization, capture, purchases, refunds, and delivery.' },
  { name: 'Settlement', description: 'Allocations and real PayPal Payouts to agent operators.' },
  { name: 'Webhooks', description: 'Verified provider notifications.' },
  { name: 'Mock', description: 'Fake-provider development controls; absent from sandbox/production.' },
  { name: 'Assets', description: 'Agent-owned immutable private originals and server-generated watermarked previews.' },
  { name: 'Agents', description: 'Public agent profiles (outside and house agents).' },
]);

// ---------------------------------------------------------------- schemas
const S = ['components', 'schemas'];
set([...S, 'Policy'], {
  type: 'object', additionalProperties: false,
  required: ['terms_version', 'commission_bps', 'processing_fee_bps', 'processing_fee_fixed_minor', 'payout_fee_minor', 'qualification_grace_seconds'],
  properties: {
    terms_version: { type: 'string' },
    commission_bps: { type: 'integer', minimum: 0, maximum: 10000, description: 'Platform commission taken from each purchase price before the agent payout (500 = 5%).' },
    processing_fee_bps: { type: 'integer', minimum: 0, maximum: 10000, description: 'PayPal checkout rate passed to the buyer, applied as a gross-up so the platform receives at least the price.' },
    processing_fee_fixed_minor: { type: 'integer', minimum: 0, maximum: 1000, description: 'Fixed part of the PayPal checkout fee passed to the buyer.' },
    payout_fee_minor: { type: 'integer', minimum: 0, maximum: 1000, description: 'PayPal Payouts fee per payout, paid by the platform from its commission.' },
    qualification_grace_seconds: { type: 'integer', const: 120 },
  },
});
set([...S, 'Config', 'properties', 'mode', 'enum'], ['mock', 'paypal_sandbox']);
set([...S, 'Config', 'properties', 'capabilities'], {
  type: 'object', additionalProperties: false,
  required: ['authorization', 'additional_checkout', 'external_agents', 'payouts', 'ai_evaluation', 'house_agents', 'operator_onboarding', 'browser_previews', 'operator_assistant'],
  properties: {
    authorization: { type: 'boolean' },
    additional_checkout: { type: 'boolean' },
    external_agents: { type: 'boolean' },
    payouts: { type: 'string', enum: ['simulated', 'paypal_sandbox', 'disabled'], description: 'simulated only with the fake provider.' },
    ai_evaluation: { type: 'boolean', description: 'False means requirements are judged by the deterministic fallback evaluator.' },
    house_agents: { type: 'boolean', description: 'Labelled house agents are active and enter every competition.' },
    operator_onboarding: { type: 'string', enum: ['paypal_login', 'disabled'] },
    browser_previews: { type: 'boolean', description: 'Entries are rendered in a real browser (KERNEL): screenshot-only previews, measured checks for the judge, and a browser_check summary on each rendered submission.' },
    operator_assistant: { type: 'boolean', description: 'POST /v1/operators/me/assistant is enabled (Claude + PayPal Agent Toolkit; needs an Anthropic key and the PayPal provider).' },
  },
});
set([...S, 'BidMoney', 'properties', 'amount_minor'], { type: 'integer', minimum: 1000, maximum: 500000, description: 'Price per selected entry, $10.00 to $5,000.00.' });
set([...S, 'CreateCompetition', 'properties', 'submission_window_seconds'], { type: 'integer', enum: [300, 900, 3600], description: '5, 15 or 60 minutes.' });
set([...S, 'CreateCompetition', 'properties', 'requirements', 'description'], 'IDs must be unique. Each is a checkable statement about the page, e.g. "Has a pricing section with three tiers". Frozen at creation.');
const compProps = [...S, 'Competition', 'properties'];
set([...compProps, 'processing_fee'], { ...ref('Money'), description: 'Disclosed PayPal processing fee added to each checkout; covers PayPal\'s fee, never refunded by PayPal.' });
set([...compProps, 'total'], { ...ref('Money'), description: 'bid + processing_fee: the amount PayPal authorizes, and the amount of each extra-entry checkout.' });
set([...S, 'Competition', 'required'], [...get([...S, 'Competition', 'required']).toJSON(), 'processing_fee', 'total']);
set([...compProps, 'outcome'], {
  type: 'string',
  enum: ['undecided', 'winner_selected', 'rejected', 'no_decision', 'no_qualifiers', 'infrastructure_failure', 'cancelled'],
  description: 'rejected, no_decision (decision deadline passed) and no_qualifiers void the authorization: the buyer pays nothing.',
});
set([...S, 'BuildProgress'], {
  type: 'object', additionalProperties: false, required: ['agent_id', 'step', 'label', 'state', 'colors', 'blocks', 'current_block', 'accent', 'attempt', 'max_attempts', 'missed_requirement_ids', 'updated_at'],
  description: 'Latest coarse build step of one house agent (internal: true) in this competition, derived from the structure of its streamed page. Never contains generated text, markup, class names, attributes or CSS; the only design information is the page\'s block structure (kinds and small counts) and hex colours.',
  properties: {
    agent_id: ref('Id'),
    step: { type: 'integer', minimum: 0, description: 'Increases by one with every change of label or state.' },
    label: { type: 'string', minLength: 1, maxLength: 48, pattern: "^[a-z0-9 '-]+$", description: 'Plain words, e.g. "writing the hero", "adding opening hours", "checking the page", "submitted". Topic words come only from the buyer\'s own requirements.' },
    state: { type: 'string', enum: ['building', 'submitted', 'revising', 'qualified', 'not_qualified'], description: 'building: still working. submitted: entered, being checked. revising: its last attempt failed and it is building a revised page (attempt is the new one). qualified / not_qualified: the check finished and the agent is done. An agent that fails before ever submitting is removed from the list.' },
    attempt: { type: 'integer', minimum: 1, maximum: 3, description: 'The attempt being built or checked (1 = first entry).' },
    max_attempts: { type: 'integer', const: 3 },
    missed_requirement_ids: {
      type: 'array', maxItems: 20, items: ref('Id'),
      description: 'IDs of the buyer\'s requirements the latest failed attempt did not meet (from the buyer\'s own brief; show the requirement text). Never the judge\'s reasons. Empty when nothing has failed or a page failed the automatic gates.',
    },
    colors: {
      type: 'array', maxItems: 3, uniqueItems: true, items: { type: 'string', pattern: '^#[0-9a-f]{6}$' },
      description: 'Up to 3 colours the agent\'s page is using so far: the first distinct hex values in its background, color, border and custom-property declarations, normalized to #rrggbb, near-white and near-black dropped. Design information shown before qualification. Empty until one is found (clients fall back to the agent\'s avatar_color).',
    },
    blocks: {
      type: 'array', maxItems: 12,
      description: 'The page\'s top-level blocks so far, in order, read from the structure of the streamed HTML. Kinds and small integers only.',
      items: {
        type: 'object', additionalProperties: false, required: ['kind'],
        properties: {
          kind: { type: 'string', enum: ['nav', 'hero', 'section', 'form', 'faq', 'table', 'footer'] },
          columns: { type: 'integer', minimum: 1, maximum: 4, description: 'section: repeated direct children such as cards.' },
          items: { type: 'integer', minimum: 1, maximum: 12, description: 'faq: questions; form: fields; table: rows.' },
          fill: { type: 'string', pattern: '^#[0-9a-f]{6}$', description: 'Background colour the CSS gives this block (header/.hero, nav, footer), when it can be determined.' },
        },
      },
    },
    current_block: { type: ['integer', 'null'], minimum: 0, maximum: 11, description: 'Index of the block being written: the last one opened but not yet closed, else the newest. Null before the first block.' },
    accent: { type: ['string', 'null'], pattern: '^#[0-9a-f]{6}$', description: 'Button background colour (button, .btn, .cta) when the CSS sets one.' },
    updated_at: ref('Timestamp'),
  },
});
set([...compProps, 'build_progress'], {
  type: 'array', maxItems: 16, items: ref('BuildProgress'),
  description: 'Only in GET /v1/competitions/{competition_id} for the buyer who owns the competition: live build steps of the house agents for this run (kept in memory; empty after a restart). Absent for everyone else.',
});

const html = { type: 'string', enum: ['html'] };
const htmlMime = { type: 'string', enum: ['text/html'] };
for (const name of ['Artifact', 'Asset']) {
  set([...S, name, 'properties', 'type'], html);
  set([...S, name, 'properties', 'mime_type'], htmlMime);
  set([...S, name, 'properties', 'size_bytes'], { type: 'integer', minimum: 1, maximum: 524288 });
  set([...S, name, 'properties', 'width'], { type: 'null' });
  set([...S, name, 'properties', 'height'], { type: 'null' });
}
set([...S, 'UploadAsset', 'properties', 'type'], html);
set([...S, 'UploadAsset', 'properties', 'mime_type'], htmlMime);
set([...S, 'UploadAsset', 'properties', 'content_base64'], {
  type: 'string', minLength: 4, maxLength: 699052,
  pattern: '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',
  description: 'Canonical base64 of one UTF-8 HTML document, max 512 KiB decoded. It must be self-contained: inline CSS/JS and data: or https: images; it may not fetch, submit forms or navigate.',
});
set([...S, 'Preview'], {
  type: 'object', additionalProperties: false, required: ['url', 'phone_url', 'mime_type', 'width', 'height', 'text_excerpt'],
  properties: {
    url: { type: 'string', format: 'uri', description: 'Authenticated preview endpoint (desktop). image/jpeg: a screenshot taken in a real browser (KERNEL); the page markup never reaches the client before purchase. text/html (fallback when no browser renderer is configured): a watermarked derivative that still contains the markup; render it in a sandboxed iframe without allow-same-origin.' },
    phone_url: { type: ['string', 'null'], format: 'uri', description: 'Screenshot at 390px wide (same endpoint with ?view=phone); null for HTML previews.' },
    mime_type: { type: 'string', enum: ['image/jpeg', 'text/html'] },
    width: { type: ['integer', 'null'], minimum: 1, description: 'Desktop screenshot width (1280); null for HTML previews.' },
    height: { type: ['integer', 'null'], minimum: 1, description: 'Desktop screenshot height (full page, capped at 2400); null for HTML previews.' },
    text_excerpt: { type: ['string', 'null'], maxLength: 160, description: 'The page <title>, if any.' },
  },
});
set([...S, 'Preview', 'properties', 'phone_url', 'description'], 'Screenshot on an emulated 390px phone (touch, device pixel ratio 3, <meta viewport> honoured), same endpoint with ?view=phone: what the phone shows on first load. 390px wide, or wider when the page does not fit and the phone zooms out; display it at phone width. Null for HTML previews.');
const count = (description) => ({ type: 'integer', minimum: 0, maximum: 20, description });
const orNull = (schema) => ({ ...schema, type: [schema.type, 'null'] });
set([...S, 'BrowserCheck'], {
  type: 'object', additionalProperties: false,
  required: ['phone_fits', 'phone_overflow_px', 'phone_layout_width', 'console_errors', 'blocked_requests', 'focus_stops', 'focus_visible', 'focus_complete', 'load_ms', 'render_ms', 'replay_url', 'replay_expires_at'],
  description: 'What a real browser (KERNEL) measured when it loaded the entry. Counts and widths only: never page text, console messages or request URLs.',
  properties: {
    phone_fits: { type: 'boolean', description: 'true when the page fits an emulated 390px phone: phone_overflow_px is at most 1.' },
    phone_overflow_px: { type: 'integer', minimum: 0, description: 'CSS px the page is wider than the 390px phone: content that scrolls sideways, or a layout the phone has to zoom out (no viewport meta tag). Measured without a scrollbar, so 100vw is not overflow.' },
    phone_layout_width: orNull({ type: 'integer', minimum: 1, description: 'Layout width on the phone in CSS px: 390 when the page sets a phone viewport; 980 means no viewport meta tag. Null for entries checked before this was measured.' }),
    console_errors: count('Distinct console errors and uncaught exceptions while loading (counted up to 20).'),
    blocked_requests: count('Distinct outbound requests blocked while rendering: fetch/XHR, scripts, frames, navigation (counted up to 20).'),
    focus_stops: orNull(count('Elements reached by pressing Tab (up to 20); null when the focus check did not run.')),
    focus_visible: orNull(count('Of focus_stops, how many showed a visible focus indicator.')),
    focus_complete: { type: ['boolean', 'null'], description: 'true when Tab went through every focusable element; false at the 20-press cap.' },
    load_ms: { type: ['integer', 'null'], minimum: 0, description: 'Navigation start to the load event (HTML, images, fonts) at desktop size, in ms.' },
    render_ms: { type: ['integer', 'null'], minimum: 0, description: 'The whole check in the cloud browser (start to last measurement), in ms.' },
    replay_url: { type: ['string', 'null'], format: 'uri', description: 'KERNEL video replay of the check, when replays are enabled; null once KERNEL no longer keeps it (about a day).' },
    replay_expires_at: { oneOf: [ref('Timestamp'), { type: 'null' }], description: 'When replay_url stops being offered.' },
  },
});
set([...S, 'Submission', 'properties', 'browser_check'], { ...ref('BrowserCheck'), description: 'Present once the entry was rendered in a real browser (KERNEL).' });
set([...S, 'Submission', 'properties', 'artifacts', 'maxItems'], 1);
set([...S, 'SubmitWork', 'properties', 'artifacts', 'maxItems'], 1);
set([...S, 'QualificationResult', 'properties', 'artifact_hashes', 'maxItems'], 1);
const narrativeLine = (maxLength) => ({ type: 'string', minLength: 1, maxLength });
set([...S, 'QualificationResult', 'properties', 'narrative'], {
  type: 'object', additionalProperties: false, required: ['overall_verdict', 'strengths', 'weaknesses'],
  description: 'Advisory notes from the AI judge to help the buyer choose: how well this page serves this brief, grounded in what the judge saw (page, screenshots, browser measurements). Plain text; no scores and no ranking across entries; the buyer makes the choice. Only on qualified submissions, only for the buyer who owns the competition (and admins). Absent from the keyword-check fallback, from failed/error results and from agent reads.',
  properties: {
    overall_verdict: { ...narrativeLine(400), description: 'One or two sentences on how well the page serves this brief and this buyer.' },
    strengths: { type: 'array', maxItems: 3, items: narrativeLine(140) },
    weaknesses: { type: 'array', maxItems: 3, items: narrativeLine(140), description: 'Real weaknesses the judge saw; may be empty.' },
    best_for: { ...narrativeLine(120), description: 'Optional: the kind of buyer preference this page suits, e.g. "best if you want a bold, conversion-focused page".' },
  },
});
set([...S, 'Payment', 'properties', 'purpose'], { type: 'string', enum: ['initial', 'first_purchase', 'additional_purchase'], description: 'initial changes to first_purchase when the winner is selected.' });
set([...S, 'Payment', 'properties', 'amount', 'description'], 'Authorized/checkout amount: price + processing fee.');
set([...S, 'Allocation', 'properties', 'kind'], { type: 'string', enum: ['winner'] });
set([...S, 'Allocation', 'properties', 'payout_state'], {
  type: 'string', enum: ['simulated', 'not_scheduled', 'queued', 'pending', 'paid', 'failed', 'blocked', 'returned', 'refunded', 'reversed'],
  description: [
    'paid = PayPal Payouts item SUCCESS. pending includes UNCLAIMED and ONHOLD (money in flight). blocked = held here by a',
    'refund/dispute/reversal on the buyer payment. Final PayPal outcomes after sending: returned = RETURNED (unclaimed for',
    '30 days, or cancelled; the money came back to provable.bid), refunded = REFUNDED (the recipient sent it back),',
    'reversed = REVERSED. failed = FAILED, BLOCKED or DENIED by PayPal, or never sent; payout_detail says which.',
  ].join(' '),
});
set([...S, 'Allocation', 'properties', 'payout_detail'], {
  type: ['string', 'null'], maxLength: 300,
  description: 'Why the payout is not (or no longer) paid, in PayPal\'s words when PayPal gave one: e.g. "BLOCKED: …", "RETURNED". Null when paid or in progress without remarks. May be absent on allocations recorded before this field existed.',
});
set([...S, 'Allocation', 'properties', 'recipient_id', 'description'], 'Private payout-recipient ID bound to the operator\'s PayPal account verified by Log in with PayPal. Never a raw PayPal identifier.');
set([...S, 'Allocation', 'properties', 'agent_shares', 'description'], 'Per-agent attribution; exactly one winner share that sums to allocation.amount.');
set([...S, 'Agent', 'properties', 'internal'], { type: 'boolean', description: 'true = house agent run by provable.bid (labelled in every UI). false = outside agent.' });
set([...S, 'Agent', 'properties', 'capabilities'], { type: 'array', items: html, minItems: 1, maxItems: 1, uniqueItems: true });
set([...S, 'Agent', 'properties', 'operator_name', 'description'], 'Public owning operator. House agents belong to provable.bid.');
for (const name of ['AgentRun', 'AgentRunPage', 'StartAgentRuns']) del([...S, name]);
set([...S, 'Problem', 'properties', 'code', 'enum'], [...get([...S, 'Problem', 'properties', 'code', 'enum']).toJSON(), 'OPERATOR_REQUIRED']);

set([...S, 'BuyerSession'], {
  type: 'object', additionalProperties: false, required: ['buyer_id', 'token', 'server_time'],
  properties: { buyer_id: ref('Id'), token: { type: 'string', minLength: 20, description: 'Bearer credential. Shown once; store it client-side.' }, server_time: ref('Timestamp') },
});
set([...S, 'Operator'], {
  type: 'object', additionalProperties: false, required: ['id', 'name', 'paypal_account_verified', 'agents', 'server_time'],
  properties: {
    id: ref('Id'), name: { type: 'string', maxLength: 100 },
    paypal_account_verified: { type: 'boolean', description: 'PayPal confirmed the account through Log in with PayPal; payouts go to it.' },
    agents: { type: 'array', items: ref('OperatorAgent') },
    server_time: ref('Timestamp'),
  },
});
set([...S, 'OperatorAgent'], {
  type: 'object', additionalProperties: false, required: ['agent', 'webhook_url', 'submissions', 'wins', 'paid_minor'],
  properties: {
    agent: ref('Agent'), webhook_url: { type: ['string', 'null'], format: 'uri' },
    submissions: { type: 'integer', minimum: 0 }, wins: { type: 'integer', minimum: 0 }, paid_minor: { type: 'integer', minimum: 0 },
  },
});
set([...S, 'RegisterAgent'], {
  type: 'object', additionalProperties: false, required: ['name', 'description', 'style'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 80 }, description: { type: 'string', maxLength: 500 }, style: { type: 'string', maxLength: 200 },
    avatar_color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    webhook_url: { type: ['string', 'null'], format: 'uri', description: 'https URL that receives competition.opened notifications (see webhooks).' },
  },
});
set([...S, 'AgentCredential'], {
  type: 'object', additionalProperties: false, required: ['agent', 'token', 'webhook_secret', 'server_time'],
  properties: {
    agent: ref('Agent'), token: { type: 'string', minLength: 20, description: 'Agent bearer credential. Shown once; stored hashed.' },
    webhook_secret: { type: ['string', 'null'], description: 'HMAC-SHA256 key for X-Provable-Signature on notifications. Shown once.' },
    server_time: ref('Timestamp'),
  },
});
set([...S, 'AgentNotification'], {
  type: 'object', additionalProperties: false, required: ['id', 'type', 'competition', 'sent_at'],
  properties: { id: ref('Id'), type: { type: 'string', enum: ['competition.opened'] }, competition: ref('Competition'), sent_at: ref('Timestamp') },
});

set([...S, 'AssistantQuestion'], {
  type: 'object', additionalProperties: false, required: ['question'],
  properties: { question: { type: 'string', minLength: 1, maxLength: 500, description: 'A question about the operator\'s own earnings, payments or payouts.' } },
});
set([...S, 'AssistantLookup'], {
  type: 'object', additionalProperties: false, required: ['tool', 'source', 'ref', 'status', 'summary'],
  description: 'One lookup the assistant made while answering, in order.',
  properties: {
    tool: { type: 'string', enum: ['my_allocations', 'get_order', 'list_transactions', 'list_disputes', 'get_refund', 'get_payout'] },
    source: { type: 'string', enum: ['ledger', 'paypal_agent_toolkit', 'paypal_payouts'], description: 'ledger: the operator\'s allocations here. paypal_agent_toolkit: a read-only PayPal Agent Toolkit tool. paypal_payouts: PayPal Payouts.' },
    ref: { type: ['string', 'null'], maxLength: 64, description: 'The PayPal order, capture, refund or payout batch ID looked up, when there is one.' },
    status: { type: 'string', enum: ['ok', 'refused', 'error'], description: 'refused: the ID is not one of this operator\'s references, so PayPal was not called.' },
    summary: { type: 'string', maxLength: 300 },
  },
});
set([...S, 'AssistantAnswer'], {
  type: 'object', additionalProperties: false, required: ['answer', 'lookups', 'server_time'],
  properties: {
    answer: { type: 'string', maxLength: 4000, description: 'Plain text.' },
    lookups: { type: 'array', maxItems: 20, items: ref('AssistantLookup') },
    server_time: ref('Timestamp'),
  },
});

// ---------------------------------------------------------------- responses / request bodies / params
const R = ['components', 'responses'];
set([...R, 'Settlement', 'description'], 'Allocations and the state of each real payout.');
set([...R, 'Settlement', 'content', 'application/json', 'schema', 'properties', 'payout_mode'], { type: 'string', enum: ['simulated', 'paypal_sandbox', 'disabled'] });
set([...R, 'Settlement', 'content', 'application/json', 'schema', 'properties', 'accounting', 'description'], 'Capture economics per completed payment: gross, commission, PayPal\'s confirmed fee when known, and the agent payout amount.');
set([...R, 'DeliveryAccess', 'content', 'application/json', 'schema', 'properties', 'artifacts', 'items', 'properties', 'mime_type'], htmlMime);
del([...R, 'AgentRunPage']);
del(['components', 'requestBodies', 'StartAgentRuns']);
del(['components', 'requestBodies', 'Qualification']);

// ---------------------------------------------------------------- paths
const P = (path) => ['paths', path];
del(P('/v1/competitions/{competition_id}/agent-runs'));
del(P('/__mock/submissions/{submission_id}/qualification'));
// Delivery downloads become a real route.
const delivery = get(P('/__mock/deliveries/{token}')).toJSON();
delivery.get.operationId = 'downloadDelivery';
delivery.get.tags = ['Payments'];
delivery.get.responses['200'].content = { 'text/html': { schema: { type: 'string' } } };
del(P('/__mock/deliveries/{token}'));
set(P('/v1/deliveries/{token}'), delivery);

set([...P('/v1/competitions'), 'post', 'description'], 'Buyer only. Web page brief: title, brief, price (bid), 5/15/60 minute submission window, decision window, 1–10 checkable requirements. Immutable after creation. accepted_terms_version must equal config.terms_version or returns 422.');
set([...P('/v1/competitions/{competition_id}/checkout'), 'post', 'description'], 'Buyer owner only, draft/awaiting_authorization only. Creates (or returns) the one PayPal AUTHORIZE order for price + processing fee. The PayPal-Request-Id is persisted before the provider call, so a retried or concurrent command returns the same order and never creates a second one. After known checkout expiry, a new command key requests a replacement order on the same payment, only after reconciliation proves the old order was never authorized.');
set([...P('/v1/competitions/{competition_id}/authorize'), 'post', 'description'], 'Buyer owner only, after approving the PayPal order. The server reads the order from PayPal, authorizes it, records the authorization ID/expiry, and opens the competition. Agents are notified (webhooks) once open.');
set([...P('/v1/competitions/{competition_id}/selection'), 'post', 'description'], 'Buyer owner only; any qualified entry, while open/qualifying/deciding and before the decision deadline. Commits the winner and queues a full capture of the authorization (final_capture). Delivery unlocks after PayPal confirms the capture; the agent payout is queued after that.');
set([...P('/v1/competitions/{competition_id}/rejection'), 'post', 'description'], 'Buyer owner only; no first selection yet, before the decision deadline. Rejects all entries and voids the authorization: the buyer pays nothing. Missing the decision deadline, or no qualifiers, has the same effect automatically.');

set(P('/v1/buyer-sessions'), { post: {
  operationId: 'createBuyerSession', tags: ['Identity'], summary: 'Start an anonymous buyer session',
  description: 'Public. Returns a buyer bearer credential the frontend keeps in local storage. PayPal identifies the paying person at checkout.',
  security: [], parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
  responses: { '201': json('New buyer session.', ref('BuyerSession')), ...problems },
} });
set(P('/v1/operators/connect'), { get: {
  operationId: 'connectOperator', tags: ['Identity'], summary: 'Start Log in with PayPal for an agent operator',
  description: 'Public browser navigation. Redirects to PayPal; PayPal returns to /v1/operators/connect/callback.',
  security: [], responses: { '302': redirect('Redirect to PayPal login.'), ...problems },
} });
set(P('/v1/operators/connect/callback'), { get: {
  operationId: 'operatorConnectCallback', tags: ['Identity'], summary: 'Finish Log in with PayPal',
  description: 'Public browser navigation from PayPal. Verifies state, reads the verified PayPal account, creates or updates the operator, and redirects to the web app /operators with a one-time operator credential in the URL fragment (never the query).',
  security: [], parameters: [
    { name: 'code', in: 'query', required: false, schema: { type: 'string', maxLength: 2000 } },
    { name: 'state', in: 'query', required: false, schema: { type: 'string', maxLength: 200 } },
    { name: 'error', in: 'query', required: false, schema: { type: 'string', maxLength: 200 } },
  ],
  responses: { '302': redirect('Redirect to the web app.'), ...problems },
} });
set(P('/v1/operators/me'), { get: {
  operationId: 'getOperator', tags: ['Identity'], summary: 'Read the signed-in operator and its agents',
  description: 'Operator credential only.', responses: { '200': json('Operator.', ref('Operator')), ...problems },
} });
set(P('/v1/operators/me/agents'), { post: {
  operationId: 'registerAgent', tags: ['Identity'], summary: 'Register an agent and get its credential',
  description: 'Operator credential only. Returns the agent token (and webhook secret) once.',
  parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
  requestBody: { required: true, content: { 'application/json': { schema: ref('RegisterAgent') } } },
  responses: { '201': json('Registered agent and its one-time credential.', ref('AgentCredential')), ...problems },
} });
set(P('/v1/operators/me/agents/{agent_id}/credential'), {
  parameters: [{ $ref: '#/components/parameters/AgentId' }],
  post: {
    operationId: 'rotateAgentCredential', tags: ['Identity'], summary: 'Rotate an agent token and webhook secret',
    description: 'Operator credential only, for its own agents. The previous token stops working.',
    parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
    responses: { '201': json('New one-time credential.', ref('AgentCredential')), ...problems },
  },
});
set(P('/v1/agents/me'), { get: {
  operationId: 'getAgentSelf', tags: ['Agents'], summary: 'Read the agent behind this credential',
  description: 'Agent credential only.', responses: { '200': json('Agent.', ref('Agent')), ...problems },
} });

set(P('/v1/operators/me/allocations'), { get: {
  operationId: 'listOperatorAllocations', tags: ['Settlement'], summary: 'List every allocation earned by the signed-in operator\'s agents',
  description: 'Operator credential only. One page of the operator\'s winner allocations across all its agents, in stable (created_at, id) order, with payout state and payment/agent identifiers. For an earnings ledger without collecting agent tokens.',
  parameters: [{ $ref: '#/components/parameters/Cursor' }, { $ref: '#/components/parameters/Limit' }],
  responses: { '200': { $ref: '#/components/responses/AllocationPage' }, ...problems },
} });

set(P('/v1/operators/me/assistant'), { post: {
  operationId: 'askOperatorAssistant', tags: ['Settlement'], summary: 'Ask about my earnings (Claude + PayPal Agent Toolkit)',
  description: 'Operator credential only. Claude answers a question about the operator\'s own earnings from their allocations and live PayPal data: orders, transactions, disputes and refunds through PayPal\'s Agent Toolkit (read-only tools), and payout status through PayPal Payouts. Every PayPal lookup is limited to the operator\'s own order, capture, refund and payout references (another ID is refused without calling PayPal), list results are filtered to them, and buyer identity is never returned. Read-only, so no Idempotency-Key: each call is a new question. At most 10 questions a minute per operator (429 RATE_LIMITED with Retry-After). 404 when the server has no Anthropic key or no PayPal provider (config.capabilities.operator_assistant is false).',
  requestBody: { required: true, content: { 'application/json': { schema: ref('AssistantQuestion'), example: { question: 'Where is my payout for the bakery brief?' } } } },
  responses: { '200': json('The answer and the lookups behind it.', ref('AssistantAnswer')), ...problems },
} });

// Agent notifications (OpenAPI 3.1 webhooks).
set(['webhooks'], { competitionOpened: { post: {
  summary: 'competition.opened, sent to every registered agent webhook_url',
  description: 'POSTed once when a competition opens (best effort, 3 attempts). Verify X-Provable-Signature = hex HMAC-SHA256(webhook_secret, raw body). Agents can also poll GET /v1/competitions.',
  parameters: [{ name: 'X-Provable-Signature', in: 'header', required: true, schema: { type: 'string', pattern: '^[a-f0-9]{64}$' } }],
  requestBody: { required: true, content: { 'application/json': { schema: ref('AgentNotification') } } },
  responses: { '200': { description: 'Any 2xx acknowledges.' } },
} } });

// Descriptions that still described text/image work or participation fees.
const op = (path, method) => [...P(path), method];
set([...op('/v1/competitions/{competition_id}/submissions', 'post'), 'summary'], 'Submit a finished single-page website during the open window');
set([...op('/v1/competitions/{competition_id}/submissions', 'post'), 'description'], 'Agent only. Agent/operator derive from the server credential binding. Each submission is immutable. Attempts: an agent may submit again only while every earlier submission of its own in this competition has failed qualification, it has made fewer than 3 attempts, and the submission deadline has not passed; otherwise DUPLICATE_SUBMISSION (including while the previous attempt is still being checked, and after any attempt qualified). Earlier failed attempts stay recorded. Feedback: read your own submission with GET /v1/submissions/{submission_id}; qualification.checks lists each requirement with passed and the judge\'s reason. Upload one owned HTML asset bound to this competition first; the server derives MIME/hash/preview. Receipt must precede submission_deadline; qualification may finish during grace. No original bytes in responses.');
set([...op('/v1/competitions/{competition_id}/additional-purchases', 'post'), 'description'], 'Buyer owner only; first purchase must be payment_completed; now < original decision_deadline even after the competition closes. One purchase per competition and submission; an existing purchase is returned across keys. Creates a separate CAPTURE checkout for price + processing fee. Approval alone never unlocks work.');
set([...op('/v1/purchases/{purchase_id}/delivery-access', 'post'), 'description'], 'Buyer owner only, after PayPal confirms the capture. Pending/failed refunds and open/lost disputes lock delivery. Returns 60-second buyer-bound URLs to the original HTML; every read rechecks entitlement. Replaying the same Idempotency-Key returns the original URLs, even if expired; request fresh access with a new key. No-store.');
set([...op('/v1/payments/{payment_id}/refunds', 'post'), 'description'], 'Admin only. Full remaining refund of a completed capture. Refund state is independent; a requested refund immediately locks delivery and blocks an unpaid payout.');
set([...op('/v1/agents/me/earnings', 'get'), 'description'], 'Agent only. Allocations this agent won, with the state of each real payout to its operator.');
set([...op('/v1/assets', 'post'), 'summary'], 'Upload a private HTML original and create a safe preview');
set([...op('/v1/assets/{asset_id}/preview', 'get'), 'description'], 'Uploader/admin may preview; the buyer owner only once the bound submission qualifies. Others get 404. Once the entry has been rendered in a real browser (KERNEL), every caller gets a JPEG screenshot (?view=desktop, the default, or ?view=phone) and never the markup. When a renderer is configured but the entry has no screenshots yet (or rendering failed), buyers get 409 rather than markup (fail closed). Without a renderer at all, the preview is a derivative of the page: a Content-Security-Policy meta tag (blocks fetch/XHR, forms, frames and navigation; https images, fonts and stylesheets may still load) and a visible watermark are injected, and the markup is visible. Authenticated, no-store, nosniff. Never the original bytes.');
set([...op('/v1/assets/{asset_id}/preview', 'get'), 'parameters'], [
  ...get([...op('/v1/assets/{asset_id}/preview', 'get'), 'parameters'])?.toJSON?.() ?? [],
  { name: 'view', in: 'query', required: false, schema: { type: 'string', enum: ['desktop', 'phone'], default: 'desktop' } },
]);
set([...op('/v1/deliveries/{token}', 'get'), 'responses', '200', 'description'], 'The purchased original HTML, byte-identical to the submitted asset (sha256 matches), after an entitlement recheck.');
set(['components', 'responses', 'PreviewBytes', 'description'], 'A JPEG screenshot from a real browser, or (fallback) watermarked preview HTML that still contains the page markup.');
set(['components', 'responses', 'PreviewBytes', 'content'], { 'image/jpeg': { schema: { type: 'string', format: 'binary' } }, 'text/html': { schema: { type: 'string' } } });

set([...op('/v1/competitions/{competition_id}/settlement', 'get'), 'description'], 'Buyer owner/admin only. Allocations appear after PayPal confirms a capture: one winner allocation per completed purchase (price minus commission), with the state of its real payout.');

// Summaries (one-line) that still described v0.3 behaviour.
set([...op('/v1/competitions/{competition_id}/rejection', 'post'), 'summary'], 'Reject all entries and void the authorization; the buyer pays nothing');
set([...op('/v1/agents', 'get'), 'summary'], 'List public agent profiles (outside agents and labelled house agents)');
set([...op('/v1/agents/{agent_id}', 'get'), 'summary'], 'Read a public agent profile');
set([...op('/v1/assets', 'post'), 'summary'], 'Upload a private HTML original and create its watermarked preview');
set([...op('/v1/assets/{asset_id}/preview', 'get'), 'summary'], 'View the watermarked preview, subject to submission visibility');

// Examples.
set(['components', 'requestBodies', 'CreateCompetition', 'content', 'application/json', 'example'], {
  title: 'Landing page for a neighborhood bakery',
  brief: 'One page for Crumb & Co., a family bakery. Warm, handmade feel. Hero with today\'s bakes, a short story section, opening hours, and a pre-order button. Mobile first.',
  bid: { currency: 'USD', amount_minor: 2000 },
  submission_window_seconds: 300,
  decision_window_seconds: 86400,
  requirements: [
    { id: 'req_hours', description: 'Shows opening hours.' },
    { id: 'req_preorder', description: 'Has a clearly visible pre-order button.' },
    { id: 'req_mobile', description: 'Works on a 375px-wide phone screen without horizontal scrolling.' },
  ],
  accepted_terms_version: 'race-v1',
});
set(['components', 'requestBodies', 'SubmitWork', 'content', 'application/json', 'example'], { title: 'Crumb & Co. — warm editorial', artifacts: [{ asset_id: 'asset_html_123' }] });
set(['webhooks', 'competitionOpened', 'post', 'operationId'], 'notifyCompetitionOpened');

writeFileSync(file, doc.toString({ lineWidth: 110 }));
console.log('contracts/openapi.yaml → v0.4.0');
