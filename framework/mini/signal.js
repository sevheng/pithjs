// Fine-grained reactivity: signals hold values, effects re-run when the signals they read change.

import { DEV, error, recording, record, silently } from './dev.js';

/**
 * @template T
 * @typedef {{ value: T, peek(): T }} Signal  read .value to track it, write .value to update
 */
/**
 * @template T
 * @typedef {{ readonly value: T, peek(): T }} ReadonlySignal
 */

const SIGNAL = Symbol('signal');

let currentEffect = null; // effect whose reads are being tracked
let currentOwner = null;  // array collecting disposers for effects/cleanups created now
let currentHandler = null; // nearest catchError handler: { fn, parent }
let batchDepth = 0;
let flushing = false;
const pending = new Set();

/**
 * A reactive value. Reading .value inside an effect/template subscribes; writing notifies.
 * @template T
 * @param {T} initial
 * @returns {Signal<T>}
 */
export function signal(initial) {
  if (DEV && recording()) return record('signal', silently(() => signal(initial)));
  let value = initial;
  const subscribers = new Set();
  return mark({
    get value() {
      if (currentEffect) {
        subscribers.add(currentEffect);
        currentEffect.deps.add(subscribers);
      }
      return value;
    },
    set value(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const e of subscribers) pending.add(e);
      if (!batchDepth) flush();
    },
    peek: () => value,
  });
}

/**
 * A read-only signal derived from other signals.
 * @template T
 * @param {() => T} fn
 * @returns {ReadonlySignal<T>}
 */
export function computed(fn) {
  if (DEV && recording()) return record('computed', silently(() => computed(fn)));
  const s = signal(undefined);
  effect(() => { s.value = fn(); });
  return mark({
    get value() { return s.value; },
    peek: () => s.peek(),
  });
}

/**
 * Run fn now and again whenever a signal it read changes. fn may return a cleanup.
 * @param {() => void | (() => void)} fn
 * @returns {() => void} dispose
 */
export function effect(fn) {
  const e = { deps: new Set(), children: [], cleanup: null, disposed: false, run, handler: currentHandler };

  function run() {
    if (e.disposed) return;
    reset(e);
    const prevEffect = currentEffect, prevOwner = currentOwner, prevHandler = currentHandler;
    currentEffect = e;
    currentOwner = e.children;
    currentHandler = e.handler;
    let failed = false, err;
    try {
      e.cleanup = fn();
    } catch (x) {
      if (!e.handler) throw x; // no catchError around it: behave as before
      failed = true;
      err = x;
    } finally {
      currentEffect = prevEffect;
      currentOwner = prevOwner;
      currentHandler = prevHandler;
    }
    if (failed) handle(err, e.handler);
  }

  const dispose = () => {
    if (e.disposed) return;
    e.disposed = true;
    reset(e);
  };
  if (currentOwner) currentOwner.push(dispose);
  run();
  return dispose;
}

// Drop subscriptions, dispose nested effects and run the user cleanup before a re-run.
function reset(e) {
  for (const subs of e.deps) subs.delete(e);
  e.deps.clear();
  for (const dispose of e.children.splice(0)) dispose();
  if (typeof e.cleanup === 'function') {
    const cleanup = e.cleanup;
    e.cleanup = null;
    cleanup();
  }
}

function flush() {
  if (flushing) return;
  flushing = true;
  let rounds = 0;
  try {
    while (pending.size) {
      if (++rounds > 1000) {
        pending.clear();
        throw error('E003', 'Effects kept updating each other (infinite loop?). An effect probably writes a signal it also reads.');
      }
      const queue = [...pending];
      pending.clear();
      for (const e of queue) e.run();
    }
  } finally {
    flushing = false;
  }
}

/**
 * Apply several signal writes, then run affected effects once.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function batch(fn) {
  batchDepth++;
  try {
    return fn();
  } finally {
    if (--batchDepth === 0) flush();
  }
}

/**
 * Create an ownership scope; call the given dispose to stop every effect made inside.
 * @template T
 * @param {(dispose: () => void) => T} fn
 * @returns {T}
 */
export function root(fn) {
  const disposers = [];
  const prevEffect = currentEffect, prevOwner = currentOwner;
  currentEffect = null;
  currentOwner = disposers;
  const dispose = () => { for (const d of disposers.splice(0)) d(); };
  try {
    return fn(dispose);
  } finally {
    currentEffect = prevEffect;
    currentOwner = prevOwner;
  }
}

