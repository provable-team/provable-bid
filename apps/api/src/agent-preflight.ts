import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { gateHtml, prepareHtml } from './html.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const NOT_VISIBLE = /\b(hidden|clip|auto|scroll)\b/;
/** True when a declaration block fixes an aspect ratio and makes the box clip or scroll its content. */
function clipsFixedAspect(declarations: string) {
  const decl = new Map<string, string>();
  for (const part of declarations.split(';')) {
    const i = part.indexOf(':');
    if (i > 0) decl.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).replace(/!important/i, '').trim().toLowerCase());
  }
  const ratio = decl.get('aspect-ratio');
  if (!ratio || /^(auto|inherit|initial|unset|revert(-layer)?)$/.test(ratio) || !/\d/.test(ratio)) return false;
  return ['overflow', 'overflow-x', 'overflow-y', 'overflow-block'].some(k => NOT_VISIBLE.test(decl.get(k) ?? ''));
}

/** Elements matched by the last compound of a simple selector (tag, .class, #id, or tag.class.class); null when the selector is not simple. */
function simpleMatcher(selector: string): ((el: Element) => boolean) | null {
  const last = selector.trim().split(/[\s>+~]+/).pop() ?? '';
  const m = /^([a-z][a-z0-9-]*)?((?:[.#][\w-]+)*)$/i.exec(last);
  if (!m || (!m[1] && !m[2])) return null;
  const tag = m[1]?.toLowerCase();
  const parts = [...(m[2] ?? '').matchAll(/([.#])([\w-]+)/g)];
  return el => {
    if (tag && el.tagName !== tag) return false;
    const attr = (name: string) => el.attrs.find(a => a.name === name)?.value ?? '';
    const classes = attr('class').split(/\s+/);
    return parts.every(([, kind, name]) => kind === '.' ? classes.includes(name) : attr('id') === name);
  };
}

function hasText(node: Node): boolean {
  if (node.nodeName === '#text') return /\S/.test((node as DefaultTreeAdapterMap['textNode']).value);
  if ('tagName' in node && (node.tagName === 'style' || node.tagName === 'script' || node.tagName === 'template')) return false;
  return 'childNodes' in node && node.childNodes.some(hasText);
}

/**
 * Layout risks worth one repair but not worth rejecting the page: a box with a fixed aspect ratio that clips its
 * overflow cannot grow (CSS drops aspect-ratio's automatic minimum height once overflow is not visible), so any text
 * inside it is cut off as soon as it needs more room than the ratio allows, typically on a 390px phone or in print.
 */
function layoutWarnings(document: Node): string[] {
  const elements: Element[] = [];
  const css: string[] = [];
  const walk = (node: Node) => {
    if ('tagName' in node) {
      elements.push(node);
      if (node.tagName === 'style') css.push(node.childNodes.map(c => c.nodeName === '#text' ? (c as DefaultTreeAdapterMap['textNode']).value : '').join(''));
    }
    if ('childNodes' in node) for (const child of node.childNodes) walk(child);
  };
  walk(document);
  const warnings: string[] = [];
  const warn = (what: string) => warnings.push(`${what} has a fixed aspect-ratio and clips its overflow (overflow: hidden/clip/auto/scroll), and it holds text. Such a box cannot grow, so its text is cut off whenever it needs more room than the ratio allows (a 390px phone, a long line, print). Let text containers grow instead: keep overflow visible (or use min-height rather than a fixed ratio) and clip decoration in a separate text-free layer, then make sure every line of text is fully visible at 390px and 1280px wide and in print.`);
  for (const sheet of css) {
    const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, selectors, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (selectors.trim().startsWith('@') || !clipsFixedAspect(body)) continue;
      for (const selector of selectors.split(',')) {
        const match = simpleMatcher(selector);
        if (match && elements.some(el => match(el) && hasText(el))) { warn(`The CSS rule "${selector.trim().slice(0, 80)}"`); break; }
      }
    }
  }
  for (const el of elements) {
    const style = el.attrs.find(a => a.name === 'style')?.value;
    if (style && clipsFixedAspect(style) && hasText(el)) warn(`An inline-styled <${el.tagName}>`);
  }
  return [...new Set(warnings)].slice(0, 4);
}

/**
 * Local checks for the builder, before uploading or spending a qualification attempt. `issues` block submission;
 * `warnings` are layout risks the builder gets one repair for, but they never stop a page from being submitted.
 */
export function preflightHouseHtml(text: string, stopReason?: string | null): { html: string; issues: string[]; warnings: string[] } {
  const start = text.search(/<!doctype html\s*>/i);
  const end = text.toLowerCase().lastIndexOf('</html>');
  // Keep the complete partial output for a repair. A model may legitimately omit optional closing tags.
  const html = start < 0 ? text : text.slice(start, end >= start ? end + 7 : undefined).replace(/\s*```\s*$/, '');
  const issues: string[] = [];
  if (start < 0) issues.push('Return an HTML document beginning with <!doctype html>.');
  if (stopReason === 'max_tokens' && end < start) issues.push('Generation hit its output limit before finishing the page. Return a smaller, complete document.');
  const gate = gateHtml(html);
  if (gate) issues.push(gate.reason);
  try { prepareHtml(Buffer.from(html, 'utf8').toString('base64')); }
  catch (error) { issues.push(error instanceof Error ? error.message : 'The page is not valid HTML.'); }

  const truncations = new Set<string>();
  const document = parse(html, { onParseError: error => {
    // Missing </body> or </html> is legal HTML. EOF inside a tag, script, style or comment is not.
    if (error.code.startsWith('eof-')) truncations.add(error.code);
  } });
  if (truncations.size) issues.push('The document ends inside an unfinished tag, attribute, comment, script or style. Finish it before submitting.');

  const targets = new Set<string>();
  const links = new Set<string>();
  function visit(node: Node) {
    if ('tagName' in node) {
      const attr = (name: string) => node.attrs.find(a => a.name === name)?.value;
      const id = attr('id');
      if (id) targets.add(id);
      if (node.tagName === 'a') {
        const name = attr('name');
        if (name) targets.add(name);
        const href = attr('href')?.trim();
        if (href?.startsWith('#') && href.length > 1) links.add(href.slice(1));
      }
    }
    // Template contents are inert and cannot supply a real navigation destination.
    if ('childNodes' in node) for (const child of node.childNodes) visit(child);
  }
  visit(document);
  for (const fragment of links) {
    let target = fragment;
    try { target = decodeURIComponent(fragment); } catch { /* A literal % can be a valid ID. */ }
    // #top and the empty fragment are browser-defined destinations, even without an element ID.
    if (!targets.has(target) && target.toLowerCase() !== 'top') {
      issues.push(`The in-page link #${fragment.slice(0, 160)} has no matching id or named anchor. Add its real destination or use a working button for the action.`);
    }
  }
  return { html, issues: [...new Set(issues)].slice(0, 12), warnings: layoutWarnings(document) };
}
