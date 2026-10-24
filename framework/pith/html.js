// html`` tagged templates: parsed once per call-site, cloned, then each ${hole} is bound
// directly to its DOM node. Text is always inserted as text nodes, so user data can't inject HTML.
//
// Holes:
//   text position       ${value}            string/number/Node/array, or signal/function (reactive)
//   attribute           name=${value}       setAttribute (null/false removes it)
//   boolean attribute   ?name=${value}      toggleAttribute
//   property            .name=${value}      el.name = value
//   event               @event=${handler}   addEventListener
//   element ref         ref=${el => ...}    called with the element
// Attribute holes must be the whole value: class=${x}, not class="a ${x}".

import { effect, root, untrack, onCleanup, isSignal, catching } from './signal.js';
import { DEV, warn, error, describe } from './dev.js';

/** @typedef {import('./signal.js').ReadonlySignal<any>} AnySignal */

const REPEAT = Symbol('repeat');
const ATTR_TAIL = /([^\s"'<>\/=]+)\s*=\s*(["']?)$/;
const MARKER = /^pith-(\d+)$/;
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);
const templates = new WeakMap();

/**
 * Build DOM from a template. Text values are escaped; signals and functions update in place.
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {DocumentFragment}
 */
export function html(strings, ...values) {
  let compiled = templates.get(strings);
  if (!compiled) templates.set(strings, (compiled = compile(strings)));
  const { template, parts } = compiled;

  const frag = document.importNode(template.content, true);
  // compile() recorded which node (by position in a tree walk) each hole belongs to, so walk
  // straight to those nodes instead of inspecting every node and attribute.
  /** @type {Node[]} */
  const nodes = new Array(parts.length);
  if (parts.length) {
    const walker = document.createTreeWalker(frag, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
    let index = -1;
    let node = null;
    for (let p = 0; p < parts.length; p++) {
      while (index < parts[p].node) {
        node = walker.nextNode();
        index++;
      }
      nodes[p] = node;
    }
  }
  // Bind after finding every node: binding inserts nodes, which would shift the walk.
  for (let p = 0; p < parts.length; p++) {
    const { hole, attr } = parts[p];
    if (attr === null) bindChild(/** @type {Comment} */ (nodes[p]), values[hole]);
    else bindAttr(/** @type {Element} */ (nodes[p]), attr, values[hole]);
  }
  return frag;
}

/**
 * Like html``, for pieces of an <svg> built on their own (labels, a crosshair): parsed inside <svg>, so
 * <text>, <path> and <g> become SVG elements. Use it inside an html`<svg>...</svg>`.
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {DocumentFragment}
 */
export function svg(strings, ...values) {
  if (!templates.has(strings)) templates.set(strings, compile(strings, true));
  return html(strings, ...values);
}

/**
 * Keyed list: rows are reused by key, only changed rows are re-rendered.
 * Must be the whole ${} hole: <ul>${repeat(items, (t) => t.id, (t) => html`<li>...</li>`)}</ul>
 * @template T
 * @param {import('./signal.js').ReadonlySignal<T[]> | (() => T[]) | T[]} items
 * @param {(item: T) => string | number} key unique and stable per item, e.g. an id
 * @param {(item: T) => unknown} render
 */
export function repeat(items, key, render) {
  return { [REPEAT]: true, items, key, render };
}

function compile(strings, inSvg) {
  let markup = '';
  let skipQuote = '';
  for (let i = 0; i < strings.length; i++) {
    let s = strings[i];
    if (skipQuote) {
      if (s[0] !== skipQuote) {
        throw error('E001', `An attribute hole must be the whole value: write class=\${x}, not class="a \${x}". Near: "${s.slice(0, 30)}"`);
      }
      s = s.slice(1);
      skipQuote = '';
    }
    if (i === strings.length - 1) {
      markup += s;
      break;
    }
    const sofar = markup + s;
    if (sofar.lastIndexOf('<') > sofar.lastIndexOf('>')) {
      const m = ATTR_TAIL.exec(s);
      if (!m) throw error('E001', `A hole inside a tag must be a whole attribute value, like name=\${x}. Near: "${s.slice(-30)}"`);
      markup += s.slice(0, m.index) + `pith-${i}="${m[1]}"`;
      skipQuote = m[2];
    } else {
      markup += s + `<!--pith-${i}-->`;
    }
  }
  const tpl = document.createElement('template');
  tpl.innerHTML = inSvg ? `<svg>${markup}</svg>` : markup;
  // svg``: parsed inside <svg> (so its tags are SVG), then the wrapper is dropped.
  if (inSvg) tpl.content.firstChild.replaceWith(...tpl.content.firstChild.childNodes);
  dropInvisibleWhitespace(tpl.content);

  // Find each hole's node once. Every hole must survive parsing as a marker: inside <textarea>,
  // <title>, <style> or a comment it turns into plain text and the value would silently vanish.
  /** @type {{ node: number, hole: number, attr: string | null }[]} */
  const parts = [];
  const found = new Set();
  const tags = new Set();
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
  let index = -1;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    index++;
    if (node instanceof Comment) {
      const m = MARKER.exec(node.data);
      if (m) {
        found.add(+m[1]);
        parts.push({ node: index, hole: +m[1], attr: null });
      }
      continue;
    }
    if (!(node instanceof Element)) continue;
    for (const attr of [...node.attributes]) {
      const m = MARKER.exec(attr.name);
      if (!m) continue;
      found.add(+m[1]);
      parts.push({ node: index, hole: +m[1], attr: attr.value });
      node.removeAttribute(attr.name);
    }
    if (node.localName.includes('-')) tags.add(node.localName);
  }
  for (let i = 0; i < strings.length - 1; i++) {
    if (!found.has(i)) {
      throw error(
        'E002',
        `The \${} after "${strings[i].slice(-30).trim()}" is in a place templates can't fill ` +
          `(inside <textarea>, <title>, <style>, <script> or a comment). For a textarea use .value=\${x}.`
      );
    }
  }

  // A tag that is still unknown a moment later is usually a typo or a missing import.
  if (DEV && tags.size) {
    setTimeout(() => {
      for (const tag of tags) {
        if (!customElements.get(tag)) {
          DEV && warn('W006', `<${tag}> is not defined. Check the spelling, or import the file that calls define('${tag}', ...).`);
        }
      }
    }, 1000);
  }
  return { template: tpl, parts };
}

// Indentation that can never show up on screen still costs DOM nodes in every copy of the template:
// the template's leading/trailing whitespace, and whitespace inside tables and dropdowns.
// Whitespace between inline elements is kept, since it can be visible.
const NO_TEXT_INSIDE = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'select', 'optgroup', 'datalist']);
const isBlank = (node) => node?.nodeType === Node.TEXT_NODE && !/\S/.test(/** @type {Text} */ (node).data);

