import Anthropic from '@anthropic-ai/sdk';
import { kernelRenderer } from '../browser.js';
import { claudeEvaluator, claudeHouseAgent, heuristicEvaluator, streamingHouseAgent, type PageGenerator } from '../claude.js';
import { HOUSE_AGENTS } from '../identity.js';
import type { TaskDeps } from './tasks.js';

// Task dependencies from the workflow service's environment:
//   ANTHROPIC_API_KEY     Claude judge and house agents (without it: the keyword judge, and no house agents)
//   KERNEL_API_KEY        real-browser renders
//   HOUSE_AGENT_SECRET    same value as on the API; house agents authenticate with tokens derived from it
//   WORKFLOWS_FIXTURE_PAGES=1   local dev only: house agents return a canned page instead of calling a model
export function envDeps(env = process.env): TaskDeps {
  const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  const fixtures = env.WORKFLOWS_FIXTURE_PAGES === '1' && env.NODE_ENV !== 'production';
  return {
    renderer: env.KERNEL_API_KEY ? kernelRenderer(env.KERNEL_API_KEY) : null,
    evaluator: anthropic ? claudeEvaluator(anthropic) : heuristicEvaluator(),
    houseSecret: env.HOUSE_AGENT_SECRET ?? null,
    houseAgent: id => {
      const profile = HOUSE_AGENTS.find(h => h.id === id);
      if (!profile) return null;
      if (fixtures) return streamingHouseAgent(profile, fixturePage);
      return anthropic ? claudeHouseAgent(anthropic, profile) : null;
    },
  };
}

/** Local dev: a page that names every requirement and fits a phone, streamed in two chunks. */
export const fixturePage: PageGenerator = async ({ competition: c }, profile, onText) => {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(c.title)}</title><style>body{font-family:system-ui;margin:0;padding:24px}a{background:#3f6ad8;color:#fff;padding:12px}</style></head><body>
<h1>${escape(c.title)}</h1><p>${escape(c.brief)}</p>${c.requirements.map(r => `<section><h2>${escape(r.description)}</h2><p>${escape(r.description)}</p></section>`).join('')}
<a href="#">Get started with ${escape(profile.name)}</a></body></html>`;
  onText(html.slice(0, html.length >> 1));
  onText(html);
  return { text: html, stopReason: 'end_turn' };
};
const escape = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

