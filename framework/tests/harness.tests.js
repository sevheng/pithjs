// Flow harness tests (tests/harness.js): how app.click/type/select find their target, what see() reads,
// and waiting for a navigation. Called by index.html.

import { findTarget, visibleText, createApp } from './harness.js';

/** @param {any} t */
export default async function (t) {
  const { test, eq } = t;
  const page = (body) => {
    const box = document.createElement('div');
    box.innerHTML = body;
    document.body.append(box);
    return { doc: document, done: () => box.remove() };
  };

  await test('harness: a target is matched by its accessible name, then case-insensitively', () => {
    const p = page('<button type="button" id="h-save">Save draft</button>');
    try {
      eq(findTarget(p.doc, 'button', 'Save draft')?.id, 'h-save');
      eq(findTarget(p.doc, 'button', 'save DRAFT')?.id, 'h-save');
      eq(findTarget(p.doc, 'button', 'Save'), null);
    } finally { p.done(); }
  });

  await test('harness: #id, .class and [attr] targets are CSS selectors', () => {
    const p = page('<a id="h-link" class="h-room" href="/chat/h-design">x</a>');
    try {
      eq(findTarget(p.doc, 'a', '#h-link')?.id, 'h-link');
      eq(findTarget(p.doc, 'a', '.h-room')?.id, 'h-link');
      eq(findTarget(p.doc, 'a', '[href="/chat/h-design"]')?.id, 'h-link');
    } finally { p.done(); }
  });

  await test('harness: a name that starts like a selector (# design, .env) still matches by name', () => {
    const p = page('<a id="h-room" href="/x"># h-design</a><button type="button" id="h-env">.env</button>');
    try {
      eq(findTarget(p.doc, 'a', '# h-design')?.id, 'h-room', 'not a valid selector: read as a name');
      eq(findTarget(p.doc, 'button', '.env')?.id, 'h-env', 'a valid selector that matches nothing: read as a name');
    } finally { p.done(); }
  });

  // see()/notSee() read what a sighted person reads: text clipped away for screen readers doesn't count.
  await test('harness: visibleText skips screen-reader-only text (clip, clip-path), keeps the rest', () => {
    const sr = 'position: absolute; width: 1px; height: 1px; overflow: hidden; white-space: nowrap;';
    const p = page(`<p>Card h-Alpha is in To do</p>
      <p aria-live="polite" style="${sr} clip: rect(0 0 0 0)">Moved h-Beta to Done</p>
      <span style="${sr} clip-path: inset(50%)">h-Gamma hint</span>
      <p style="display: none">h-Delta hidden</p>
      <p>h-Epsilon <span>visible</span> <span style="position: absolute; left: 0">h-Zeta placed</span></p>
      <button type="button">h-Eta <span style="${sr} clip: rect(0 0 0 0)">h-Theta, for screen readers</span></button>`);
    try {
      const text = visibleText(p.doc);
      eq(text.includes('Card h-Alpha is in To do'), true);
      eq(text.includes('h-Beta'), false, 'a visually hidden live region');
      eq(text.includes('h-Gamma'), false, 'clip-path');
      eq(text.includes('h-Delta'), false);
      eq(text.includes('h-Epsilon visible'), true);
      eq(text.includes('h-Zeta placed'), true, 'positioned but not clipped');
      eq(text.includes('h-Eta'), true);
      eq(text.includes('h-Theta'), false);
    } finally { p.done(); }
  });

  await test('harness: hear() finds an announcement only screen readers get', async () => {
    const p = page('<p class="h-sr" role="status" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">h-Moved to Done</p>');
    try {
      const app = createApp(/** @type {any} */ ({ contentDocument: document, contentWindow: { location: { pathname: '/' } } }));
      await app.hear('h-Moved to Done');
      eq(visibleText(document).includes('h-Moved'), false);
    } finally { p.done(); }
  });

  await test('harness: click() on a link that navigates waits until the router shows the new page', async () => {
    const p = page('<div id="h-route"><button type="button" id="h-go">h-Next page</button><input aria-label="h-Field" id="h-old"></div>');
    try {
      const box = /** @type {HTMLElement} */ (document.getElementById('h-route'));
      // A stand-in for the app's frame: the URL changes at once, the router swaps the page 150 ms later.
      const loc = { pathname: '/old' };
      let shown = '/old';
      const win = { location: loc, __pith: { router: { path: { peek: () => shown } } } };
      document.getElementById('h-go').addEventListener('click', () => {
        loc.pathname = '/new';
        setTimeout(() => {
          box.innerHTML = '<input aria-label="h-Field" id="h-new">';
          shown = '/new';
        }, 150);
      });
      const app = createApp(/** @type {any} */ ({ contentDocument: document, contentWindow: win }));
      await app.click('h-Next page');
      await app.type('h-Field', 'typed');
      eq(/** @type {HTMLInputElement} */ (document.getElementById('h-new')).value, 'typed');
    } finally { p.done(); }
  });
}