function dropInvisibleWhitespace(content) {
  while (isBlank(content.firstChild)) content.removeChild(content.firstChild);
  while (isBlank(content.lastChild)) content.removeChild(content.lastChild);
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  /** @type {Text[]} */
  const blanks = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (isBlank(node) && NO_TEXT_INSIDE.has(/** @type {Element} */ (node.parentNode)?.localName)) blanks.push(/** @type {Text} */ (node));
  }
  for (const node of blanks) node.remove();
}

const isReactive = (v) => isSignal(v) || typeof v === 'function';
const read = (v) => (isSignal(v) ? v.value : typeof v === 'function' ? v() : v);
const isText = (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint';

/**
 * Turn a template value into DOM nodes (used by components and the router too).
 * @param {unknown} value
 * @param {Node[]} [out]
 * @returns {Node[]}
 */
export function toNodes(value, out = []) {
  if (value == null || typeof value === 'boolean') return out;
  if (typeof value === 'function' || isSignal(value)) {
    DEV && warn(
      'W003',
      `A ${isSignal(value) ? 'signal' : 'function'} inside an array or returned from a function is not rendered. ` +
        'Only a signal or function that is the whole ${} hole updates in place.'
    );
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) toNodes(v, out);
  } else if (value instanceof DocumentFragment) {
    for (let n = value.firstChild; n; n = n.nextSibling) out.push(n); // no iterator per call
  } else if (value instanceof Node) {
    out.push(value);
  } else {
    if (typeof value === 'object' && String(value).startsWith('[object ')) {
      if (value[REPEAT]) DEV && warn('W004', 'repeat() must be the whole ${} hole, not inside an array or function.');
      else if (DEV) warn('W002', `A template hole got ${describe(value)}, which shows as "${String(value)}". Render one of its fields instead.`);
    }
    out.push(document.createTextNode(String(value)));
  }
  return out;
}

