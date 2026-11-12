import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AgentContext } from '../packages/agent-interface/src/index.js';
import { preflightHouseHtml } from '../apps/api/src/agent-preflight.js';
import { streamingHouseAgent } from '../apps/api/src/claude.js';

const document = (body: string) => `<!doctype html><html><head><title>Crumb bakery</title></head><body><h1>Crumb bakery</h1><p>Fresh sourdough and cardamom buns from our family bakery, Tuesday to Sunday.</p>${body}</body></html>`;

test('preflight checks real fragment destinations, including decoded and legacy anchors', () => {
  assert.deepEqual(preflightHouseHtml(document('<a href="#hours">Hours</a><section id="hours">Tuesday to Sunday</section>')).issues, []);
  assert.deepEqual(preflightHouseHtml(document('<a href="#caf%C3%A9">Cafe</a><a name="café"></a><a href="#top">Top</a><a href="#">Top</a>')).issues, []);
  assert.deepEqual(preflightHouseHtml(document('<a href="#bread&amp;butter">Menu</a><div id="bread&amp;butter">Menu</div>')).issues, []);
  const missing = preflightHouseHtml(document('<a href="#book">Book</a><!-- <div id="book"> --><script>const example = \'<div id="book">\';</script><template><div id="book">Inert</div></template>'));
  assert.equal(missing.issues.length, 1);
  assert.match(missing.issues[0], /#book has no matching/);
  assert.deepEqual(preflightHouseHtml(document('<script>const example = \'<a href="#missing">\';</script>')).issues, [], 'HTML-looking strings are not links');
});

test('preflight distinguishes truncated output from legal omitted HTML closing tags', () => {
  const legal = document('<p>Come by the bakery.').replace('</body></html>', '');
  assert.deepEqual(preflightHouseHtml(legal, 'end_turn').issues, [], 'optional closing tags do not require repair');
  assert.ok(preflightHouseHtml(legal, 'max_tokens').issues.some(x => x.includes('output limit')));
  assert.ok(preflightHouseHtml(legal + '<a href="', 'end_turn').issues.some(x => x.includes('unfinished')));
  const truncatedStyle = '<!doctype html><html><head><style>body { color: red';
  assert.equal(preflightHouseHtml(truncatedStyle, 'max_tokens').html, truncatedStyle, 'preserve all partial output for repair');
  assert.ok(preflightHouseHtml(truncatedStyle, 'max_tokens').issues.some(x => x.includes('unfinished')));
});

test('preflight repairs are bounded and never upload rejected work', async () => {
  let generations = 0;
  let uploads = 0;
  const broken = document('<a href="#missing">View our menu</a>');
  const agent = streamingHouseAgent({ id: 'test', name: 'Test', description: '.', style: '.' }, async () => {
    generations++;
    return { text: broken, stopReason: 'end_turn' };
  });
  const ctx = {
    competition: { requirements: [] }, signal: new AbortController().signal,
    timeLeftMs: () => 120_000, uploadAsset: async () => { uploads++; throw new Error('must not upload'); },
  } as unknown as AgentContext;
  await assert.rejects(agent.run(ctx), /fails preflight/);
  assert.equal(generations, 2, 'one initial generation and at most one local repair');
  assert.equal(uploads, 0);
  generations = 0;
  ctx.timeLeftMs = () => 20_000;
  await assert.rejects(agent.run(ctx), /fails preflight/);
  assert.equal(generations, 1, 'do not start a repair without enough time');
});

test('preflight warns about text inside a fixed-aspect box that clips its overflow, and nothing else', () => {
  const page = (css: string, body: string) => `<!doctype html><html><head><title>Poster</title><style>${css}</style></head><body><h1>Spoke and Chain</h1><p>Free safety checks for every bike on Saturdays, ten until two, at the shop.</p>${body}</body></html>`;
  const clipped = preflightHouseHtml(page('.sheet { aspect-ratio: 297 / 420; overflow: hidden; } @media print { .sheet { aspect-ratio: auto } }', '<div class="sheet"><p>12 Mill Lane</p></div>'));
  assert.deepEqual(clipped.issues, [], 'a layout risk never blocks submission');
  assert.equal(clipped.warnings.length, 1);
  assert.match(clipped.warnings[0], /"\.sheet" has a fixed aspect-ratio/);
  assert.equal(preflightHouseHtml(page('main .card{overflow-y:clip;aspect-ratio:3.5/2}', '<main><section class="card front">Maya</section></main>')).warnings.length, 1);
  assert.equal(preflightHouseHtml(page('', '<div style="aspect-ratio: 1; overflow: hidden">Scan for vendors</div>')).warnings.length, 1, 'inline styles count');
  const fine = [
    page('.sheet { aspect-ratio: 297 / 420; }', '<div class="sheet"><p>12 Mill Lane</p></div>'), // can grow: overflow visible
    page('.sheet { aspect-ratio: auto; overflow: hidden; }', '<div class="sheet"><p>12 Mill Lane</p></div>'),
    page('.dot { aspect-ratio: 1; overflow: hidden; border-radius: 50%; }', '<div class="dot"><svg viewBox="0 0 2 2"><circle r="1"/></svg></div>'), // decoration only
    page('.sheet::before { aspect-ratio: 1; overflow: hidden; }', '<div class="sheet"><p>12 Mill Lane</p></div>'), // not a simple selector
    page('.missing { aspect-ratio: 1; overflow: hidden; }', ''),
  ];
  for (const html of fine) assert.deepEqual(preflightHouseHtml(html).warnings, [], html);
});

test('a layout warning gets the one repair, and the page is submitted even if the repair keeps it', async () => {
  const risky = `<!doctype html><html><head><title>Card</title><style>.card{aspect-ratio:3.5/2;overflow:hidden}</style></head><body><div class="card"><h1>Crumb and Co. Bakery</h1><p>Open Tuesday to Sunday, seven in the morning until three in the afternoon.</p></div></body></html>`;
  const revisions: (string | undefined)[] = [];
  let uploaded = 0;
  const agent = streamingHouseAgent({ id: 'test', name: 'Test', description: '.', style: '.' }, async (_ctx, _profile, _onText, revision) => {
    revisions.push(revision?.failed.map(f => f.requirement).join('|'));
    return { text: risky, stopReason: 'end_turn' };
  });
  const ctx = {
    competition: { id: 'cmp_test', title: 'Card', requirements: [] }, signal: new AbortController().signal, timeLeftMs: () => 120_000,
    uploadAsset: async () => { uploaded++; return { id: 'ast_1' }; }, submit: async () => ({ id: 'sub_1' }),
  } as unknown as AgentContext;
  await agent.run(ctx);
  assert.deepEqual(revisions, [undefined, 'All text fully visible at every size and in print']);
  assert.equal(uploaded, 1);
});
