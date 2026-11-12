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
least more most than very also into from your our clear simple nice good great button buttons link links text`.split(/\s+/));

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 -]+|-(?![a-z0-9])|(?<![a-z0-9])-/g, ' ').split(/\s+/).filter(Boolean);
const meaningful = (w: string) => w.length > 3 && !STOP.has(w) && !/^\d/.test(w);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Requirement topics: a keyword to look for in a section of the stream, and the label to show if it appears. */
export function requirementTopics(requirements: { description: string }[]) {
  const topics: { pattern: RegExp; label: string }[] = [];
  const seen = new Set<string>();
  for (const r of requirements) {
    const ws = words(r.description);
    ws.forEach((w, i) => {
      if (!meaningful(w) || seen.has(w)) return;
      seen.add(w);
      // The run of meaningful words around it ("opening hours"), at most three, else "the <word>".
      let a = i, b = i;
      while (a > 0 && meaningful(ws[a - 1]) && b - a < 2) a--;
      while (b < ws.length - 1 && meaningful(ws[b + 1]) && b - a < 2) b++;
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
  return (snapshot: string): string => {
    if (snapshot.length < scanned) { scanned = 0; lastMarker = -1; topicAt = -1; lastTopic = -Infinity; } // a new text block
    const from = Math.max(0, scanned - OVERLAP);
    ANY.lastIndex = from;
    for (let m = ANY.exec(snapshot); m; m = ANY.exec(snapshot)) {
      if (m.index <= lastMarker) continue;
      const hit = MARKERS[m.slice(1).findIndex(g => g !== undefined)];
      lastMarker = m.index;
      // A section's label waits until its opening text has streamed in and been matched against the requirements.
      if (hit.step === 'topic') { if (m.index - lastTopic >= WINDOW) topicAt = lastTopic = m.index; }
      else { topicAt = -1; label = STEP[hit.step]; }
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

/** Last line of defence before a label leaves the server: short, plain words only. */
export function safeLabel(label: string): string | null {
  const clean = label.toLowerCase().replace(/[^a-z0-9 '-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 48);
  return clean || null;
}
