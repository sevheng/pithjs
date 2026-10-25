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
// Effects waiting to run, a Set per level (see signal), so a flush finds the lowest level without a scan.
let pending = [], waiting = 0, low = 0;
const queue = (e) => {
  const set = (pending[e.lv] ??= new Set());
  if (!set.has(e)) set.add(e), waiting++, e.lv < low && (low = e.lv);
};

/**
 * A reactive value. Reading .value inside an effect/template subscribes; writing notifies.
 * @template T
 * @param {T} initial
 * @param {any} [subscribers] internal: computed() keeps its own set, to give it a level
 * @returns {Signal<T>}
 */
export function signal(initial, subscribers = new Set()) {
  if (DEV && recording()) return record('signal', silently(() => signal(initial)));
  let value = initial;
  return mark({
    get value() {
      // Levels keep updates in order: an effect sits one above the deepest computed it read (a plain
      // signal has none), and a nested effect starts above its parent. A flush runs the lowest level
      // first, so a value is computed once, after everything it reads (no half-updated reads, no
      // repeats), and a parent goes before the children it may remove. Nothing recurses, so a chain
      // of computeds can be any length.
      if (currentEffect) {
        track(subscribers);
        if (subscribers.lv >= currentEffect.lv) currentEffect.lv = subscribers.lv + 1;
      }
      return value;
    },
    set value(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const e of subscribers) queue(e);
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
  /** @type {any} */
  const subs = new Set();
  const s = signal(undefined, subs);
  // A change that finds no reader (an off-screen cell, a row that's gone) only marks it stale: it stays
  // subscribed, so what it reads keeps a reader and stays fresh, and the next read works it out (never
  // more than one level deep). The first run is eager.
  let ran, stale, pulling;
  const run = /** @type {any} */ (effect)(() => {
    ran = 1;
    s.value = fn();
    subs.lv = currentEffect.lv; // its readers sit above it
  }, () => (stale = ran && !pulling && !subs.size)).run;
  const fresh = () => stale && ((pulling = 1), run(), (pulling = 0));
  return mark({
    get value() { fresh(); return s.value; },
    peek: () => (fresh(), s.peek()),
  });
}

/**
 * Run fn now and again whenever a signal it read changes. fn may return a cleanup.
 * @param {() => void | (() => void)} fn
 * @param {() => any} [skip] internal: computed() skips re-runs nobody reads
 * @returns {() => void} dispose
 */
export function effect(fn, skip) {
  // lv: its level (see signal). It only goes up, which keeps it above everything it ever read.
  // deps: what it read, each with the number of the run that last read it (see track).
  const e = { deps: new Map(), ran: 0, children: [], cleanup: null, disposed: false, run, handler: currentHandler, lv: currentEffect ? currentEffect.lv + 1 : 0 };

  function run() {
    if (e.disposed || skip?.()) return;
    reset(e);
    const n = ++e.ran;
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
      // Leave only what this run didn't read: what it read again stays subscribed (no churn for a formula
      // that reads 1,000 cells each time).
      for (const [subs, last] of e.deps) if (last !== n) subs.delete(e), e.deps.delete(subs);
    }
    if (failed) handle(err, e.handler);
  }

  const dispose = () => {
    if (e.disposed) return;
    e.disposed = true;
    reset(e);
    for (const subs of e.deps.keys()) subs.delete(e);
    e.deps.clear();
  };
  if (currentOwner) currentOwner.push(dispose);
  dispose.run = run; // for computed(), to catch up when read
  run();
  return dispose;
}

// Subscribe the current effect to subs (a signal's set of readers), and note this run read it.
function track(subs) {
  const e = currentEffect;
  if (!e.deps.has(subs)) subs.add(e);
  e.deps.set(subs, e.ran);
}

// Dispose nested effects and run the user cleanup before a re-run.
function reset(e) {
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
  let rounds = 0, last;
  try {
    while (waiting) {
      while (!pending[low]?.size) low++;
      const set = pending[low];
      // In order, the levels only go up. Effects that keep sending it back down are updating each other.
      if (low <= last && ++rounds > 1000) {
        (pending = []), (waiting = low = 0);
        throw error('E003', 'Effects kept updating each other (infinite loop?). An effect probably writes a signal it also reads.');
      }
      last = low;
      for (const e of [...set]) if (set.delete(e)) waiting--, e.run();
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
  const readers = new Map(); // key -> the effects that read isSelected(key), tracked like a signal's
  // An effect leaves its sets on re-run or dispose (see reset); the key goes when its last reader does.
  class Readers extends Set {
    constructor(key) {
      super();
      this.key = key;
    }
    delete(e) {
      const had = super.delete(e);
      if (!this.size) readers.delete(this.key);
      return had;
    }
  }
  let current;
  effect(() => {
    const next = typeof source === 'function' ? source() : source.value;
    if (next === current) return;
    const prev = current;
    current = next;
    for (const key of [prev, next]) for (const e of readers.get(key) ?? []) queue(e);
    if (!batchDepth) flush();
  });
  const isSelected = (key) => {
    if (currentEffect) {
      let set = readers.get(key);
      if (!set) readers.set(key, (set = new Readers(key)));
      track(set);
    }
    return key === current;
  };
  isSelected.size = () => readers.size;
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