function bindChild(anchor, value) {
  if (value && value[REPEAT]) return bindRepeat(anchor, value);
  if (!isReactive(value)) {
    // Fixed content never updates, so it takes the marker's place instead of sitting next to it.
    if (isText(value)) {
      const parent = anchor.parentNode;
      // The usual case, <td>${x}</td>: the marker is the only child, so set the text in one step.
      if (parent.firstChild === anchor && parent.lastChild === anchor) parent.textContent = String(value);
      else anchor.replaceWith(String(value));
    } else {
      anchor.replaceWith(...toNodes(value));
    }
    return;
  }
  let nodes = [];
  // Once the hole holds more than text, an empty text node marks where its content starts, and the content
  // is everything up to `anchor`: a template's own top-level holes add nodes next to the ones it was made
  // of, and those must leave with it too (a page's late content, when the router swaps the page).
  /** @type {Text | null} */
  let start = null;
  effect(() => {
    const next = read(value);
    if (nodes.length === 1 && nodes[0].nodeType === Node.TEXT_NODE && isText(next)) {
      const text = String(next);
      if (nodes[0].data !== text) nodes[0].data = text;
      return;
    }
    if (start) while (start.nextSibling !== anchor) start.nextSibling.remove();
    else for (const n of nodes) n.remove();
    nodes = toNodes(next);
    if (!start && nodes.some((n) => n.nodeType !== Node.TEXT_NODE)) anchor.before((start = new Text('')));
    anchor.before(...nodes);
  });
}

function bindRepeat(anchor, { items, key, render }) {
  let rows = new Map(); // key -> { item, nodes, dispose }, in DOM order
  const removeRow = (row) => {
    row.dispose();
    for (const n of row.nodes) n.remove();
  };

  effect(() => {
    const list = read(items) || [];
    untrack(() => {
      const oldIndex = new Map();
      let i = 0;
      for (const k of rows.keys()) oldIndex.set(k, i++);

      const next = new Map();
      const sources = []; // for each new position: the row's old position, or -1 if newly rendered
      for (const item of list) {
        const k = key(item);
        if (next.has(k)) {
          DEV && warn('W005', `repeat() got the key ${JSON.stringify(k)} twice. Keys must be unique or rows go missing.`);
          continue;
        }
        let row = rows.get(k);
        if (row && row.item !== item) {
          removeRow(row);
          row = null;
        }
        if (row) {
          rows.delete(k);
          sources.push(oldIndex.get(k));
        } else {
          row = root((dispose) => ({ item, nodes: toNodes(render(item)), dispose }));
          // A reactive hole at the row's top level leaves a comment marker there; what it adds later sits
          // next to the row's own nodes, and would stay behind when the row is removed.
          DEV && row.nodes.some((n) => n.nodeType === Node.COMMENT_NODE) &&
            warn('W017', 'A repeat() row has a ${} hole that updates at its top level (outside any element): what it shows later would stay behind when the row is removed. Wrap the row in one element: (item) => html`<li>...</li>`.');
          sources.push(-1);
        }
        next.set(k, row);
      }
      removeAll(anchor, rows, sources.every((s) => s < 0));
      rows = next;
      place(anchor.parentNode, anchor, [...next.values()], sources);
    });
  });
  onCleanup(() => {
    for (const row of rows.values()) row.dispose();
  });
}

