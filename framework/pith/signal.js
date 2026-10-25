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

let currentEffect = null; // effect whose reads are being tracked
let currentOwner = null;  // what owns effects/cleanups created now: an Effect, or a root's array (see drop)
let currentHandler = null; // nearest catchError handler: { fn, parent }
let batchDepth = 0;
let flushing = false;
// Effects waiting to run, a Set per level (see read), so a flush finds the lowest level without a scan.
let pending = [], waiting = 0, low = 0;
const queue = (e) => {
  const set = (pending[e.lv] ??= new Set());
  if (!set.has(e)) set.add(e), waiting++, e.lv < low && (low = e.lv);
};

// Signals, computeds and effects are classes: their methods live on the prototype, and the sets they need
// are made on first use, so a signal is a small object (thousands of them make a sheet or a live list).

/**
 * Read s (a signal or computed) in the current effect: subscribe it and lift it above s's level.
 * Levels keep updates in order: an effect sits one above the deepest computed it read (a plain signal has
 * none), and a nested effect starts above its parent. A flush runs the lowest level first, so a value is
 * computed once, after everything it reads (no half-updated reads, no repeats), and a parent goes before
 * the children it may remove. Nothing recurses, so a chain of computeds can be any length.
 */
function read(s) {
  const e = currentEffect;
  if (e) {
    track(s.subs ??= new Map());
    if (s.lv >= e.lv) e.lv = s.lv + 1;
  }
  return s.v;
}

function write(s, next) {
  if (Object.is(next, s.v)) return;
  s.v = next;
  if (s.subs) {
    for (const e of s.subs.keys()) queue(e);
    if (!batchDepth) flush();
  }
}

class Value {
  constructor(v) {
    this.v = v;
    this.subs = null; // the effects that read it, each with the number of its run that last did (see track)
  }
  get value() { return read(this); }
  set value(next) { write(this, next); }
  peek() { return this.v; }
}

/**
 * A reactive value. Reading .value inside an effect/template subscribes; writing notifies.
 * @template T
 * @param {T} initial
 * @returns {Signal<T>}
 */
export function signal(initial) {
  if (DEV && recording()) return record('signal', silently(() => signal(initial)));
  return /** @type {any} */ (new Value(initial));
}

// lv: its level (see read). It only goes up, which keeps it above everything it ever read.
// deps: the readers maps (signals' subs) of what it read; made on first read.
// children: effects and cleanups made while it ran (it's their owner, see push); made on first use.
// cleanup: what its fn returned. fn is null once it's disposed.
class Effect {
  constructor(fn) {
    this.fn = fn;
    this.deps = null;
    this.ran = 0;
    this.children = null;
    this.handler = currentHandler;
    this.lv = currentEffect ? currentEffect.lv + 1 : 0;
    if (currentOwner) currentOwner.push(this);
  }
  push(child) { (this.children ??= []).push(child); } // as an owner, like root's array
  /** @returns {any} true: don't run now (see Computed) */
  skip() { return false; }
  exec() { return this.fn(); }
  run() {
    if (!this.fn || this.skip()) return;
    reset(this);
    const n = ++this.ran;
    const prevEffect = currentEffect, prevOwner = currentOwner, prevHandler = currentHandler;
    currentEffect = currentOwner = this;
    currentHandler = this.handler;
    let failed = false, err;
    try {
      this.cleanup = this.exec();
    } catch (x) {
      failed = true;
      err = x;
    } finally {
      currentEffect = prevEffect;
      currentOwner = prevOwner;
      currentHandler = prevHandler;
      // Leave only what this run didn't read: what it read again stays subscribed (no churn for a formula
      // that reads 1,000 cells each time).
      const deps = this.deps;
      if (deps) {
        let kept = 0;
        for (const subs of deps) if (subs.get(this) === n) deps[kept++] = subs; else subs.delete(this);
        deps.length = kept;
      }
    }
    if (failed) handle(err, this.handler); // no catchError around it: handle rethrows
  }
  dispose() {
    if (!this.fn) return;
    this.fn = null;
    reset(this);
    if (this.deps) for (const subs of this.deps) subs.delete(this);
    this.deps = null;
  }
}

