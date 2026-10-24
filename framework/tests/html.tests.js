// html`` tests that need several pieces together. Called by index.html with the shared helpers.

import { html } from '../pith/html.js';
import { signal } from '../pith/signal.js';

/** @param {any} t */
export default async function (t) {
  const { test, eq, mount, sandbox } = t;

  // A page (or any template placed by a reactive hole) whose own top-level hole fills in after it's shown:
  // the late content sits next to the template's nodes, not inside them, and must still leave with them.
  await test('html: content a top-level hole adds later is removed with the template that holds it', () => {
    const late = signal(false);
    const page = signal('a');
    mount(html`<div id="host">${() => (page.value === 'a'
      ? html`<p>page a</p>${() => (late.value ? html`<form class="late">composer</form>` : null)}`
      : html`<p>page b</p>`)}</div>`);
    const host = sandbox.querySelector('#host');
    late.value = true;
    eq(host.querySelectorAll('.late').length, 1);
    page.value = 'b';
    eq(host.querySelectorAll('.late').length, 0, 'the late form must leave with page a');
    eq(host.textContent, 'page b');
    page.value = 'a';
    eq(host.querySelectorAll('.late').length, 1, 'page a again, with one form');
    page.value = 'b';
    page.value = 'a';
    eq(host.querySelectorAll('.late').length, 1, 'never more than one');
  });

  await test('html: a hole that only ever holds text still updates in place', () => {
    const n = signal(1);
    mount(html`<p id="count">${n}</p>`);
    const text = sandbox.querySelector('#count').firstChild;
    n.value = 2;
    eq(sandbox.querySelector('#count').textContent, '2');
    eq(sandbox.querySelector('#count').firstChild, text, 'the same text node, edited');
  });
}
