// Prints the app's state as text (dev mode), from the registry the core keeps in globalThis.__mini
// (see mini/dev.js). Used by `npm run see /path --state` and by failing user flows.
// It runs in the test page on the app iframe's window (another realm), so it checks shapes and
// nodeType, never instanceof. Values are read with peek() (no subscribing), and a value that throws
// while being read prints as `?`.

const MAX_LINES = 60;
const MAX_LINE = 600;
const MAX_KEYS = 8;

const cut = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
const str = (s) => JSON.stringify(cut(s, 40));
const peek = (s) => (s && typeof s.peek === 'function' ? s.peek() : s);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const message = (err) => cut(String(err?.message ?? err), 60);

/** A short preview of any value. `deep` is false for values inside an array or object. */
function preview(v, deep = true) {
  if (v === null || v === undefined || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'string') return str(v);
  if (typeof v === 'function') return 'fn';
  if (typeof v === 'symbol') return String(v);
  if (typeof v.nodeType === 'number') return v.nodeType === 1 ? `<${v.localName}>` : v.nodeName ?? 'node';
  if (Array.isArray(v)) {
    const items = plural(v.length, 'item');
    if (!deep || !v.length) return items;
    return `${items} [${preview(v[0], false)}${v.length > 1 ? ', …' : ''}]`;
  }
  const tag = Object.prototype.toString.call(v).slice(8, -1);
  if (tag === 'Date') return v.toISOString();
  if (tag === 'Map' || tag === 'Set') return `${tag}(${v.size})`;
  if (tag === 'Error' || (typeof v.message === 'string' && typeof v.stack === 'string')) return `error: ${message(v)}`;
  if (typeof v.peek === 'function') return 'signal';
  const keys = Object.keys(v);
  if (!keys.length) return '{}';
  return `{ ${keys.slice(0, MAX_KEYS).join(', ')}${keys.length > MAX_KEYS ? ', …' : ''} }`;
}

const kinds = {
  signal: (s) => preview(peek(s)),
  computed: (s) => `computed · ${preview(peek(s))}`,
  resource(r) {
    const err = peek(r.error);
    if (err) return `resource · error: ${message(err)}`;
    const data = peek(r.data);
    if (data === undefined && peek(r.loading)) return 'resource · loading';
    return `resource · ${preview(data)}${peek(r.loading) ? ' · loading' : ''}`;
  },
  paginated(p) {
    const parts = ['paginated', plural(peek(p.items)?.length ?? 0, 'item'), `hasMore ${!!peek(p.hasMore)}`];
    if (peek(p.loading) || peek(p.loadingMore)) parts.push('loading');
    const err = peek(p.error);
    if (err) parts.push(`error: ${message(err)}`);
    return parts.join(' · ');
  },
  form(f) {
    const names = Object.keys(f.fields ?? {});
    const values = names.map((n) => `${n}: ${preview(peek(f.fields[n]), false)}`);
    const errors = names.map((n) => [n, f.error?.(n)]).filter(([, e]) => e).map(([n, e]) => `${n}: ${str(String(e))}`);
    let text = `form { ${values.join(', ')} }`;
    if (errors.length) text += ` · errors { ${errors.join(', ')} }`;
    const err = peek(f.submitError);
    if (err) text += ` · error: ${message(err)}`;
    if (peek(f.submitting)) text += ' · submitting';
    return text;
  },
};

/** `name = preview` for each [name, kind, obj] entry. */
function entries(list) {
  return list.map(([name, kind, obj]) => {
    let text;
    try {
      text = (kinds[kind] ?? kinds.signal)(obj);
    } catch {
      text = '?';
    }
    return `${name} = ${text}`;
  }).join(', ');
}

const signals = (record) => entries(Object.entries(record ?? {}).map(([name, s]) => [name, 'signal', s]));

// Mini components inside `root`, in document order (shadow content before light children, as rendered).
function findComponents(root, set) {
  const found = [];
  const walk = (node, depth) => {
    const isComponent = set.has(node);
    if (isComponent) found.push([node, depth]);
    const next = isComponent ? depth + 1 : depth;
    if (node.shadowRoot) for (const child of node.shadowRoot.children ?? []) walk(child, next);
    for (const child of node.children ?? []) walk(child, next);
  };
  walk(root, 0);
  return found;
}

function componentLine(hostEl, depth) {
  const info = hostEl.__miniState ?? {};
  const props = signals(info.props);
  const state = entries(info.state ?? []);
  let text = `<${info.tag ?? hostEl.localName}>`;
  if (props && state) text += ` props: ${props}; state: ${state}`;
  else if (props) text += ` props: ${props}`;
  else if (state) text += `: ${state}`;
  return '  '.repeat(depth) + text;
}

/**
 * @param {Window | undefined | null} win the app's window
 * @returns {string}
 */
export function stateText(win) {
  let mini;
  try {
    mini = /** @type {any} */ (win)?.__mini;
  } catch {
    // a cross-origin window
  }
  if (!mini) return '(state is only recorded in dev mode)';
  const lines = [];
  const add = (fn) => {
    try {
      lines.push(fn());
    } catch (err) {
      lines.push(`? (${message(err)})`);
    }
  };

  if (mini.router) add(() => {
    const search = String(peek(mini.router.search) ?? '');
    return `route ${peek(mini.router.path)}${search && !search.startsWith('?') ? '?' : ''}${search}`;
  });
  for (const store of mini.stores ?? []) add(() => `store ${JSON.stringify(store.name)}: ${signals(store.signals) || '(empty)'}`);
  for (const page of mini.pages ?? []) {
    add(() => {
      const state = entries(page.state ?? []);
      const label = page.layout ? `layout ${page.name || 'anonymous'}` : `page ${page.path} (${page.name || 'anonymous'})`;
      return `${label}${state ? `: ${state}` : ''}`;
    });
  }

  let components = [];
  try {
    const set = mini.components;
    const doc = win.document;
    const root = doc?.getElementById('app') ?? doc?.body;
    if (set?.size && root) components = findComponents(root, set);
  } catch (err) {
    lines.push(`? components (${message(err)})`);
  }
  for (const [i, [hostEl, depth]] of components.entries()) {
    if (lines.length >= MAX_LINES - 1 && i < components.length - 1) {
      lines.push(`…${components.length - i} more components`);
      break;
    }
    add(() => componentLine(hostEl, depth));
  }

  if (!lines.length) return '(no pages, stores or components recorded)';
  return lines.map((line) => cut(line, MAX_LINE)).join('\n');
}
