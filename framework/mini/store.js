// Shared state: createStore({ a: 1 }) -> { a: signal(1) }, optionally saved to localStorage.

import { signal, effect, root } from './signal.js';
import { DEV, warn, describe } from './dev.js';

const notJson = (v) =>
  typeof v === 'function' || typeof v === 'bigint' || v instanceof Map || v instanceof Set || v instanceof Date;

/**
 * Shared state: each key becomes a signal. With `persist`, values are saved to localStorage.
 * @template {Record<string, any>} T
 * @param {T} initial
 * @param {{ persist?: string | null }} [options] persist: the localStorage key
 * @returns {{ [K in keyof T]: import('./signal.js').Signal<T[K]> }}
 */
export function createStore(initial, { persist = null } = {}) {
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
  }
  return store;
}
