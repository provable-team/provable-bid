/**
 * Coarse, content-free build steps for a house agent, derived from structural markers in its streamed HTML.
 *
 * A label is always one of the fixed phrases below, or "adding <words>" where the words come from the buyer's own
 * requirement descriptions (used only when a section of the stream actually mentions them). Nothing from the
 * generated page (text, markup, CSS, class names) is ever copied into a label: buyers must not see the source
 * before they buy it.
 */
export const STEP = {
  planning: 'planning the page',
  setup: 'setting up the page',
  styles: 'writing the styles',
  phones: 'styling for phones',
  header: 'writing the header',
  hero: 'writing the hero',
  section: 'adding a section',
  footer: 'writing the footer',
  script: 'adding interactions',
  finishing: 'finishing up',
  checking: 'checking the page',
  submitted: 'submitted',
} as const;

const STOP = new Set(`the a an and or of to in on for with has have is are be it its this that these those page pages shows show
clearly visible should must include includes including section sections each every their there where which while without
work works working mobile phone phones screen screens wide width responsive horizontal scroll scrolling layout 375px
least more most than very also into from your our clear simple nice good great button buttons link links text
visibly names speaks describes accurately answers prominent prominently says real moves fits points depend original primary
three four five questions question when what happens nothing selected chooses who whom accessible keyboard focus styles
controls control viewport using uses used without external fonts images scripts least`.split(/\s+/));

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 -]+|-(?![a-z0-9])|(?<![a-z0-9])-/g, ' ').split(/\s+/).filter(Boolean);
const meaningful = (w: string) => w.length > 3 && !STOP.has(w) && !/^\d/.test(w);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Requirement topics: a keyword to look for in a section of the stream, and the label to show if it appears. */
export function requirementTopics(requirements: { description: string }[]) {
  const topics: { pattern: RegExp; label: string }[] = [];
  const seen = new Set<string>();
  for (const r of requirements) {
    const ws = words(r.description);
    // Only short requirements name a topic ("Shows opening hours"); long ones mix many ideas and give noisy labels.
    if (ws.length > 6) continue;
    ws.forEach((w, i) => {
      if (!meaningful(w) || seen.has(w)) return;
      seen.add(w);
      // The run of meaningful words around it ("opening hours"), at most three, else "the <word>".
      let a = i, b = i;
      while (a > 0 && meaningful(ws[a - 1]) && b - a < 1) a--;
      while (b < ws.length - 1 && meaningful(ws[b + 1]) && b - a < 1) b++;
      const phrase = b > a ? ws.slice(a, b + 1).join(' ') : `the ${w}`;
      const stem = w.length > 4 ? w.replace(/s$/, '') : w;
      topics.push({ pattern: new RegExp(`\\b${escape(stem)}`, 'i'), label: `adding ${phrase}`.slice(0, 48) });
    });
  }
  return topics;
}

