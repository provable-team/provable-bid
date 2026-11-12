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
