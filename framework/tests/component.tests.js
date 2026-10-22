// component tests. Called by index.html with the shared helpers.

import { define, provide, inject } from '../mini/component.js';
import { signal } from '../mini/signal.js';
import { html } from '../mini/html.js';

// Run fn with console.error captured, so expected component errors don't show as problems.
async function quietErrors(fn) {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return logged;
}

/** @param {any} t */
export default async function (t) {
  const { test, eq, mount, tick, expectWarning, sandbox } = t;

  await test('ctx.slot(name) and ctx.slot() split the original children', () => {
    define('test-card', (_p, ctx) => html`
      <header>${ctx.slot('title')}</header>
      <main>${ctx.slot()}</main>
      <footer>${ctx.slot('actions')}</footer>
      <i>${ctx.children.length}</i>
    `);
    sandbox.innerHTML = `<test-card>
      <h2 slot="title">Title</h2>
      Body text
      <p>More</p>
      <button slot="actions">Go</button>
    </test-card>`;
    const el = sandbox.querySelector('test-card');
    eq(el.querySelector('header').innerHTML.replace(/<!--.*?-->/g, ''), '<h2 slot="title">Title</h2>');
    eq(el.querySelector('main').textContent.trim().replace(/\s+/g, ' '), 'Body text More');
    eq(el.querySelector('main p').textContent, 'More');
    eq(el.querySelector('footer button').textContent, 'Go');
    eq(el.querySelector('i').textContent, '7'); // ctx.children unchanged: all nodes, whitespace included
  });

  await test('ctx.slot() drops whitespace-only text and returns [] for a missing slot', () => {
    /** @type {any} */
    let got;
    define('test-slot-empty', (_p, ctx) => {
      got = [ctx.slot().length, ctx.slot('nope').length];
      return html`<b>x</b>`;
    });
    sandbox.innerHTML = '<test-slot-empty>\n   \n</test-slot-empty>';
    eq(got.join(), '0,0');
  });

  await test('inject finds the nearest provider, through shadow roots', () => {
    define('test-theme', (props, ctx) => {
      provide('theme', props.name.value);
      return html`${ctx.children}`;
    }, { props: ['name'] });
    define('test-themed', () => html`<span>${inject('theme', 'none')}</span>`);
    define('test-shadowed', () => html`<test-themed></test-themed>`, { shadow: true });
    sandbox.innerHTML = `
      <test-theme name="dark"><div>
        <test-themed id="a"></test-themed>
        <test-theme name="light"><test-themed id="b"></test-themed></test-theme>
        <test-shadowed id="c"></test-shadowed>
      </div></test-theme>
      <test-themed id="d"></test-themed>`;
    const text = (sel) => sandbox.querySelector(sel).textContent;
    eq(text('#a'), 'dark');
    eq(text('#b'), 'light');
    eq(sandbox.querySelector('#c').shadowRoot.querySelector('test-themed').textContent, 'dark');
    eq(text('#d'), 'none');
  });

  await test('inject passes signals through, so consumers update', () => {
    const count = signal(1);
    define('test-count-provider', (_p, ctx) => {
      provide('count', count);
      return html`${ctx.children}`;
    });
    define('test-count-reader', () => {
      const c = inject('count');
      return html`<b>${c}</b>`;
    });
    sandbox.innerHTML = '<test-count-provider><test-count-reader></test-count-reader></test-count-provider>';
    count.value = 2;
    eq(sandbox.querySelector('b').textContent, '2');
  });

  await test('provide/inject outside setup warn and inject returns the fallback', async () => {
    await expectWarning(/W030.*provide/, () => provide('x', 1));
    let value;
    await expectWarning(/W031.*inject/, () => { value = inject('x', 'fb'); });
    eq(value, 'fb');
  });

  await test('an error in setup shows the fallback, and retry runs setup again', async () => {
    let fail = true;
    let setups = 0;
    define('test-flaky', () => {
      setups++;
      if (fail) throw new Error('setup broke');
      return html`<p>ok</p>`;
    }, {
      fallback: (err, retry) => html`<p class="fb">${err.message}</p><button @click=${retry}>again</button>`,
    });
    await quietErrors(() => mount(html`<p id="before">before</p><test-flaky></test-flaky><p id="after">after</p>`));
    const el = sandbox.querySelector('test-flaky');
    eq(el.querySelector('.fb').textContent, 'setup broke');
    eq(sandbox.querySelector('#after').textContent, 'after'); // the rest of the page still renders
    fail = false;
    el.querySelector('button').click();
    eq(setups, 2);
    eq(el.textContent, 'ok');
  });

  await test('an error in a reactive hole shows the fallback; other components keep working', async () => {
    const n = signal(0);
    let cleaned = 0;
    define('test-hole-error', (_p, ctx) => {
      ctx.onCleanup(() => cleaned++);
      return html`<p>${() => { if (n.value === 1) throw new Error('hole broke'); return `n=${n.value}`; }}</p>`;
    }, { fallback: (err) => html`<p class="fb">${err.message}</p>` });
    define('test-hole-ok', () => html`<i>${n}</i>`);
    mount(html`<test-hole-error></test-hole-error><test-hole-ok></test-hole-ok>`);
    const el = sandbox.querySelector('test-hole-error');
    eq(el.textContent, 'n=0');
    await quietErrors(() => { n.value = 1; });
    eq(el.querySelector('.fb').textContent, 'hole broke');
    eq(cleaned, 1); // the failed setup's scope was disposed
    n.value = 2; // the old hole is gone and doesn't throw again
    eq(el.querySelector('.fb').textContent, 'hole broke');
    eq(sandbox.querySelector('test-hole-ok').textContent, '2');
  });

  await test('an error in a hole during the first render shows the fallback', async () => {
    define('test-first-hole', () => html`<p>${() => { throw new Error('first'); }}</p>`,
      { fallback: (err) => html`<p class="fb">${err.message}</p>` });
    await quietErrors(() => mount(html`<test-first-hole></test-first-hole>`));
    eq(sandbox.querySelector('test-first-hole').textContent, 'first');
  });

  await test('without a fallback, a default alert with "Try again" shows and the error is logged', async () => {
    let fail = true;
    define('test-default-fb', () => {
      if (fail) throw new Error('nope');
      return html`<p>fine</p>`;
    });
    const logged = await quietErrors(() => mount(html`<test-default-fb></test-default-fb>`));
    const el = sandbox.querySelector('test-default-fb');
    const alert = el.querySelector('[role="alert"]');
    eq(!!alert, true);
    eq(alert.textContent.includes('nope'), true);
    eq(logged.some((l) => l.includes('<test-default-fb>') && l.includes('nope')), true);
    fail = false;
    el.querySelector('button').click();
    eq(el.textContent, 'fine');
  });

  await test('a failed component\'s fallback is cleaned up when removed', async () => {
    const s = signal(0);
    let runs = 0;
    define('test-fb-dispose', () => {
      throw new Error('bad');
    }, { fallback: () => html`<p>${() => (runs++, s.value)}</p>` });
    await quietErrors(() => mount(html`<test-fb-dispose></test-fb-dispose>`));
    eq(runs, 1);
    sandbox.querySelector('test-fb-dispose').remove();
    await tick();
    s.value = 1;
    eq(runs, 1);
  });

  await test('a component moved by a wrapper before it connects still finds its provider', async () => {
    define('test-ctx-outer', () => (provide('wrap-key', 'from outer'), html`<test-ctx-wrap><test-ctx-inner></test-ctx-inner></test-ctx-wrap>`));
    define('test-ctx-wrap', (props, ctx) => html`<div class="wrap">${ctx.children}</div>`);
    let setups = 0;
    define('test-ctx-inner', () => (setups++, html`<b>${inject('wrap-key', 'none')}</b>`));
    mount(html`<test-ctx-outer></test-ctx-outer>`);
    await tick();
    eq(sandbox.querySelector('test-ctx-inner').textContent, 'from outer');
    eq(setups, 1);
  });

  await test('components inside prerendered markup wait until the app replaces it', async () => {
    let setups = 0;
    define('test-prerendered', () => (setups++, html`<i>live</i>`));
    const shell = document.createElement('div');
    shell.innerHTML = '<div data-prerendered style="display:contents"><test-prerendered><i>static</i></test-prerendered></div>';
    sandbox.append(shell);
    await tick();
    eq(setups, 0);
    eq(shell.textContent, 'static');
    shell.replaceChildren(html`<test-prerendered></test-prerendered>`);
    await tick();
    eq(setups, 1);
    eq(shell.textContent, 'live');
  });
}
