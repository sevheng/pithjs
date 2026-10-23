// state-record tests: what the core records in globalThis.__mini (dev only). Called by index.html.

import { signal, computed, root } from '../mini/signal.js';
import { html } from '../mini/html.js';
import { define } from '../mini/component.js';
import { createStore } from '../mini/store.js';
import { createRouter } from '../mini/router.js';
import { resource, paginated } from '../mini/resource.js';
import { form } from '../mini/form.js';
import { registry } from '../mini/dev.js';

/** @param {any} t */
export default async function (t) {
  const { test, eq, mount, tick, waitUntil, sandbox } = t;
  const until = (check) => waitUntil(check, 2000);
  const shape = (state) => state.map(([name, kind]) => `${name}:${kind}`).join(' ');

  await test('state-record: the registry is on the window in dev', () => {
    eq(globalThis.__mini, registry);
    eq(registry.components instanceof Set, true);
  });

  await test('state-record: a component records its state by name, without internal signals, and its props', async () => {
    /** @type {any} */
    let made;
    define('rec-state', (props) => {
      const draft = signal('');
      const upper = computed(() => draft.value.toUpperCase());
      const people = resource(async () => ['ada']);
      const signup = form({ initial: { email: '' } });
      made = { draft, upper, people, signup };
      return html`<p>${upper}</p>${signup.input('email', { label: 'Email' })}${people.render((p) => p.join())}`;
    }, { props: ['title'] });
    root(() => mount(html`<rec-state title="Hi"></rec-state>`));
    const host = sandbox.querySelector('rec-state');
    eq(registry.components.has(host), true);
    const s = host.__miniState;
    eq(s.tag, 'rec-state');
    eq(s.props, host._props);
    eq(s.props.title.value, 'Hi');
    eq(shape(s.state), 'draft:signal upper:computed people:resource signup:form');
    eq(s.state[0][2], made.draft);
    eq(s.state[1][2], made.upper);
    eq(s.state[2][2], made.people);
    eq(s.state[3][2], made.signup);

    host.remove();
    await tick();
    eq(registry.components.has(host), false);
  });

  await test('state-record: nested components get their own state; paginated is one entry', async () => {
    define('rec-child', () => {
      const open = signal(false);
      return html`<i>${() => (open.value ? 'open' : 'closed')}</i>`;
    }, { props: ['label'] });
    define('rec-parent', () => {
      const list = paginated(async () => [1, 2]);
      return html`<rec-child label="x"></rec-child>${list.render((items) => items.length)}`;
    });
    root(() => mount(html`<rec-parent></rec-parent>`));
    const parent = sandbox.querySelector('rec-parent');
    const child = sandbox.querySelector('rec-child');
    eq(shape(parent.__miniState.state), 'list:paginated');
    eq(shape(child.__miniState.state), 'open:signal');
    eq(child.__miniState.props.label.value, 'x');
    parent.remove();
    await tick();
    eq(registry.components.has(parent) || registry.components.has(child), false);
  });

  await test('state-record: after a failed setup, Try again records the state of the new run', async () => {
    let runs = 0;
    /** @type {any} */
    let retry;
    define('rec-retry', () => {
      const attempt = signal(++runs);
      if (runs === 1) throw new Error('first run fails');
      return html`<p>${attempt}</p>`;
    }, { fallback: (_err, again) => ((retry = again), html`<p>failed</p>`) });
    root(() => mount(html`<rec-retry></rec-retry>`));
    const host = sandbox.querySelector('rec-retry');
    eq(registry.components.has(host), false); // showing the fallback: its state was disposed
    retry();
    eq(registry.components.has(host), true);
    eq(shape(host.__miniState.state), 'attempt:signal');
    eq(host.__miniState.state[0][2].peek(), 2);
  });

  await test('state-record: names fall back to kind#n when the counts in the source do not match', () => {
    define('rec-loop', () => {
      const one = signal(1);
      const many = [1, 2].map((n) => signal(n));
      const total = computed(() => one.value + many.length);
      return html`<p>${total}</p>`;
    });
    root(() => mount(html`<rec-loop></rec-loop>`));
    const state = sandbox.querySelector('rec-loop').__miniState.state;
    // 3 signals ran but the source names only one (signal(n) in the map has no name): no guessing.
    eq(shape(state), 'signal#1:signal signal#2:signal signal#3:signal total:computed');
  });

  await test('state-record: a store is recorded by its persist key, or as "store"', () => {
    const before = registry.stores.length;
    const plain = createStore({ a: 1 });
    const saved = createStore({ todos: [] }, { persist: '__mini-rec-test' });
    try {
      const added = registry.stores.slice(before);
      eq(added.length, 2);
      eq(added[0].name, 'store');
      eq(added[0].signals, plain);
      eq(added[1].name, '__mini-rec-test');
      eq(added[1].signals.todos, saved.todos);
    } finally {
      registry.stores.splice(before);
      localStorage.removeItem('__mini-rec-test');
    }
  });

  await test('state-record: a store made inside a setup is not listed as the component\'s state', () => {
    const before = registry.stores.length;
    try {
      define('rec-store', () => {
        const local = createStore({ x: 1 });
        const count = signal(0);
        return html`<p>${count}${local.x}</p>`;
      });
      root(() => mount(html`<rec-store></rec-store>`));
      eq(shape(sandbox.querySelector('rec-store').__miniState.state), 'count:signal');
    } finally {
      registry.stores.splice(before);
    }
  });

  await test('state-record: the router and the current page are recorded, replaced on navigation', async () => {
    const startUrl = location.pathname + location.search + location.hash;
    const start = location.pathname;
    const prevRouter = registry.router, prevPages = registry.pages;
    function StartPage() {
      const query = signal('ada');
      const people = resource(async () => []);
      return html`<p>start ${query}</p>${people.render(() => '')}`;
    }
    function OtherPage() {
      const step = signal(1);
      return html`<p>other ${step}</p>`;
    }
    const router = createRouter({ [start]: StartPage, '/__mini/rec/other': OtherPage, '*': () => 'nf' },
      { transitions: false, prefetch: false });
    try {
      eq(registry.router.path, router.path);
      eq(registry.router.search.value, location.search);
      // The app shell's own state must not pick up the router's internal signals.
      define('rec-app', () => {
        const theme = signal('dark');
        return html`<div id="outlet" data-theme=${theme}>${router.view}</div>`;
      });
      root(() => mount(html`<rec-app></rec-app>`));
      eq(shape(sandbox.querySelector('rec-app').__miniState.state), 'theme:signal');
      eq(registry.pages.length, 1);
      eq(registry.pages[0].path, start);
      eq(registry.pages[0].name, 'StartPage');
      eq(shape(registry.pages[0].state), 'query:signal people:resource');

      router.navigate('/__mini/rec/other');
      await until(() => sandbox.textContent.includes('other'));
      eq(registry.pages.length, 1);
      eq(registry.pages[0].path, '/__mini/rec/other');
      eq(registry.pages[0].name, 'OtherPage');
      eq(shape(registry.pages[0].state), 'step:signal');
      eq(registry.router.path.value, '/__mini/rec/other');
    } finally {
      router.dispose();
      history.replaceState(null, '', startUrl);
      registry.router = prevRouter;
      registry.pages = prevPages;
    }
  });
}