const MARKERS: { re: RegExp; step: keyof typeof STEP | 'topic' }[] = [
  { re: /<!doctype/i, step: 'setup' },
  { re: /<style\b/i, step: 'styles' },
  { re: /@media\b/i, step: 'phones' },
  { re: /<(?:header|nav)\b/i, step: 'header' },
  { re: /<h1\b|<[a-z][a-z0-9]*\s[^>]*\b(?:class|id)\s*=\s*["']?[^"'>]*\bhero\b/i, step: 'hero' },
  { re: /<(?:section|main|article|h2)\b/i, step: 'topic' },
  { re: /<footer\b/i, step: 'footer' },
  { re: /<script\b/i, step: 'script' },
  { re: /<\/html\s*>/i, step: 'finishing' },
];
const ANY = new RegExp(MARKERS.map(m => `(${m.re.source})`).join('|'), 'gi');
const WINDOW = 400; // characters after a section marker searched for a requirement topic
const OVERLAP = 160; // re-scan this much of the previous text so a marker split across chunks is still found

/**
 * Feed it the growing text snapshot of the model's output; it returns the current step label.
 * Incremental: each call scans only the new text (plus a small overlap).
 */
export function progressTracker(requirements: { description: string }[]) {
  const topics = requirementTopics(requirements);
  let label: string = STEP.planning;
  let scanned = 0; // text before this index has been scanned
  let lastMarker = -1; // absolute index of the last marker applied
  let topicAt = -1; // start of a section whose topic is still being looked for
  let lastTopic = -Infinity; // start of the latest section (a heading right inside it is part of the same section)
  const passed = new Set<string>(); // fixed steps happen once: a later <nav> in the footer is not "writing the header" again
  return (snapshot: string): string => {
    if (snapshot.length < scanned) { scanned = 0; lastMarker = -1; topicAt = -1; lastTopic = -Infinity; passed.clear(); } // a new text block
    const from = Math.max(0, scanned - OVERLAP);
    ANY.lastIndex = from;
    for (let m = ANY.exec(snapshot); m; m = ANY.exec(snapshot)) {
      if (m.index <= lastMarker) continue;
      const hit = MARKERS[m.slice(1).findIndex(g => g !== undefined)];
      lastMarker = m.index;
      // A section's label waits until its opening text has streamed in and been matched against the requirements.
      if (hit.step === 'topic') { if (m.index - lastTopic >= WINDOW) topicAt = lastTopic = m.index; }
      else if (!passed.has(hit.step)) { passed.add(hit.step); topicAt = -1; label = STEP[hit.step]; }
    }
    scanned = snapshot.length;
    if (topicAt >= 0) {
      const windowText = snapshot.slice(topicAt, topicAt + WINDOW);
      const topic = topics.find(t => t.pattern.test(windowText));
      if (topic) { label = topic.label; topicAt = -1; }
      else if (snapshot.length >= topicAt + WINDOW) { label = STEP.section; topicAt = -1; }
    }
    return label;
  };
}

// ---------------------------------------------------------------- the agent's own colours

// A complete declaration of background*, color, border* or a custom property; the terminator (; } or ") means a hex
// value split across stream chunks is never read half-way.
const DECL = /(?<=^|[\s;{"'])(?:background(?:-color)?|color|border(?:-(?:top|right|bottom|left))?(?:-color)?|--[a-z0-9_-]+)\s*:\s*([^;{}"<>]{1,200})(?=[;}"])/gi;
const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z_-])/gi;

/** #abc / #AABBCC → #aabbcc, or null if it is not exactly a 3- or 6-digit hex colour. */
export function normalizeHex(value: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? [...h].map(c => c + c).join('') : h}`;
}

/** WCAG relative luminance of #rrggbb. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Up to 3 colours an agent is actually using, never anything else from its CSS. Near-white and near-black are skipped. */
export function colorTracker(max = 3) {
  const found: string[] = [];
  let scanned = 0;
  return (snapshot: string): string[] => {
    if (snapshot.length < scanned) scanned = 0;
    if (found.length >= max) return [...found];
    DECL.lastIndex = Math.max(0, scanned - 220); // re-read the tail: a declaration may have been cut off last time
    for (let d = DECL.exec(snapshot); d && found.length < max; d = DECL.exec(snapshot)) {
      for (const h of d[1].matchAll(HEX)) {
        const hex = normalizeHex(h[0]);
        if (!hex || found.includes(hex)) continue;
        const l = luminance(hex);
        if (l > 0.82 || l < 0.025) continue; // near-white / near-black say nothing about the design
        found.push(hex);
        if (found.length >= max) break;
      }
    }
    scanned = snapshot.length;
    return [...found];
  };
}

/** Server-side check before colours leave the API: only exact #rrggbb strings, at most 3. */
export function safeColors(colors: unknown): string[] {
  if (!Array.isArray(colors)) return [];
  return [...new Set(colors.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/.test(c)))].slice(0, 3);
}

// ---------------------------------------------------------------- the page's structure (kinds and counts only)

export const BLOCK_KINDS = ['nav', 'hero', 'section', 'form', 'faq', 'table', 'footer'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
/** One top-level block of the page being written: a kind, small counts and an optional fill colour. Never text. */
export type Block = { kind: BlockKind; columns?: number; items?: number; fill?: string };
export type Structure = { blocks: Block[]; current: number | null; accent: string | null };

const MAX_BLOCKS = 12;
const VOID = new Set('area base br col embed hr img input link meta source track wbr'.split(' '));
const REPEATABLE = new Set('div li article figure a dl section aside blockquote'.split(' '));
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

type Building = {
  tag: string; kind: 'nav' | 'hero' | 'section' | 'form' | 'faq' | 'table' | 'footer'; open: boolean;
  details: number; accordion: number; headings: number; fields: number; rows: number;
  hasForm: boolean; hasTable: boolean; faqHint: boolean; repeat: number;
};
type Frame = { tag: string; block: Building | null; depth: number; children: Map<string, number> };

const newBlock = (tag: string, kind: Building['kind'], attrs: string): Building => ({
  tag, kind, open: true, details: 0, accordion: 0, headings: 0, fields: 0, rows: 0,
  hasForm: kind === 'form', hasTable: kind === 'table', faqHint: /\bfaq/i.test(attrs), repeat: 0,
});
const cap = (n: number, max: number) => Math.max(1, Math.min(max, n));

/** What a block looks like from the outside: its kind and small counts, decided from what it contains. */
function shape(b: Building): Block {
  const asked = Math.max(b.details, b.accordion);
  if (b.kind === 'faq' || asked >= 2 || (b.faqHint && b.kind === 'section'))
    return { kind: 'faq', items: cap(asked || b.headings || 3, 12) };
  if (b.kind === 'hero' || b.kind === 'nav' || b.kind === 'footer') return { kind: b.kind };
  if (b.hasForm || b.fields >= 2) return { kind: 'form', items: cap(b.fields || 1, 12) };
  if (b.hasTable) return { kind: 'table', items: cap(b.rows || 1, 12) };
  return b.repeat >= 2 ? { kind: 'section', columns: cap(b.repeat, 4) } : { kind: 'section' };
}

/**
 * The ordered top-level blocks of a (possibly partial) HTML page: nav, hero (the first h1 region), sections with their
 * column count (repeated direct children such as cards, capped at 4), forms (field count), FAQs / accordions (item
 * count), tables (row count) and the footer; plus which block is being written now (open but not yet closed, else the
 * newest). Only kinds and small integers come out; text, class names and attributes are read here and dropped.
 */
export function parseStructure(html: string): Omit<Structure, 'accent'> & { sources: string[] } {
  const at = html.search(/<body\b/i);
  const body = (at >= 0 ? html.slice(at) : html.slice(Math.max(0, html.search(/<\/head\s*>/i))))
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|template)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<svg\b[\s\S]*?(?:<\/svg\s*>|$)/gi, '<i></i>'); // an illustration is not structure
  const blocks: Building[] = [];
  const stack: Frame[] = [{ tag: '#root', block: null, depth: 0, children: new Map() }];
  let hero = false;
  const inside = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].block) return stack[i]; return null; };
  TAG.lastIndex = 0;
  for (let m = TAG.exec(body); m; m = TAG.exec(body)) {
    const [, close, rawTag, attrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (close) {
      const i = stack.map(f => f.tag).lastIndexOf(tag);
      if (i > 0) for (const f of stack.splice(i)) if (f.block && stack.every(s => s.block !== f.block)) f.block.open = false;
      continue;
    }
    const parent = stack[stack.length - 1];
    const owner = inside();
    const b = owner?.block ?? null;
    // Repeated direct children (same tag and first class) near the top of a block read as columns.
    if (b && REPEATABLE.has(tag) && parent.depth - owner!.depth <= 3) {
      const sig = `${tag}.${/class\s*=\s*["']?([\w-]+)/i.exec(attrs)?.[1] ?? ''}`;
      const n = (parent.children.get(sig) ?? 0) + 1;
      parent.children.set(sig, n);
      if (parent !== owner || tag !== 'section') b.repeat = Math.max(b.repeat, n);
    }
    if (b) {
      if (tag === 'h1' && !hero && (b.kind === 'nav' || b.kind === 'section')) { b.kind = 'hero'; hero = true; }
      if (tag === 'details') b.details++;
      if (/\baria-expanded\s*=/i.test(attrs)) b.accordion++;
      if (/^(h2|h3|h4|dt|summary)$/.test(tag)) b.headings++;
      if ((tag === 'input' && !/type\s*=\s*["']?(hidden|submit|button)/i.test(attrs)) || tag === 'select' || tag === 'textarea') b.fields++;
      if (tag === 'form') b.hasForm = true;
      if (tag === 'table') b.hasTable = true;
      if (tag === 'tr') b.rows++;
    }
    const frame: Frame = { tag, block: null, depth: parent.depth + 1, children: new Map() };
    if (!b && blocks.length < MAX_BLOCKS) {
      const kind: Building['kind'] | null =
        tag === 'nav' || tag === 'header' ? 'nav' : tag === 'footer' ? 'footer' : tag === 'form' ? 'form' : tag === 'table' ? 'table'
        : tag === 'details' ? 'faq' : tag === 'section' || tag === 'article' || tag === 'aside' ? 'section' : null;
      if (kind === 'faq' && blocks.at(-1)?.kind === 'faq') { frame.block = blocks.at(-1)!; frame.block.details++; frame.block.open = true; }
      else if (kind) { frame.block = newBlock(tag, kind, attrs); if (kind === 'faq') frame.block.details = 1; blocks.push(frame.block); }
      else if (tag === 'h1' && !hero) {
        // A hero outside any block: the h1's wrapper (unless that is the page itself) is the hero region.
        const host = parent.tag !== '#root' && parent.tag !== 'main' && parent.tag !== 'body' ? parent : frame;
        host.block = newBlock(host.tag, 'hero', attrs);
        hero = true;
        blocks.push(host.block);
      }
    }
    if (tag === 'form' && frame.block && frame.block.kind === 'form') frame.block.hasForm = true;
    if (tag === 'input' && frame.block?.kind === 'form') frame.block.fields++;
    if (!VOID.has(tag) && !selfClose) stack.push(frame);
    else if (frame.block) frame.block.open = false;
  }
  const open = blocks.map(b => b.open).lastIndexOf(true);
  return { blocks: blocks.map(shape), current: blocks.length ? (open >= 0 ? open : blocks.length - 1) : null, sources: blocks.map(b => b.tag) };
}

const RULE = /([^{}]+)\{([^{}]*)\}/g;
const BG = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i;
const PROP = /(--[\w-]+)\s*:\s*([^;]+)/g;

/** Fill colours where the CSS says where they go: header/.hero → hero, nav, footer, and button/.btn/.cta → accent. */
export function structureColors(html: string) {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi)].map(m => m[1]).join('\n');
  const vars = new Map<string, string>();
  for (const r of css.matchAll(RULE)) for (const p of r[2].matchAll(PROP)) {
    const hex = /#[0-9a-f]{3,6}\b/i.exec(p[2])?.[0];
    const n = hex && normalizeHex(hex);
    if (n && !vars.has(p[1])) vars.set(p[1], n);
  }
  const fills: { header?: string; hero?: string; nav?: string; footer?: string; accent?: string } = {};
  for (const r of css.matchAll(RULE)) {
    const bg = BG.exec(r[2])?.[1];
    if (!bg) continue;
    const hex = normalizeHex(/#[0-9a-f]{3,6}\b/i.exec(bg)?.[0] ?? '') ?? vars.get(/var\(\s*(--[\w-]+)/.exec(bg)?.[1] ?? '') ?? null;
    if (!hex) continue;
    for (const sel of r[1].split(',').map(s => s.trim().toLowerCase())) {
      const last = sel.split(/[\s>+~]+/).pop() ?? '';
      if (/:(hover|focus|active|focus-visible)/.test(last)) continue;
      if (last === 'header' || last === '.site-header') fills.header ??= hex;
      else if (/^(\.hero[\w-]*|#hero|\.site-hero)$/.test(last)) fills.hero ??= hex;
      else if (/^(nav|\.nav[\w-]*|\.topbar)$/.test(last)) fills.nav ??= hex;
      else if (/^(footer|\.footer[\w-]*|\.site-footer)$/.test(last)) fills.footer ??= hex;
      else if (/^(button|\.btn[\w-]*|\.button[\w-]*|\.cta[\w-]*|a\.primary|\.primary)$/.test(last)) fills.accent ??= hex;
    }
  }
  return fills;
}

/** Structure of the growing page, re-read every ~160 new characters (and always when final). */
export function structureTracker() {
  let last = -Infinity;
  let cached: Structure = { blocks: [], current: null, accent: null };
  return (snapshot: string, final = false): Structure => {
    if (!final && snapshot.length - last < 160 && snapshot.length >= last) return cached;
    last = snapshot.length;
    const { blocks, current, sources } = parseStructure(snapshot);
    const fills = structureColors(snapshot);
    blocks.forEach((b, i) => {
      // A rule for the element itself wins (header { … }), then the block's role (.hero, nav, footer).
      const fill = (sources[i] === 'header' ? fills.header : undefined)
        ?? (b.kind === 'hero' ? fills.hero : b.kind === 'nav' ? fills.nav : b.kind === 'footer' ? fills.footer : undefined);
      if (fill) b.fill = fill;
    });
    cached = { blocks, current, accent: fills.accent ?? null };
    return cached;
  };
}

/**
 * A section step named after the block being written when its structure says what it is (FAQ, form, table, a grid of
 * cards); otherwise the label stays as it was (a requirement topic or "adding a section").
 */
export function structuralLabel(label: string, s: Structure): string {
  if (!label.startsWith('adding ') || label === STEP.script || s.current === null) return label;
  const b = s.blocks[s.current];
  if (b?.kind === 'faq') return 'adding the faq';
  if (b?.kind === 'form') return 'adding a form';
  if (b?.kind === 'table') return 'adding a table';
  if (b?.kind === 'section' && b.columns && b.columns >= 2 && label === STEP.section) return `adding a ${b.columns}-column section`;
  return label;
}

/** Server-side check before a structure leaves the API: known kinds, small integers, #rrggbb only. */
export function safeStructure(raw: unknown): Structure | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Structure>;
  if (!Array.isArray(r.blocks)) return null;
  const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v) ? v : undefined);
  const int = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 1 ? Math.min(max, v as number) : undefined);
  const blocks: Block[] = r.blocks.slice(0, MAX_BLOCKS).flatMap((b: any) => {
    if (!b || !BLOCK_KINDS.includes(b.kind)) return [];
    const out: Block = { kind: b.kind };
    const columns = int(b.columns, 4), items = int(b.items, 12), fill = hex(b.fill);
    if (columns) out.columns = columns;
    if (items) out.items = items;
    if (fill) out.fill = fill;
    return [out];
  });
  const current = Number.isInteger(r.current) && (r.current as number) >= 0 && (r.current as number) < blocks.length ? (r.current as number) : blocks.length ? blocks.length - 1 : null;
  return { blocks, current, accent: hex(r.accent) ?? null };
}

/** Last line of defence before a label leaves the server: short, plain words only. */
export function safeLabel(label: string): string | null {
  const clean = label.toLowerCase().replace(/[^a-z0-9 '-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 48);
  return clean || null;
}
