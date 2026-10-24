// Flow harness tests (tests/harness.js): how app.click/type/select find their target. Called by index.html.

import { findTarget } from './harness.js';

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
}
