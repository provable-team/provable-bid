import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { gateHtml, prepareHtml } from './html.js';

/** Local checks for the builder, before uploading or spending a qualification attempt. */
export function preflightHouseHtml(text: string, stopReason?: string | null): { html: string; issues: string[] } {
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
  function visit(node: DefaultTreeAdapterMap['node']) {
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
  return { html, issues: [...new Set(issues)].slice(0, 12) };
}
