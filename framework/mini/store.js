// Shared state: createStore({ a: 1 }) -> { a: signal(1) }, optionally saved to localStorage and kept
// in step across the browser's tabs.

import { signal, effect, root, batch } from './signal.js';
import { DEV, warn, describe, registry, recording, silently } from './dev.js';

const notJson = (v) =>
  typeof v === 'function' || typeof v === 'bigint' || v instanceof Map || v instanceof Set || v instanceof Date;

/**
 * Shared state: each key becomes a signal. With `persist`, values are saved to localStorage, and a save
 * in another tab of the same site updates this one.
 * @template {Record<string, any>} T
 * @param {T} initial
 * @param {{ persist?: string | null, name?: string | null }} [options] persist: the localStorage key ·
 *   name: what `npm run see --state` calls it (default: the persist key, else "store")
 * @returns {{ [K in keyof T]: import('./signal.js').Signal<T[K]> }}
 */
export function createStore(initial, { persist = null, name = persist } = {}) {
  // Its signals belong to the store, not to the component whose setup made it.
  if (DEV && recording()) return silently(() => createStore(initial, { persist, name }));
  let saved = {};
  if (persist) {
    try {
      saved = JSON.parse(localStorage.getItem(persist)) ?? {};
    } catch {
      saved = {};
    }
  }

  /** @type {any} */
  const store = {};
  for (const key of Object.keys(initial)) {
    if (persist && notJson(initial[key])) {
      DEV && warn('W014', `Store "${persist}": "${key}" is ${describe(initial[key])}, which doesn't survive saving to localStorage. Use plain objects, arrays, strings or numbers.`);
    }
    store[key] = signal(Object.hasOwn(saved, key) ? saved[key] : initial[key]);
  }

  if (persist) {
    // Owned by its own root so no component unmount can stop the saving.
    root(() =>
      effect(() => {
        const snapshot = {};
        for (const key in store) snapshot[key] = store[key].value;
        try {
          localStorage.setItem(persist, JSON.stringify(snapshot));
        } catch {
          // storage full or blocked (private mode): keep working in memory
        }
      })
    );
    // Another tab saved (the browser tells only the other tabs; an unchanged save tells no one, so two
    // tabs can't ping-pong). key null: that tab cleared localStorage. Keys it lacks go back to initial.
    addEventListener('storage', (e) => {
      if (e.storageArea !== localStorage || (e.key !== persist && e.key !== null)) return;
      let next;
      try {
        next = (e.key && JSON.parse(e.newValue)) || initial;
      } catch {
        return;
      }
      batch(() => {
        for (const key in store) store[key].value = Object.hasOwn(next, key) ? next[key] : initial[key];
      });
    });
  }
  DEV && registry.stores.push({ name: name || 'store', signals: store });
  return store;
}
