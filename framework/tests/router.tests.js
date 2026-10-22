// router tests. Called by index.html with the shared helpers.

import { createRouter } from '../mini/router.js';
import { html } from '../mini/html.js';
import { root, signal } from '../mini/signal.js';

/** @param {any} t */
export default async function (t) {
  const { test, eq, mount, waitUntil, expectWarning, sandbox } = t;
  const until = (check) => waitUntil(check, 2000);
  const start = location.pathname;
  const startUrl = location.pathname + location.search + location.hash;
  const text = () => sandbox.querySelector('#outlet').textContent;

  // Every test gets a fresh router and leaves the URL as it found it.
  async function withRouter(routes, options, fn) {
    const router = createRouter(routes, { transitions: false, prefetch: false, ...options });
    try {
      root(() => mount(html`<div id="outlet">${router.view}</div>`));
      await fn(router);
    } finally {
      router.dispose();
      history.replaceState(null, '', startUrl);
    }
  }

  await test('router: query follows the URL; setQuery merges without re-rendering the page', async () => {
    history.replaceState(null, '', `${start}?a=1`);
    let renders = 0;
    const routes = {
      [start]: () => (renders++, html`<p>start</p>`),
      '/__mini/q/other': () => 'other',
      '*': () => 'not found',
    };
    await withRouter(routes, {}, async (router) => {
      mount(html`<p id="qa">${() => router.query.value.a ?? '-'}</p>`);
      const qa = () => sandbox.querySelector('#qa').textContent;
      eq(router.query.value.a, '1');
      eq(qa(), '1');

      router.setQuery({ b: '2' });
      eq(location.search, '?a=1&b=2');
      eq(router.query.value.b, '2');
      router.setQuery({ a: null });
      eq(location.search, '?b=2');
      eq(qa(), '-');
      router.setQuery({ b: '' });
      eq(location.search, '');
      eq(renders, 1);

      // Same page, new query: the query updates, the page doesn't re-render.
      router.navigate(`${start}?a=9`);
      eq(location.search, '?a=9');
      eq(qa(), '9');
      eq(renders, 1);

      // A pushed query change, then back: popstate restores the old query.
      router.setQuery({ a: '10' }, { replace: false });
      eq(qa(), '10');
      history.back();
      await until(() => qa() === '9');
      eq(renders, 1);

      router.navigate('/__mini/q/other?x=1');
      await until(() => text() === 'other');
      eq(router.query.value.x, '1');
      eq(router.query.value.a, undefined);
    });
  });

  await test('router: redirects and guards on first load, navigate, links and back/forward', async () => {
    let loggedIn = false;
    const seen = [];
    const routes = {
      [start]: () => 'start',
      '/__mini/g/old': { redirect: '/__mini/g/new' },
      '/__mini/g/u/:id': { redirect: ({ id }) => `/__mini/g/user/${id}` },
      '/__mini/g/user/:id': ({ id }) => `user ${id}`,
      '/__mini/g/new': () => 'new',
      '/__mini/g/private': { view: () => 'secret', auth: true },
      '/__mini/g/login': () => 'login',
      '*': () => 'not found',
    };
    const guard = (to) => {
      seen.push(to);
      return to.route.auth && !loggedIn ? `/__mini/g/login?next=${encodeURIComponent(to.path)}` : true;
    };
    history.replaceState(null, '', '/__mini/g/old?keep=1');
    await withRouter(routes, { guard }, async (router) => {
      // First load: replaced, not pushed.
      eq(location.pathname, '/__mini/g/new');
      eq(text(), 'new');

      router.navigate('/__mini/g/u/7');
      await until(() => text() === 'user 7');
      eq(location.pathname, '/__mini/g/user/7');

      // The guard sees path, params, query and the route's own options.
      router.navigate('/__mini/g/user/8?tab=2');
      await until(() => text() === 'user 8');
      const last = seen.at(-1);
      eq(last.path, '/__mini/g/user/8');
      eq(last.params.id, '8');
      eq(last.query.tab, '2');
      eq(last.route.pattern, '/__mini/g/user/:id');

      // A link click is guarded too.
      mount(html`<a id="priv" href="/__mini/g/private">private</a>`);
      sandbox.querySelector('#priv').click();
      await until(() => text() === 'login');
      eq(location.pathname, '/__mini/g/login');
      eq(router.query.value.next, '/__mini/g/private');

      // Back/forward (popstate) is guarded.
      history.pushState(null, '', '/__mini/g/private');
      dispatchEvent(new PopStateEvent('popstate'));
      await until(() => location.pathname === '/__mini/g/login');

      loggedIn = true;
      router.navigate('/__mini/g/private');
      await until(() => text() === 'secret');
    });
  });

  await test('router: a redirect loop stops and warns (W020)', async () => {
    const routes = {
      [start]: () => 'start',
      '/__mini/loop/a': { redirect: '/__mini/loop/b' },
      '/__mini/loop/b': { redirect: '/__mini/loop/a' },
      '*': () => 'not found',
    };
    await withRouter(routes, {}, async (router) => {
      await expectWarning(/W020/, () => router.navigate('/__mini/loop/a'));
    });
  });

  await test('router: a guard that returns neither true nor a path warns (W022)', async () => {
    const routes = { [start]: () => 'start', '/__mini/w22': () => 'w22', '*': () => 'not found' };
    await withRouter(routes, { guard: (to) => to.path !== '/__mini/w22' || false }, async (router) => {
      await expectWarning(/W022/, async () => {
        router.navigate('/__mini/w22');
        await until(() => text() === 'w22'); // anything but a string lets the navigation through
      });
    });
  });

  await test('router: scroll is saved per entry and restored on back/forward; #hash links scroll to it', async () => {
    const before = history.scrollRestoration;
    const tall = (label) => () => html`<p>${label}</p><div style="height:3000px"></div><p id="target">target</p><div style="height:3000px"></div>`;
    const routes = { [start]: tall('start'), '/__mini/s/a': tall('a'), '/__mini/s/b': tall('b'), '*': () => 'not found' };
    sandbox.style.display = 'block';
    try {
      await withRouter(routes, {}, async (router) => {
        eq(history.scrollRestoration, 'manual');
        await until(() => text().startsWith('start'));
        scrollTo(0, 500);
        router.navigate('/__mini/s/a');
        await until(() => text().startsWith('a'));
        eq(scrollY, 0);
        scrollTo(0, 300);
        dispatchEvent(new Event('scroll')); // a busy headless browser may not fire it on its own
        await until(() => history.state?.scroll === 300); // saved shortly after scrolling stops
        history.back();
        await until(() => text().startsWith('start') && scrollY === 500).catch((e) => {
          throw new Error(`${e.message} (text ${text().slice(0, 10)}, scrollY ${scrollY}, state ${JSON.stringify(history.state)})`);
        });
        history.forward();
        await until(() => text().startsWith('a') && scrollY === 300);

        // A link to another page's #id scrolls to that element once the page is shown.
        mount(html`<a id="hashlink" href="/__mini/s/b#target">b</a>`);
        sandbox.querySelector('#hashlink').click();
        await until(() => text().startsWith('b'));
        const top = sandbox.querySelector('#target').getBoundingClientRect().top;
        if (Math.abs(top) > 2) throw new Error(`#target should be at the top, is at ${top}`);
      });
      eq(history.scrollRestoration, before);
    } finally {
      sandbox.style.display = '';
      scrollTo(0, 0);
    }
  });

  await test('router: pages sharing a layout keep the layout mounted', async () => {
    let shellRuns = 0;
    let pageRuns = 0;
    const count = signal(0);
    const shell = (page) => {
      shellRuns++;
      const clicks = signal(0);
      return html`<div class="shell"><input id="li"><button id="lb" @click=${() => clicks.value++}>${clicks}</button><div id="inner">${page}</div></div>`;
    };
    const other = (page) => html`<section class="other">${page}</section>`;
    const routes = {
      [start]: () => 'home',
      '/__mini/l/a': { layout: shell, view: () => (pageRuns++, html`<p>A ${count.value}</p>`) },
      '/__mini/l/b': { layout: shell, view: () => (pageRuns++, 'B') },
      // Two lazy layouts that load the same module share the layout too.
      '/__mini/l/c': { layout: { load: () => Promise.resolve({ default: other }) }, view: () => 'C' },
      '/__mini/l/d': { layout: { load: () => Promise.resolve({ default: other }) }, load: () => Promise.resolve({ default: () => 'D' }) },
      '*': () => 'not found',
    };
    await withRouter(routes, {}, async (router) => {
      router.navigate('/__mini/l/a');
      await until(() => sandbox.querySelector('#inner')?.textContent === 'A 0');
      const input = sandbox.querySelector('#li');
      input.value = 'typed';
      sandbox.querySelector('#lb').click();
      eq(sandbox.querySelector('#lb').textContent, '1');
      eq(pageRuns, 1);

      count.value = 1; // read in the page body: untracked, so nothing re-renders
      eq(pageRuns, 1);
      eq(shellRuns, 1);

      router.navigate('/__mini/l/b');
      await until(() => sandbox.querySelector('#inner')?.textContent === 'B');
      eq(sandbox.querySelector('#li'), input);
      eq(input.value, 'typed');
      eq(sandbox.querySelector('#lb').textContent, '1');
      eq(shellRuns, 1);
      eq(pageRuns, 2);

      router.navigate(start);
      await until(() => text() === 'home');
      eq(sandbox.querySelector('.shell'), null);

      router.navigate('/__mini/l/a');
      await until(() => sandbox.querySelector('#inner')?.textContent === 'A 1');
      eq(shellRuns, 2);
      eq(pageRuns, 3);

      router.navigate('/__mini/l/c');
      await until(() => sandbox.querySelector('.other')?.textContent === 'C');
      const section = sandbox.querySelector('.other');
      eq(sandbox.querySelector('.shell'), null);
      router.navigate('/__mini/l/d');
      await until(() => sandbox.querySelector('.other')?.textContent === 'D');
      eq(sandbox.querySelector('.other'), section);
    });
  });

  await test('router: warns about a layout that is not a function or { load } (W021)', () =>
    expectWarning(/W021/, () => {
      // @ts-expect-error: a wrong layout on purpose
      createRouter({ '/__mini/w21': { layout: 'shell', view: () => 'x' }, '*': () => 'nf' }, { prefetch: false }).dispose();
    }));

  await test('router: a page that throws shows an error view, and Try again renders it again', async () => {
    let fail = true;
    const logged = [];
    const consoleError = console.error;
    console.error = (...args) => logged.push(args.join(' '));
    try {
      const routes = {
        [start]: () => {
          if (fail) throw new Error('page broke');
          return html`<p>page ok</p>`;
        },
        '*': () => 'nf',
      };
      await withRouter(routes, {}, async () => {
        await until(() => text().includes('page broke'));
        eq(sandbox.querySelector('#outlet [role="alert"] h1').textContent, "This page didn't load");
        eq(logged.some((l) => l.includes('page broke')), true);
        fail = false;
        sandbox.querySelector('#outlet button').click();
        await until(() => text().includes('page ok'));
      });
    } finally {
      console.error = consoleError;
    }
  });

  await test('router: a later error in a page hole shows the error view', async () => {
    const boom = signal(false);
    const consoleError = console.error;
    console.error = () => {};
    try {
      const routes = {
        [start]: () => html`<p>${() => { if (boom.value) throw new Error('hole broke'); return 'fine'; }}</p>`,
        '*': () => 'nf',
      };
      await withRouter(routes, {}, async () => {
        await until(() => text().includes('fine'));
        boom.value = true;
        await until(() => text().includes('hole broke'));
      });
    } finally {
      console.error = consoleError;
    }
  });

  await test('router: ready resolves once the first page can render', async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const routes = { [start]: { load: () => gate.then(() => ({ default: () => html`<p>loaded</p>` })) }, '*': () => 'nf' };
    await withRouter(routes, {}, async (router) => {
      let done = false;
      router.ready.then(() => (done = true));
      await new Promise((r) => setTimeout(r, 20));
      eq(done, false);
      release();
      await router.ready;
      await until(() => text().includes('loaded'));
    });
  });
}