/**
 * Run fn in an ownership scope (disposed with the current owner, or by the given dispose).
 * Errors thrown by fn, or later by effects/computeds created inside it, go to handler.
 * A handler that throws passes the error to the next catchError out; with none, it throws.
 * @template T
 * @param {(dispose: () => void) => T} fn
 * @param {(err: unknown) => void} handler
 * @returns {T | undefined} fn's result, or undefined if it threw
 */
export function catchError(fn, handler) {
  const disposers = [];
  const dispose = () => { for (const d of disposers.splice(0)) d(); };
  if (currentOwner) currentOwner.push(dispose);
  const h = { fn: handler, parent: currentHandler };
  const prevEffect = currentEffect, prevOwner = currentOwner, prevHandler = currentHandler;
  currentEffect = null;
  currentOwner = disposers;
  currentHandler = h;
  let failed = false, err, result;
  try {
    result = fn(dispose);
  } catch (x) {
    failed = true;
    err = x;
  } finally {
    currentEffect = prevEffect;
    currentOwner = prevOwner;
    currentHandler = prevHandler;
  }
  if (failed) handle(err, h);
  return result;
}

/**
 * Wrap an event handler so its errors (thrown, or a rejected promise from an async handler) go to the
 * catchError around the code that attached it, like errors in effects do. With none, fn is returned as is.
 * @template {Function} F
 * @param {F} fn
 * @returns {F}
 */
export function catching(fn) {
  const h = currentHandler;
  if (!h) return fn;
  return /** @type {any} */ (function (...args) {
    try {
      const result = fn.apply(this, args);
      if (typeof result?.then === 'function') result.then(undefined, (err) => handle(err, h));
      return result;
    } catch (err) {
      handle(err, h);
    }
  });
}

// Give err to handler h; if h throws, the next handler out gets that error.
function handle(err, h) {
  if (!h) throw err;
  const prev = currentHandler;
  currentHandler = h.parent; // errors from the handler's own effects go further out
  let next;
  try {
    h.fn(err);
    return;
  } catch (x) {
    next = x;
  } finally {
    currentHandler = prev;
  }
  handle(next, h.parent);
}

/**
 * A cheap "is this the one?" for lists: isSelected(key) is true when source's value equals key. When the
 * source changes, only the two keys whose answer changed re-run their effects (the old and the new one),
 * not every row: `const isSelected = selector(selected)` then `class=${() => isSelected(row.id) ? ...}`.
 * @template K
 * @param {ReadonlySignal<K> | (() => K)} source
 * @returns {((key: K) => boolean) & { size: () => number }} size: keys being tracked (for tests)
 */
export function selector(source) {
  const keys = new Map(); // key -> { flag: signal(boolean), readers }
  let current;
  effect(() => {
    const next = typeof source === 'function' ? source() : source.value;
    if (next === current) return;
    const prev = current;
    current = next;
    untrack(() => batch(() => {
      const old = keys.get(prev);
      if (old) old.flag.value = false;
      const now = keys.get(next);
      if (now) now.flag.value = true;
    }));
  });
  const isSelected = (key) => {
    let entry = keys.get(key);
    if (!entry) keys.set(key, (entry = { flag: signal(key === current), readers: 0 }));
    if (currentEffect) {
      entry.readers++;
      onCleanup(() => --entry.readers || keys.delete(key)); // the last reader is gone
    }
    return entry.flag.value;
  };
  isSelected.size = () => keys.size;
  return isSelected;
}

/**
 * Read signals without subscribing the current effect.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function untrack(fn) {
  const prev = currentEffect;
  currentEffect = null;
  try {
    return fn();
  } finally {
    currentEffect = prev;
  }
}

/**
 * Run fn when the current effect re-runs or its owner (component, root) is disposed.
 * @param {() => void} fn
 */
export function onCleanup(fn) {
  if (currentOwner) currentOwner.push(fn);
}

/**
 * @template O
 * @param {O} obj
 * @returns {O}
 */
function mark(obj) {
  Object.defineProperty(obj, SIGNAL, { value: true });
  return obj;
}

/** @type {(x: unknown) => x is ReadonlySignal<unknown>} */
export const isSignal = (x) => x != null && x[SIGNAL] === true;