// A computed is the effect that works out its value, and a signal its readers read. A change that finds no
// reader (an off-screen cell, a row that's gone) only marks it stale: it stays subscribed, so what it reads
// keeps a reader and stays fresh, and the next read works it out (never more than one level deep). The
// first run is eager. Its level as an effect is the level its readers sit above.
class Computed extends Effect {
  constructor(fn) {
    super(fn);
    this.v = undefined;
    this.subs = null;
    this.stale = 0; // 1: a change found no reader; 2: catching up on a read
    this.run();
  }
  skip() { return (this.stale = this.ran && this.stale < 2 && !this.subs?.size ? 1 : 0); }
  exec() { write(this, this.fn()); }
  get value() { return read(fresh(this)); }
  peek() { return fresh(this).v; }
}
const fresh = (c) => (c.stale && ((c.stale = 2), c.run()), c);

/**
 * A read-only signal derived from other signals.
 * @template T
 * @param {() => T} fn
 * @returns {ReadonlySignal<T>}
 */
export function computed(fn) {
  if (DEV && recording()) return record('computed', silently(() => computed(fn)));
  return /** @type {any} */ (new Computed(fn));
}

/**
 * Run fn now and again whenever a signal it read changes. fn may return a cleanup.
 * @param {() => void | (() => void)} fn
 * @returns {() => void} dispose
 */
export function effect(fn) {
  const e = watch(fn);
  return () => e.dispose();
}

/** effect() for the framework's own use: no dispose function to make (its owner disposes it). */
export function watch(fn) {
  const e = new Effect(fn);
  e.run();
  return e;
}

// Subscribe the current effect to subs (a signal's readers), and note which run read it.
function track(subs) {
  const e = currentEffect;
  const last = subs.get(e);
  if (last === e.ran) return;
  if (last === undefined) (e.deps ??= []).push(subs);
  subs.set(e, e.ran);
}

// An owner's child: an effect, or a cleanup or dispose function.
const drop = (d) => (typeof d === 'function' ? d() : d.dispose());

// Dispose nested effects and run the user cleanup before a re-run.
function reset(e) {
  if (e.children?.length) for (const d of e.children.splice(0)) drop(d);
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
        throw error('E003', DEV ? 'Effects kept updating each other (infinite loop?). An effect probably writes a signal it also reads.' : '');
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

// Run fn in a new ownership scope with error handler h, tracking nothing. attach: the current owner disposes it too.
function scope(fn, h, attach) {
  const disposers = [];
  const dispose = () => { for (const d of disposers.splice(0)) drop(d); };
  if (attach && currentOwner) currentOwner.push(dispose);
  const prevEffect = currentEffect, prevOwner = currentOwner, prevHandler = currentHandler;
  currentEffect = null;
  currentOwner = disposers;
  currentHandler = h;
  try {
    return fn(dispose);
  } finally {
    currentEffect = prevEffect;
    currentOwner = prevOwner;
    currentHandler = prevHandler;
  }
}

/**
 * Create an ownership scope; call the given dispose to stop every effect made inside.
 * @template T
 * @param {(dispose: () => void) => T} fn
 * @returns {T}
 */
export function root(fn) {
  return scope(fn, currentHandler);
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
  const h = { fn: handler, parent: currentHandler };
  try {
    return scope(fn, h, true);
  } catch (err) {
    handle(err, h);
  }
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
  // An effect leaves its sets when a run doesn't read them, or on dispose; the key goes when its last reader does.
  class Readers extends Map {
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
  watch(() => {
    const next = typeof source === 'function' ? source() : source.value;
    if (next === current) return;
    const prev = current;
    current = next;
    for (const key of [prev, next]) for (const e of readers.get(key)?.keys() ?? []) queue(e);
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

/** @type {(x: unknown) => x is ReadonlySignal<unknown>} */
export const isSignal = (x) => x instanceof Value || x instanceof Computed;
