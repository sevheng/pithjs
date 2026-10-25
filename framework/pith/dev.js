// Dev-mode warnings: on for localhost, off everywhere else so production stays quiet.
// Override by setting globalThis.PITH_DEV = true/false before pith is imported.
// Every warning and error has a code; framework/docs/errors.md explains each one and how to fix it.

export const DEV = globalThis.PITH_DEV ?? ['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location?.hostname ?? '');

// Dev only. Read by the test tools (tests/state.js) to print the app's state as text, for
// `npm run see /path --state` and failing user flows. Nothing is recorded in production.
// globalThis.__pith = {
//   components: Set<HTMLElement>,  // mounted Pith components; each host has host.__pithState:
//                                  //   { tag, props: { [name]: Signal }, state: [name, kind, obj][] }
//   pages: [{ path, name, layout?: true, state: [name, kind, obj][] }],  // the current layout (if it holds
//                                  //   state), then the current page
//   stores: [{ name, signals: { [key]: Signal } }],
//   router: { path: Signal<string>, search: Signal<string> } | null,
// }
// kind: 'signal' | 'computed' | 'resource' | 'paginated' | 'form'. obj is the object itself.
export const registry = DEV ? (globalThis.__pith ??= { components: new Set(), pages: [], stores: [], router: null }) : null;

// Dev only: the state a component setup or page function creates. signal(), computed(), resource(),
// paginated() and form() each add one entry; what they (or the framework) create inside is hidden.
// Every call site is behind DEV, so none of this ships.
/** @type {[string, unknown][] | null} */
let collected = null;
let hidden = 0;

/** True when a creation now would be listed (a collector is open and nothing is hiding it). */
export const recording = () => !!collected && !hidden;

/**
 * @template T
 * @param {string} kind
 * @param {T} obj
 * @returns {T}
 */
export function record(kind, obj) {
  if (recording()) collected.push([kind, obj]);
  return obj;
}

/**
 * Run fn without listing what it creates.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function silently(fn) {
  hidden++;
  try {
    return fn();
  } finally {
    hidden--;
  }
}

/**
 * Run fn (a setup or page function) with its own collector, then pass its named state to save,
 * even if fn throws. Nested collectors (a child component's setup) don't mix with this one.
 * @template T
 * @param {Function} owner the function whose source names the state
 * @param {() => T} fn
 * @param {(state: [string, string, unknown][]) => void} save
 * @returns {T}
 */
export function collect(owner, fn, save) {
  const prev = collected, prevHidden = hidden;
  const list = (collected = []);
  hidden = 0;
  try {
    return fn();
  } finally {
    collected = prev;
    hidden = prevHidden;
    save(named(owner, list));
  }
}

// Names come from the owner's source: `const draft = signal(` etc., matched per kind in order, and
// only when the source has exactly as many as were created (a wrong name is worse than signal#2).
const declared = /\b(?:const|let|var)\s+([\w$]+)\s*=\s*(signal|computed|resource|paginated|form)\s*\(/g;
function named(owner, list) {
  /** @type {Record<string, string[]>} */
  const names = {};
  for (const [, name, kind] of String(owner).matchAll(declared)) (names[kind] ??= []).push(name);
  /** @type {Record<string, number>} */
  const total = {}, seen = {};
  for (const [kind] of list) total[kind] = (total[kind] ?? 0) + 1;
  return list.map(([kind, obj]) => {
    const n = (seen[kind] = (seen[kind] ?? 0) + 1);
    return [names[kind]?.length === total[kind] ? names[kind][n - 1] : `${kind}#${n}`, kind, obj];
  });
}

const seen = new Set();

const ref = (code) => `See framework/docs/errors.md#${code.toLowerCase()}`;

// Each distinct message is shown once, so a warning inside a list doesn't flood the console.
export function warn(code, message) {
  const text = `[pith ${code}] ${message} ${ref(code)}`;
  if (!DEV || seen.has(text)) return;
  seen.add(text);
  console.warn(text);
}

// Errors are thrown in every mode: they mean the output would be wrong.
export function error(code, message, Type = Error) {
  const err = new Type(`[pith ${code}] ${message ? `${message} ` : ''}${ref(code)}`);
  return Object.assign(err, { code });
}

export function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return `an object (${value.constructor?.name ?? 'Object'})`;
  if (typeof value === 'string') return `the string "${value.length > 20 ? value.slice(0, 20) + '…' : value}"`;
  return `${typeof value} ${String(value)}`;
}