// Remove the rows that are gone. When none survive and the list owns everything else in its
// parent (the usual <ul>/<tbody> case), drop all their nodes in one step instead of one by one.
function removeAll(anchor, gone, noneKept) {
  if (!gone.size) return;
  const parent = anchor.parentNode;
  let count = 0;
  for (const row of gone.values()) {
    row.dispose();
    count += row.nodes.length;
  }
  if (noneKept && parent.lastChild === anchor && parent.childNodes.length === count + 1) {
    parent.textContent = '';
    parent.appendChild(anchor);
    return;
  }
  for (const row of gone.values()) for (const n of row.nodes) n.remove();
}

// Put rows in order before `anchor`, moving as few existing rows as possible: rows in the longest
// run that is already in order stay put. Moving less keeps focus, selection and scroll intact.
function place(parent, anchor, list, sources) {
  if (!sources.some((s) => s >= 0)) {
    const batch = document.createDocumentFragment(); // all new: one insertion
    for (const row of list) for (const n of row.nodes) batch.appendChild(n);
    parent.insertBefore(batch, anchor);
    return;
  }
  // Usually nothing moved (a removal, an append, an in-place update): skip the ordering math.
  let inOrder = true;
  for (let p = 0, last = -1; p < sources.length && inOrder; p++) {
    if (sources[p] < 0) continue;
    inOrder = sources[p] > last;
    last = sources[p];
  }
  const keep = inOrder ? null : longestIncreasing(sources);
  let before = anchor;
  for (let p = list.length - 1; p >= 0; p--) {
    const nodes = list[p].nodes;
    if (sources[p] < 0 || (keep && !keep[p])) for (const n of nodes) move(parent, n, before);
    if (nodes.length) before = nodes[0];
  }
}

// Marks the positions of a longest strictly increasing subsequence of `sources` (ignoring -1).
function longestIncreasing(sources) {
  const keep = new Uint8Array(sources.length);
  const prev = new Int32Array(sources.length);
  const tails = []; // tails[len] = position ending the best run of length len + 1
  for (let p = 0; p < sources.length; p++) {
    const s = sources[p];
    if (s < 0) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sources[tails[mid]] < s) lo = mid + 1;
      else hi = mid;
    }
    prev[p] = lo > 0 ? tails[lo - 1] : -1;
    tails[lo] = p;
  }
  for (let p = tails.length ? tails[tails.length - 1] : -1; p >= 0; p = prev[p]) keep[p] = 1;
  return keep;
}

// moveBefore (new in Chrome) moves without blurring or restarting; fall back to insertBefore.
function move(parent, node, before) {
  if (parent.moveBefore && node.parentNode === parent && parent.isConnected) parent.moveBefore(node, before);
  else parent.insertBefore(node, before);
}

function bindAttr(el, name, value) {
  const prefix = name[0];
  if (prefix === '@') {
    if (typeof value !== 'function') {
      DEV && warn(
        'W001',
        `${name} on <${el.localName}> needs a function but got ${describe(value)}. ` +
          `Write ${name}=\${() => ...} so the code runs on the event, not while rendering.`
      );
      return;
    }
    el.addEventListener(name.slice(1), catching(value)); // errors go to the component's or page's fallback
    return;
  }
  if (name === 'ref') {
    if (typeof value === 'function') value(el);
    else if (DEV) warn('W010', `ref on <${el.localName}> needs a function like ref=\${(el) => ...} but got ${describe(value)}.`);
    return;
  }
  let apply;
  if (prefix === '.') {
    const prop = name.slice(1);
    apply = (v) => { if (el[prop] !== v) el[prop] = v; };
  } else if (prefix === '?') {
    apply = (v) => el.toggleAttribute(name.slice(1), !!v);
  } else {
    apply = (v) => setAttr(el, name, v);
  }
  if (isReactive(value)) effect(() => apply(read(value)));
  else apply(value);
}

function setAttr(el, name, value) {
  if (value == null || value === false) {
    el.removeAttribute(name);
    return;
  }
  let text = value === true ? '' : String(value);
  if (URL_ATTRS.has(name) && /^\s*javascript:/i.test(text)) text = '#';
  el.setAttribute(name, text);
}
