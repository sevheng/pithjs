// resource tests. Called by index.html with the shared helpers.

import { resource, paginated, fetchJSON } from '../pith/resource.js';
import { signal, root } from '../pith/signal.js';
import { html, repeat } from '../pith/html.js';

// A promise you settle by hand.
/** @returns {{ promise: Promise<any>, resolve: (v?: any) => void, reject: (e?: any) => void }} */
function deferred() {
  /** @type {any} */
  let resolve;
  /** @type {any} */
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// A fetcher whose calls you settle by hand: calls[i].resolve(value) / .reject(err).
function controllable() {
  const calls = [];
  const fetcher = (ctx) => new Promise((resolve, reject) => calls.push({ ...ctx, resolve, reject }));
  return { calls, fetcher };
}

/** @param {any} t */
export default async function (t) {
  const { test, eq, tick, mount, sandbox, expectWarning } = t;

  // Loads `initial` and returns the ready resource.
  async function loaded(initial) {
    /** @type {any} */
    let r;
    root(() => { r = resource(() => initial); });
    await tick();
    return r;
  }
  const toggle = (id) => (list) => list.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
  const done = (r) => r.data.value.filter((x) => x.done).map((x) => x.id).join();

  // ---------- optimistic ----------

  // The chat case: a message is on its way (optimistic) when another change is saved locally (a reaction).
  await test('mutate(fn): changes the confirmed data, and pending optimistic updates stay on top, once', async () => {
    const r = await loaded([{ id: 1 }]);
    const save = deferred();
    const sending = r.optimistic((list) => [...list, { id: 'temp' }], () => save.promise);
    eq(r.data.value.map((x) => x.id).join(), '1,temp');
    r.mutate((confirmed) => {
      eq(confirmed.map((x) => x.id).join(), '1', 'the function gets the confirmed data, without the pending update');
      return confirmed.map((x) => ({ ...x, liked: true }));
    });
    eq(r.data.value.map((x) => x.id).join(), '1,temp', 'the pending update is applied once, on top');
    eq(r.data.value[0].liked, true);
    save.resolve();
    await sending;
    eq(r.data.value.map((x) => x.id).join(), '1,temp', 'confirmed: still once');
  });

  await test('mutate(value) still replaces the data', async () => {
    const r = await loaded([{ id: 1 }]);
    r.mutate([{ id: 2 }]);
    eq(r.data.value[0].id, 2);
  });

  await test('optimistic: applies the update at once, keeps it when save resolves undefined', async () => {
    const r = await loaded([{ id: 1, done: false }]);
    const save = deferred();
    const p = r.optimistic(toggle(1), () => save.promise);
    eq(done(r), '1');
    save.resolve(undefined);
    await p;
    eq(done(r), '1');
  });

  await test('optimistic: a value from save replaces the data', async () => {
    const r = await loaded([{ id: 1, done: false }]);
    await r.optimistic(toggle(1), async () => [{ id: 1, done: true, server: true }]);
    eq(r.data.value[0].server, true);
  });

  await test('optimistic: a failed save rolls back and rethrows', async () => {
    const r = await loaded([{ id: 1, done: false }]);
    const before = r.data.value;
    /** @type {any} */
    let caught;
    await r.optimistic(toggle(1), async () => { throw new Error('nope'); }).catch((e) => (caught = e));
    eq(caught?.message, 'nope');
    eq(r.data.value, before);
    eq(r.error.value, null); // the error goes to the caller (e.g. form's submitError), not the load error view
  });

  await test('optimistic: concurrent saves - a failure undoes only its own update', async () => {
    const r = await loaded([{ id: 1, done: false }, { id: 2, done: false }]);
    const a = deferred(), b = deferred();
    const pa = r.optimistic(toggle(1), () => a.promise).catch(() => {});
    const pb = r.optimistic(toggle(2), () => b.promise);
    eq(done(r), '1,2');
    b.resolve(undefined); // the later one succeeds first
    await pb;
    a.reject(new Error('down')); // the earlier one fails: 2 stays done
    await pa;
    eq(done(r), '2');

    const c = deferred(), d = deferred();
    const pc = r.optimistic(toggle(1), () => c.promise);
    const pd = r.optimistic(toggle(1), () => d.promise).catch(() => {});
    eq(done(r), '2'); // toggled twice
    d.reject(new Error('down')); // the later one fails: only the earlier toggle remains
    await pd;
    eq(done(r), '1,2');
    c.resolve(undefined);
    await pc;
    eq(done(r), '1,2');
  });

  await test('optimistic: a server value becomes the base, pending updates stay on top', async () => {
    const r = await loaded([{ id: 1, done: false }, { id: 2, done: false }]);
    const a = deferred(), b = deferred();
    const pa = r.optimistic(toggle(1), () => a.promise);
    const pb = r.optimistic(toggle(2), () => b.promise);
    a.resolve([{ id: 1, done: true }, { id: 2, done: false }]); // server doesn't know about 2 yet
    await pa;
    eq(done(r), '1,2');
    b.reject(new Error('down'));
    await pb.catch(() => {});
    eq(done(r), '1');
  });

  await test('optimistic: a refetch that lands mid-save keeps the pending update', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let r;
    root(() => { r = resource(fetcher); });
    calls[0].resolve([{ id: 1, done: false }]);
    await tick();
    const save = deferred();
    const p = r.optimistic(toggle(1), () => save.promise);
    r.refetch();
    calls[1].resolve([{ id: 1, done: false }, { id: 2, done: false }]);
    await tick();
    eq(done(r), '1'); // fresh list, still with the unsaved toggle
    save.reject(new Error('x'));
    await p.catch(() => {});
    eq(done(r), '');
    eq(r.data.value.length, 2);
  });

  // ---------- paginated ----------

  await test('paginated: loads page 1, loadMore appends, short page ends it', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let p;
    root(() => {
      p = paginated(fetcher, { pageSize: 2 });
      mount(html`<ul id="out">${p.render({ loading: () => 'L', ready: (items) => items.map((i) => html`<li>${i}</li>`) })}</ul>`);
    });
    const text = () => sandbox.querySelector('#out').textContent;
    eq(text(), 'L');
    eq(calls[0].page, 1);
    eq(p.loading.value, true);
    calls[0].resolve(['a', 'b']);
    await tick();
    eq(text(), 'ab');
    eq(p.hasMore.value, true);
    eq(p.loading.value, false);

    p.loadMore();
    eq(calls[1].page, 2);
    eq(p.loadingMore.value, true);
    p.loadMore(); // no-op while loading
    eq(calls.length, 2);
    calls[1].resolve(['c']);
    await tick();
    eq(text(), 'abc');
    eq(p.items.value.join(), 'a,b,c');
    eq(p.hasMore.value, false);
    eq(p.loadingMore.value, false);
    p.loadMore(); // nothing more
    eq(calls.length, 2);
  });

  await test('paginated: { items, next } pages, next is passed back', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let p;
    root(() => { p = paginated(fetcher); });
    calls[0].resolve({ items: [1, 2], next: 'cur2' });
    await tick();
    eq(p.hasMore.value, true);
    p.loadMore();
    eq(calls[1].page, 2);
    eq(calls[1].next, 'cur2');
    calls[1].resolve({ items: [3], next: null });
    await tick();
    eq(p.items.value.join(), '1,2,3');
    eq(p.hasMore.value, false);
  });

  await test('paginated: a loadMore error keeps items, loadMore retries', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let p;
    root(() => {
      p = paginated(fetcher, { pageSize: 1 });
      mount(html`<p id="out">${p.render((items) => items.join())}</p>`);
    });
    calls[0].resolve(['a']);
    await tick();
    p.loadMore();
    calls[1].reject(new Error('down'));
    await tick();
    eq(p.error.value?.message, 'down');
    eq(sandbox.querySelector('#out').textContent, 'a'); // items stay on screen
    eq(p.loadingMore.value, false);
    p.loadMore();
    eq(calls[2].page, 2);
    eq(p.error.value, null);
    calls[2].resolve(['b']);
    await tick();
    eq(sandbox.querySelector('#out').textContent, 'a,b');
  });

  await test('paginated: a changed signal resets to page 1 and aborts loadMore', async () => {
    const { calls, fetcher } = controllable();
    const q = signal('x');
    /** @type {any} */
    let p;
    root(() => { p = paginated((ctx) => { q.value; return fetcher(ctx); }, { pageSize: 1 }); });
    calls[0].resolve(['x1']);
    await tick();
    p.loadMore();
    q.value = 'y';
    eq(calls[1].signal.aborted, true);
    eq(calls[2].page, 1);
    eq(p.loadingMore.value, false);
    calls[1].resolve(['x2 (late)']);
    calls[2].resolve(['y1']);
    await tick();
    eq(p.items.value.join(), 'y1');
    eq(p.hasMore.value, true);

    p.refetch();
    eq(calls[3].page, 1);
    calls[3].resolve([]);
    await tick();
    eq(p.items.value.length, 0);
    eq(p.hasMore.value, false);
  });

  await test('paginated: page 1 error shows the error view, retry refetches', async () => {
    const { calls, fetcher } = controllable();
    root(() => {
      const p = paginated(fetcher, { pageSize: 5 });
      mount(html`<p id="out">${p.render({ error: (e, retry) => html`<button @click=${retry}>${e.message}</button>`, ready: (items) => items.join() })}</p>`);
    });
    calls[0].reject(new Error('boom'));
    await tick();
    sandbox.querySelector('#out button').click();
    eq(calls[1].page, 1);
    calls[1].resolve(['ok']);
    await tick();
    eq(sandbox.querySelector('#out').textContent, 'ok');
  });

  await test('paginated: status is page 1 only; a loadMore error stays in error (and moreError)', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let p;
    root(() => { p = paginated(fetcher, { pageSize: 1 }); });
    eq(p.status.value, 'loading');
    calls[0].reject(new Error('page 1'));
    await tick();
    eq(p.status.value, 'error');
    eq(p.moreError.value, null);
    p.refetch();
    calls[1].resolve(['a']);
    await tick();
    eq(p.status.value, 'ready');
    p.loadMore();
    calls[2].reject(new Error('more'));
    await tick();
    eq(p.status.value, 'ready');
    eq(p.error.value?.message, 'more');
    eq(p.moreError.value?.message, 'more');
  });

  await test('paginated: mutate(fn) changes the loaded items, and later pages append to the result', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let p;
    root(() => {
      p = paginated(fetcher, { pageSize: 2 });
      mount(html`<p id="out">${p.render((items) => items.join())}</p>`);
    });
    p.mutate((items) => [...items, 'early']); // before page 1 arrives: nothing to change
    eq(p.status.value, 'loading');
    calls[0].resolve(['a', 'b']);
    await tick();
    p.mutate((items) => items.filter((i) => i !== 'a'));
    eq(sandbox.querySelector('#out').textContent, 'b');
    p.loadMore();
    p.mutate((items) => items.map((i) => i.toUpperCase())); // while page 2 is on its way
    calls[1].resolve(['c']);
    await tick();
    eq(p.items.value.join(), 'B,c');
    eq(p.hasMore.value, false);
  });

  await test('paginated: removing the component aborts loadMore', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let p;
    /** @type {any} */
    let dispose;
    root((d) => { dispose = d; p = paginated(fetcher, { pageSize: 1 }); });
    calls[0].resolve(['a']);
    await tick();
    p.loadMore();
    dispose();
    eq(calls[1].signal.aborted, true);
  });

  await test('paginated: warns when a page is not an array or { items }', () =>
    expectWarning(/W040.*page 1/, async () => {
      /** @type {any} */
      let p;
      // @ts-expect-error: a wrong page shape on purpose
      root(() => { p = paginated(() => ({ data: [] })); });
      await tick();
      eq(p.hasMore.value, false);
    }));

  // Prerendered pages carry the GET answers they were built with (<script type="application/json" id="pith-data">).
  /** @param {Record<string, unknown>} data */
  const bake = (data) => {
    const el = document.createElement('script');
    el.type = 'application/json';
    el.id = 'pith-data';
    el.textContent = JSON.stringify(data);
    document.head.append(el);
  };
  // Stubs fetch for fn(); `answer` makes each reply (a never-settling one means "the network is slow").
  /** @param {() => Promise<any>} answer @param {(calls: string[]) => Promise<void>} fn */
  async function withFetch(answer, fn) {
    const real = window.fetch;
    /** @type {string[]} */
    const calls = [];
    window.fetch = /** @type {any} */ ((url, init) => (calls.push(`${init?.method} ${url}`), answer()));
    try {
      await fn(calls);
    } finally {
      window.fetch = real;
      document.getElementById('pith-data')?.remove();
    }
  }

  await test('fetchJSON: a prerendered page\'s baked answer is used once, then the network', () =>
    withFetch(async () => Response.json({ n: 2 }), async (calls) => {
      bake({ '/api/x': { n: 1 } });
      eq((await fetchJSON('/api/x')).n, 1);
      eq(calls.length, 0);
      eq(document.getElementById('pith-data'), null);
      eq((await fetchJSON('/api/x')).n, 2);
      eq(calls.join(), 'GET /api/x');
    }));

  await test('fetchJSON: only GETs use baked answers, and unused ones are dropped after startup', () =>
    withFetch(async () => Response.json('net'), async (calls) => {
      bake({ '/api/a': 'baked', '/api/b': 'baked' });
      // Startup's requests all start in the same task, as a page's resources do when it renders.
      const post = fetchJSON('/api/a', { json: { x: 1 } });
      const get = fetchJSON('/api/b');
      eq(await post, 'net');
      eq(await get, 'baked');
      await new Promise((r) => setTimeout(r));
      eq(await fetchJSON('/api/a'), 'net');
      eq(calls.join(), 'POST /api/a,GET /api/a');
    }));

  // Microtasks only (no timer), so no frame can be painted in between: "Loading…" is never seen.
  await test('resource: a baked answer shows before the next frame, with no request', () =>
    withFetch(() => new Promise(() => {}), async (calls) => {
      bake({ '/api/team': ['Ada'] });
      mount(html`<p id="out">${resource(() => fetchJSON('/api/team')).render((list) => list.join())}</p>`);
      for (let i = 0; i < 5; i++) await null;
      eq(sandbox.querySelector('#out').textContent, 'Ada');
      eq(calls.length, 0);
    }));

  // ---------- live ----------

  // A chat: render() would build the whole list again for each new message; live() builds its view once.
  await test('live(): the ready view is built once and gets the data as a signal, so a repeat() inside patches', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let r;
    let builds = 0;
    root(() => {
      r = resource(fetcher);
      mount(html`<ul id="out">${r.live({ loading: () => 'L', ready: (list) => { builds++; return html`${repeat(list, (m) => m.id, (m) => html`<li>${m.text}</li>`)}`; } })}</ul>`);
    });
    const out = () => sandbox.querySelector('#out');
    eq(out().textContent, 'L');
    calls[0].resolve([{ id: 1, text: 'a' }]);
    await tick();
    eq(out().textContent, 'a');
    const first = out().querySelector('li');
    r.mutate((list) => [...list, { id: 2, text: 'b' }]);
    await tick();
    eq(out().textContent, 'ab');
    eq(builds, 1, 'not built again for a data change');
    eq(out().querySelector('li'), first, 'the existing row is kept');
  });

  await test('live(): an error shows the error view, and the ready view is built again once data is back', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let r;
    let builds = 0;
    root(() => {
      r = resource(fetcher);
      mount(html`<p id="out">${r.live({ error: (e, retry) => html`<button @click=${retry}>${e.message}</button>`, ready: (d) => { builds++; return html`${() => d.value.join()}`; } })}</p>`);
    });
    const out = () => sandbox.querySelector('#out');
    calls[0].reject(new Error('down'));
    await tick();
    eq(out().textContent, 'down');
    out().querySelector('button').click();
    calls[1].resolve(['x', 'y']);
    await tick();
    eq(out().textContent, 'x,y');
    eq(builds, 1);
  });

  await test('paginated live(): loadMore appends rows without building the view again', async () => {
    const { calls, fetcher } = controllable();
    /** @type {any} */
    let p;
    let builds = 0;
    root(() => {
      p = paginated(fetcher, { pageSize: 2 });
      mount(html`<ul id="out">${p.live((items) => { builds++; return html`${repeat(items, (i) => i, (i) => html`<li>${i}</li>`)}`; })}</ul>`);
    });
    const out = () => sandbox.querySelector('#out');
    calls[0].resolve(['a', 'b']);
    await tick();
    const first = out().querySelector('li');
    p.loadMore();
    calls[1].resolve(['c']);
    await tick();
    eq(out().textContent, 'abc');
    eq(builds, 1);
    eq(out().querySelector('li'), first);
  });
}
