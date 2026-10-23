// replay tests. Called by index.html with the shared helpers.
// capture() is the inline script prerendered pages carry: it holds clicks and typed text made before
// the app starts, then replays them on the live app once it replaces the [data-prerendered] markup.

import { capture } from '../pith/replay.js';
import { html } from '../pith/html.js';
import { root } from '../pith/signal.js';

/** @param {any} t */
export default async function (t) {
  const { test, eq, mount, tick, waitUntil, sandbox } = t;

  // A fake #app holding prerendered (static, handler-less) markup, as in dist/<route>/index.html.
  function prerendered(markup) {
    const app = document.createElement('div');
    app.innerHTML = `<div data-prerendered style="display:contents">${markup}</div>`;
    mount(app);
    return { app, wrap: /** @type {HTMLElement} */ (app.firstElementChild) };
  }
  // Clicks `el` and returns whether the click was cancelled (dispatchEvent is false when it was).
  const prevented = (el) => !el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  // Focus only works on visible elements, and the sandbox is hidden.
  async function visible(fn) {
    sandbox.style.display = 'block';
    try { await fn(); } finally { sandbox.style.display = ''; }
  }

  await test('replay: a click before the app starts is held, then replayed once on the live button', async () => {
    const { app, wrap } = prerendered('<main><p>Count: 5</p><button>Increase</button></main>');
    capture(app);
    eq(prevented(wrap.querySelector('button')), true);
    eq(wrap.hasAttribute('data-pending'), true);
    let clicks = 0;
    root(() => app.replaceChildren(html`<main><p>Count: 5</p><button @click=${() => clicks++}>Increase</button></main>`));
    await tick();
    eq(clicks, 1);
    eq(wrap.hasAttribute('data-pending'), false);
    app.querySelector('button').click(); // the live button works normally, nothing replays twice
    await tick();
    eq(clicks, 2);
  });

  await test('replay: typed text and focus (with the caret) carry over to the live input', () => visible(async () => {
    const { app, wrap } = prerendered('<form><label>Name <input name="name"></label><textarea></textarea></form>');
    capture(app);
    const input = wrap.querySelector('input');
    input.focus();
    input.value = 'Ada Lovelace';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.setSelectionRange(3, 3);
    let typed = '';
    let changed = 0;
    root(() => app.replaceChildren(html`<form><label>Name <input name="name" @input=${(e) => (typed = e.target.value)} @change=${() => changed++}></label><textarea></textarea></form>`));
    await tick();
    const live = app.querySelector('input');
    eq(live.value, 'Ada Lovelace');
    eq(typed, 'Ada Lovelace');
    eq(changed, 1);
    eq(document.activeElement, live);
    eq(live.selectionStart, 3);
    eq(app.querySelector('textarea').value, ''); // untouched fields are left alone
    live.blur();
  }));

  await test('replay: focus is not restored to a field the user had already left', () => visible(async () => {
    const { app, wrap } = prerendered('<input>');
    capture(app);
    const input = wrap.querySelector('input');
    input.focus();
    input.blur();
    await tick();
    app.replaceChildren(html`<input>`);
    await tick();
    eq(document.activeElement === app.querySelector('input'), false);
  }));

  await test('replay: a click is dropped when the live element there is a different one', async () => {
    const { app, wrap } = prerendered('<button>Delete</button><button>Keep</button>');
    capture(app);
    eq(prevented(wrap.querySelector('button')), true);
    let clicks = 0;
    root(() => app.replaceChildren(html`<button @click=${() => clicks++}>Sign in</button><button @click=${() => clicks++}>Keep</button>`));
    await tick();
    eq(clicks, 0);
  });

  await test('replay: a submit is prevented (no reload) and replayed through the live form', async () => {
    const { app, wrap } = prerendered('<form><input name="q"></form>');
    capture(app);
    const event = new SubmitEvent('submit', { bubbles: true, cancelable: true });
    wrap.querySelector('form').dispatchEvent(event);
    eq(event.defaultPrevented, true);
    let submits = 0;
    root(() => app.replaceChildren(html`<form @submit=${(e) => (e.preventDefault(), submits++)}><input name="q"></form>`));
    await tick();
    eq(submits, 1);
  });

  await test('replay: a click on a submit button replays as a submit of the live form', async () => {
    const { app, wrap } = prerendered('<form><button>Add</button></form>');
    capture(app);
    eq(prevented(wrap.querySelector('button')), true);
    let submits = 0;
    root(() => app.replaceChildren(html`<form @submit=${(e) => (e.preventDefault(), submits++)}><button>Add</button></form>`));
    await tick();
    eq(submits, 1);
  });

  await test('replay: links are not intercepted (they work without JS)', async () => {
    const { app, wrap } = prerendered('<a href="#x">Docs</a><button>B</button>');
    capture(app);
    eq(prevented(wrap.querySelector('a')), false);
    eq(wrap.hasAttribute('data-pending'), false);
    if (location.hash === '#x') history.replaceState(null, '', location.pathname + location.search);
  });

  await test('replay: at most 5 clicks are held, and order is kept', async () => {
    const { app, wrap } = prerendered('<button>A</button><button>B</button>');
    capture(app);
    const [a, b] = wrap.querySelectorAll('button');
    for (const el of [a, b, a, b, a, b, a]) eq(prevented(el), true);
    const order = [];
    root(() => app.replaceChildren(html`<button @click=${() => order.push('A')}>A</button><button @click=${() => order.push('B')}>B</button>`));
    await tick();
    eq(order.join(''), 'ABABA');
  });

  await test('replay: does nothing without a [data-prerendered] wrapper', async () => {
    const app = document.createElement('div');
    app.innerHTML = '<button>B</button>';
    mount(app);
    capture(app);
    capture(null);
    eq(prevented(app.querySelector('button')), false);
  });

  await test('replay: gives up after the timeout, so the page behaves natively', async () => {
    const { app, wrap } = prerendered('<button>Late</button>');
    capture(app, { timeout: 30 });
    const button = wrap.querySelector('button');
    eq(prevented(button), true);
    await waitUntil(() => !wrap.hasAttribute('data-pending'), 1000);
    eq(prevented(button), false);
    let clicks = 0;
    root(() => app.replaceChildren(html`<button @click=${() => clicks++}>Late</button>`));
    await tick();
    eq(clicks, 0); // the held click was dropped with the rest
  });
}
