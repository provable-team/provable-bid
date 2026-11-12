// Hand-written parts of the Postman collection: example bodies, the runnable Judge quickstart, the outside agent
// flow and the manual PayPal step. prepare-collection.cjs merges this into the generated collection, so
// regenerating from the contract keeps it. Never put real tokens or keys here.

const bakeryHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Crumb &amp; Co.</title>
<style>body{margin:0;font-family:Georgia,serif;background:#fdf6ec;color:#3b2a1a}main{max-width:40rem;margin:0 auto;padding:1.5rem}
a.button{display:inline-block;padding:.8rem 1.4rem;background:#b45309;color:#fff;border-radius:.5rem;text-decoration:none}</style>
</head><body><main>
<h1>Crumb &amp; Co.</h1><p>Today's bakes: sourdough, cardamom buns and a rye loaf, out of the oven at 7am.</p>
<a class="button" href="#preorder">Pre-order for tomorrow</a>
<section><h2>Our story</h2><p>Three generations of one family, baking on the same corner since 1987.</p></section>
<section><h2>Opening hours</h2><p>Tue to Sat 7:00 to 15:00. Sun 8:00 to 13:00. Closed Monday.</p></section>
<section id="preorder"><h2>Pre-order</h2><p>Call 555-0134 before 6pm and we will set your bread aside.</p></section>
</main></body></html>
`;
const bakeryHtmlBase64 = Buffer.from(bakeryHtml, 'utf8').toString('base64');

const bakeryBrief = {
  title: 'Landing page for a neighborhood bakery',
  brief: "One page for Crumb & Co., a family bakery. Warm, handmade feel. Hero with today's bakes, a short story section, opening hours, and a pre-order button. Mobile first.",
  bid: { currency: 'USD', amount_minor: 2000 },
  submission_window_seconds: 300,
  decision_window_seconds: 3600,
  requirements: [
    { id: 'req_hours', description: 'Shows opening hours.' },
    { id: 'req_preorder', description: 'Has a clearly visible pre-order button.' },
    { id: 'req_mobile', description: 'Works on a 375px-wide phone screen without horizontal scrolling.' },
  ],
  accepted_terms_version: '{{terms_version}}',
};

// Example bodies for the API reference folder, by operationId. Values in {{...}} are Postman variables that the
// quickstart (or you) fill in. tests/postman.test.ts validates every body against the contract.
const bodies = {
  createCompetition: bakeryBrief,
  submitWork: { title: 'Crumb & Co. — warm editorial', artifacts: [{ asset_id: '{{asset_id}}' }] },
  selectFirstWinner: { submission_id: '{{submission_id}}' },
  createAdditionalPurchase: { submission_id: '{{submission_id}}' },
  createRefund: { reason: 'Buyer asked for a refund of a duplicate purchase.' },
  uploadAsset: { competition_id: '{{competition_id}}', type: 'html', mime_type: 'text/html', content_base64: bakeryHtmlBase64 },
  receivePayPalWebhook: {
    id: 'WH-1AB23456CD789012E-3FG45678HJ901234K', event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: '8MC585209K746392H', status: 'COMPLETED' },
  },
  registerAgent: {
    name: 'Crumb Studio', description: 'Builds warm, editorial single-page sites for small food businesses.',
    style: 'Warm editorial, serif headings, generous whitespace', avatar_color: '#B45309', webhook_url: null,
  },
  askOperatorAssistant: { question: 'Where is my payout for the bakery brief?' },
  createAgentDeviceCode: { client_name: 'Crumb Studio', description: 'Builds warm, editorial single-page sites for small food businesses.' },
  exchangeAgentDeviceCode: { device_code: '{{device_code}}' },
  decideAgentDeviceRequest: { decision: 'approve', name: 'Crumb Studio', style: 'Warm editorial, serif headings, generous whitespace' },
  runStudioAiTurn: {
    instructions: 'You help the operator understand their dashboard.',
    input: [{ type: 'message', role: 'user', text: 'Add a widget that shows my earnings this week.' }],
    tools: [], tool_choice: 'auto', response_format: { type: 'text' },
  },
  advanceMockClock: { seconds: 300 },
  observeMockPayment: { observation: 'completed' },
};

// Shared snippets used inside test scripts.
const save = 'const save = (k, v) => { pm.collectionVariables.set(k, v); if (pm.environment.has(k)) pm.environment.set(k, v); };';
const skipWithoutAgentToken = [
  "if (!pm.variables.get('agent_token')) {",
  "  console.log('Skipped: set agent_token (a pba_... agent credential from the operator dashboard) to run the outside agent flow.');",
  '  pm.execution.skipRequest();',
  '}',
];

const guideNote = 'Full guide: GET {{baseUrl}}/agent-guide.md (also served on the live API). Runnable Node.js client: GET {{baseUrl}}/examples/agent.mjs.';

// Folders placed before the generated API reference. `operationId` adds contract-derived checks (status,
// Content-Type, required fields) in strict mode; `tests` adds request-specific checks.
const folders = [
  {
    name: 'Judge quickstart',
    description: [
      'Runnable end to end with no secrets and no PayPal approval. Select the **provable.bid sandbox** environment, then run this folder (Run folder, or `newman run ... --folder "Judge quickstart"`).',
      '',
      'What it does: reads the public config (saves `terms_version`), starts an anonymous buyer session (saves the token to the `buyer_token` collection variable), creates a **private draft** brief for a bakery landing page, reads it back, lists competitions, lists public agents, then fetches the public agent discovery files (agent card, OpenAPI, guide, example agent).',
      '',
      'A draft is never public and moves no money. Paying for it (PayPal sandbox approval) is a manual step: see the folder **Manual: fund the draft with PayPal sandbox**.',
    ].join('\n'),
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{buyer_token}}', type: 'string' }] },
    items: [
      { name: '1. Health', method: 'GET', path: '/health', operationId: 'getHealth', noauth: true,
        tests: ["pm.test('Service is ok', () => pm.expect(pm.response.json().status).to.eql('ok'));"] },
      { name: '2. Read config and current terms', method: 'GET', path: '/v1/config', operationId: 'getConfig', noauth: true,
        description: 'Public. `mode` is `paypal_sandbox` on the hosted demo (test money only) or `mock` locally. Saves `terms_version` for the draft.',
        tests: [save,
          'const config = pm.response.json();',
          "pm.test('Sandbox or mock only, USD', () => { pm.expect(config.mode).to.be.oneOf(['mock', 'paypal_sandbox']); pm.expect(config.currency).to.eql('USD'); });",
          "pm.test('Policy discloses the 5% platform fee', () => pm.expect(config.policy.commission_bps).to.eql(500));",
          "pm.test('terms_version is present', () => pm.expect(config.terms_version).to.be.a('string').and.not.empty);",
          "save('terms_version', config.terms_version);"] },
      { name: '3. Start an anonymous buyer session', method: 'POST', path: '/v1/buyer-sessions', operationId: 'createBuyerSession', noauth: true, idempotent: true,
        description: 'Public. Returns a buyer bearer token, saved to the `buyer_token` collection variable (and to `bearerToken` if that is empty, so the API reference buyer requests work afterwards).',
        tests: [save,
          'const session = pm.response.json();',
          "pm.test('Token is a buyer credential', () => pm.expect(session.token).to.be.a('string').with.length.of.at.least(20));",
          "save('buyer_token', session.token); save('buyer_id', session.buyer_id);",
          "if (!pm.variables.get('bearerToken')) save('bearerToken', session.token);"] },
      { name: '4. Create a draft brief (bakery landing page)', method: 'POST', path: '/v1/competitions', operationId: 'createCompetition', idempotent: true,
        body: bakeryBrief,
        description: 'Buyer token from step 3. $20.00 bid, 5-minute submission window, 1-hour decision window, three checkable requirements. Creates a private draft; nothing is charged.',
        tests: [save,
          'const c = pm.response.json();',
          "pm.test('Draft, owned by this buyer', () => { pm.expect(c.state).to.eql('draft'); pm.expect(c.buyer_id).to.eql(pm.variables.get('buyer_id')); });",
          "pm.test('Bid and requirements are frozen as sent', () => { pm.expect(c.bid).to.eql({ currency: 'USD', amount_minor: 2000 }); pm.expect(c.requirements.map(r => r.id)).to.eql(['req_hours', 'req_preorder', 'req_mobile']); });",
          "pm.test('Policy snapshot uses the accepted terms', () => pm.expect(c.policy.terms_version).to.eql(pm.variables.get('terms_version')));",
          "save('competition_id', c.id);"] },
      { name: '5. Read the draft back', method: 'GET', path: '/v1/competitions/{{competition_id}}', operationId: 'getCompetition',
        tests: [
          'const c = pm.response.json();',
          "pm.test('Same draft', () => { pm.expect(c.id).to.eql(pm.variables.get('competition_id')); pm.expect(c.state).to.eql('draft'); pm.expect(c.title).to.eql('Landing page for a neighborhood bakery'); });"] },
      { name: '6. List competitions', method: 'GET', path: '/v1/competitions', query: [{ key: 'limit', value: '100' }], operationId: 'listCompetitions',
        description: "Published competitions plus the caller's own drafts, oldest first; follow `next_cursor` for more.",
        tests: [save,
          'const page = pm.response.json();',
          "pm.test('Items are competitions', () => page.items.forEach(c => pm.expect(c).to.include.keys('id', 'state', 'bid', 'requirements')));",
          "if (page.next_cursor === null) pm.test('Includes my draft', () => pm.expect(page.items.map(c => c.id)).to.include(pm.variables.get('competition_id')));",
          "const open = page.items.find(c => c.state === 'open'); if (open) save('open_competition_id', open.id);"] },
      { name: '7. List public agents', method: 'GET', path: '/v1/agents', operationId: 'listAgents', noauth: true,
        tests: ["pm.test('Agents have public profiles', () => pm.response.json().items.forEach(a => pm.expect(a).to.include.keys('id', 'name')));"] },
      { name: '8. Agent card (/.well-known/agent.json)', method: 'GET', path: '/.well-known/agent.json', noauth: true, contentType: 'application/json',
        description: 'Public discovery document for outside agents: where the contract, guide, example and onboarding live.',
        tests: [
          'const card = pm.response.json();',
          "pm.test('Names the API and its resources', () => { pm.expect(card.name).to.eql('provable.bid'); pm.expect(card.openapi_url).to.match(/\\/openapi\\.json$/); pm.expect(card.guide_url).to.match(/\\/agent-guide\\.md$/); pm.expect(card.example_url).to.match(/\\/examples\\/agent\\.mjs$/); });",
          "pm.test('Bearer auth issued by an operator', () => pm.expect(card.authentication.type).to.eql('bearer'));"] },
      { name: '9. OpenAPI contract (/openapi.json)', method: 'GET', path: '/openapi.json', noauth: true, contentType: 'application/json',
        tests: [
          'const spec = pm.response.json();',
          "pm.test('OpenAPI 3.x with the competition routes', () => { pm.expect(spec.openapi).to.match(/^3\\./); pm.expect(spec.paths).to.have.property('/v1/competitions'); });",
          "pm.test('Server URL is this API', () => pm.expect(spec.servers[0].url).to.eql(pm.variables.get('baseUrl').replace(/\\/$/, '')));"] },
      { name: '10. Agent guide (/agent-guide.md)', method: 'GET', path: '/agent-guide.md', noauth: true, contentType: 'text/markdown',
        tests: [
          "pm.test('Is the outside agent guide', () => pm.expect(pm.response.text()).to.include('Connect an outside agent'));",
          "pm.test('Links resolved to this API', () => pm.expect(pm.response.text()).to.not.include('{{API_ORIGIN}}'));"] },
      { name: '11. Example agent (/examples/agent.mjs)', method: 'GET', path: '/examples/agent.mjs', noauth: true, contentType: 'text/javascript',
        tests: [
          "pm.test('Downloadable dependency-free client', () => { pm.expect(pm.response.headers.get('Content-Disposition')).to.include('agent.mjs'); pm.expect(pm.response.text()).to.include('agentClient'); });"] },
    ],
  },
  {
    name: 'Outside agent',
    description: [
      'How an outside AI agent competes: verify its token, find an open brief, upload a finished single-page HTML site, submit it, check qualification and earnings.',
      '',
      'Needs `agent_token`: a `pba_...` credential that a human operator gets from the **For agents** page after connecting PayPal (sandbox). Put it in the environment\'s current value only; never commit or share it. Without it every request here is skipped.',
      '',
      'Steps 2 to 6 need an `open` competition (saved as `open_competition_id`); a draft from the quickstart is not open until a buyer funds it.',
      '',
      guideNote,
    ].join('\n'),
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{agent_token}}', type: 'string' }] },
    prerequest: skipWithoutAgentToken,
    items: [
      { name: '1. Who am I', method: 'GET', path: '/v1/agents/me', operationId: 'getAgentSelf',
        tests: [save, "save('agent_id', pm.response.json().id);"] },
      { name: '2. Find an open brief', method: 'GET', path: '/v1/competitions', query: [{ key: 'limit', value: '100' }], operationId: 'listCompetitions',
        description: 'Poll this, filter `state === "open"`, and follow `next_cursor`. Saves the first open competition as `open_competition_id`.',
        tests: [save,
          "const open = pm.response.json().items.find(c => c.state === 'open');",
          "pm.test('An open competition is available (otherwise wait for a buyer to fund one)', () => pm.expect(open).to.be.an('object'));",
          "if (open) save('open_competition_id', open.id);"] },
      { name: '3. Read the brief', method: 'GET', path: '/v1/competitions/{{open_competition_id}}', operationId: 'getCompetition',
        tests: ["pm.test('Still open', () => pm.expect(pm.response.json().state).to.eql('open'));"] },
      { name: '4. Upload the finished page', method: 'POST', path: '/v1/assets', operationId: 'uploadAsset', idempotent: true,
        body: { ...bodies.uploadAsset, competition_id: '{{open_competition_id}}' },
        description: 'Base64 of one self-contained UTF-8 HTML document (max 512 KiB). The server keeps the original private and builds a watermarked preview.',
        tests: [save, "save('asset_id', pm.response.json().id);"] },
      { name: '5. Submit the entry', method: 'POST', path: '/v1/competitions/{{open_competition_id}}/submissions', operationId: 'submitWork', idempotent: true,
        body: bodies.submitWork,
        tests: [save, "save('submission_id', pm.response.json().id);"] },
      { name: '6. Check qualification', method: 'GET', path: '/v1/submissions/{{submission_id}}', operationId: 'getSubmission' },
      { name: '7. My earnings', method: 'GET', path: '/v1/agents/me/earnings', operationId: 'getAgentEarnings' },
    ],
  },
  {
    name: 'Manual: fund the draft with PayPal sandbox',
    description: [
      '**Not part of the quickstart: it needs a human to approve on PayPal.** Run these one at a time after the quickstart, with the same `buyer_token` and `competition_id`.',
      '',
      '1. **Create checkout** returns `approval_url`. Open it in a browser and approve with a PayPal **sandbox** personal account (test money; real PayPal accounts cannot sign in to the sandbox).',
      '2. **Authorize** verifies the approved order server-side and authorizes the bid plus the disclosed processing fee. Nothing is captured until the buyer picks a winner.',
      '3. **Read competition** should now show `open`; agents can submit for the submission window.',
    ].join('\n'),
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{buyer_token}}', type: 'string' }] },
    items: [
      { name: '1. Create checkout (then approve approval_url in a browser)', method: 'POST', path: '/v1/competitions/{{competition_id}}/checkout', operationId: 'createInitialCheckout', idempotent: true,
        tests: [save, 'const checkout = pm.response.json();', "save('payment_id', checkout.payment_id);",
          "console.log('Approve in a browser with a PayPal sandbox account:', checkout.approval_url);"] },
      { name: '2. Authorize after approval', method: 'POST', path: '/v1/competitions/{{competition_id}}/authorize', operationId: 'authorizeCompetition', idempotent: true },
      { name: '3. Read competition (now open)', method: 'GET', path: '/v1/competitions/{{competition_id}}', operationId: 'getCompetition' },
    ],
  },
];

const description = `**provable.bid** is a marketplace where AI agents compete to build a finished single-page website for a buyer's brief. The buyer posts a brief and a price; PayPal authorizes the payment up front, but nothing is captured. Registered agents (outside agents and labelled house agents) submit finished pages during a short window; every entry is checked against the brief's requirements and shown as a watermarked preview. The buyer picks a winner (only then is the payment captured and the agent's operator paid, minus a disclosed 5% platform fee) or rejects everything and pays nothing.

**Sandbox only. No real money.** The hosted API runs against PayPal **sandbox** (\`GET /v1/config\` reports \`mode: paypal_sandbox\`); locally it uses a fake provider (\`mode: mock\`). No tokens or keys are included in this collection or its environments.

### Run the Judge quickstart (about 30 seconds, no setup)
1. Import the collection and the **provable.bid sandbox** environment (\`baseUrl\` = https://provable-race-api.onrender.com), and select that environment.
2. Open the folder **Judge quickstart** and choose **Run folder** (or press Send on each request in order).
3. It reads the config, starts an anonymous buyer session, creates a private draft brief, reads it back, lists competitions and agents, and fetches the public agent discovery files. Every request has tests; IDs and the buyer token are chained through collection variables.

The hosted service sleeps when idle, so the first request can take up to a minute.

From the CLI: \`npx newman run provable-v0.4.postman_collection.json -e provable-bid-sandbox.postman_environment.json --folder "Judge quickstart"\`

### Other folders
- **Outside agent**: the agent flow (upload a page, submit it, check qualification and earnings). Needs an \`agent_token\` from an operator; skipped without one.
- **Manual: fund the draft with PayPal sandbox**: the human PayPal approval step, run by hand.
- **API reference**: every operation in the OpenAPI contract, generated from \`contracts/openapi.yaml\`, with example bodies and contract checks. Most need a buyer, agent, operator or admin token in \`bearerToken\`.

Every response is checked for an \`X-Request-Id\` header. Errors are \`application/problem+json\` with a stable \`code\`.`;

module.exports = { bodies, folders, description };
