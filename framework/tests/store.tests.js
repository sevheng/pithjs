// store tests: names in the state output, and keeping a saved store in step across browser tabs.
// Called by index.html with the shared helpers.

import { createStore } from '../mini/store.js';
import { registry } from '../mini/dev.js';
import { html } from '../mini/html.js';

/** @param {any} t */
export default async function (t) {
  const { test, eq, mount, tick, sandbox } = t;
  const KEY = '__mini-store-test';
  // Another tab saving: the browser fires `storage` only in the other tabs, so tests dispatch it.
  const otherTab = (key, newValue) => {
    if (key && newValue != null) localStorage.setItem(key, newValue);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: localStorage }));
  };
  // Each test removes the stores it adds from the state registry, and its saved value.
  async function withStores(fn) {
    const before = registry.stores.length;
    try {
      await fn();
    } finally {
      registry.stores.splice(before);
      localStorage.removeItem(KEY);
    }
  }

  await test('store: the state output names a store by `name`, else by its `persist` key, else "store"', () =>
    withStores(() => {
      createStore({ signedIn: false }, { name: 'session' });
      createStore({ todos: [] }, { persist: KEY });
      createStore({ x: 1 });
      eq(registry.stores.slice(-3).map((s) => s.name).join(), `session,${KEY},store`);
    }));

  await test('store: a saved store takes the values another tab saves', () =>
    withStores(async () => {
      localStorage.removeItem(KEY);
      const store = createStore({ todos: [], filter: 'all' }, { persist: KEY });
      mount(html`<p id="n">${() => store.todos.value.length}</p><i id="f">${store.filter}</i>`);
      otherTab(KEY, JSON.stringify({ todos: [1, 2, 3], filter: 'done', extra: 'ignored' }));
      await tick();
      eq(sandbox.querySelector('#n').textContent, '3');
      eq(sandbox.querySelector('#f').textContent, 'done');
      eq('extra' in store, false);
      // A key missing from the other tab's save goes back to its initial value.
      otherTab(KEY, JSON.stringify({ todos: [1] }));
      await tick();
      eq(store.filter.value, 'all');
      eq(store.todos.value.length, 1);
    }));

  await test('store: other keys, broken JSON and session storage are ignored; clearing resets', () =>
    withStores(async () => {
      localStorage.removeItem(KEY);
      const store = createStore({ count: 1 }, { persist: KEY });
      store.count.value = 5;
      await tick();
      otherTab('__some-other-key', '{"count":9}');
      otherTab(KEY, '{not json');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: '{"count":9}', storageArea: sessionStorage }));
      await tick();
      eq(store.count.value, 5);
      otherTab(null, null); // localStorage.clear() in another tab
      await tick();
      eq(store.count.value, 1);
      localStorage.removeItem('__some-other-key');
    }));

  await test('store: a store without persist ignores other tabs', () =>
    withStores(async () => {
      const store = createStore({ count: 1 });
      otherTab(KEY, '{"count":9}');
      await tick();
      eq(store.count.value, 1);
    }));
}
