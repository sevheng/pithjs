// Accessibility check tests (tests/a11y.js). Called by index.html with the shared helpers.

import { accessibilityProblems } from './a11y.js';

/** @param {any} t */
export default async function (t) {
  const { test, eq } = t;

  // A whole page in an iframe, so styles and layout are real.
  /** @param {string} body @param {{ lang?: string, css?: string }} [options] */
  async function page(body, { lang = 'en', css = '' } = {}) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:absolute;left:-9999px;width:800px;height:600px';
    frame.srcdoc = `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head><style>
      body { background: #fff; color: #111; } .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      ${css}</style></head><body>${body}</body></html>`;
    await new Promise((resolve) => {
      frame.onload = resolve;
      document.body.append(frame);
    });
    const doc = /** @type {Document} */ (frame.contentDocument);
    return { doc, problems: (o) => accessibilityProblems(doc, o), done: () => frame.remove() };
  }
  /** @param {string[]} problems @param {RegExp} re */
  const has = (problems, re) => eq(problems.some((p) => re.test(p)), true, `expected ${re} in:\n${problems.join('\n')}`);

  await test('a11y: a well-built page has no problems', async () => {
    const p = await page(`
      <h1>Contact</h1>
      <label for="email">Email</label><input id="email">
      <label>Notes <textarea></textarea></label>
      <label class="sr-only" for="q">Search</label><input id="q" type="search" placeholder="Search">
      <input aria-label="Amount" type="number"> <input type="hidden" name="x"> <input type="submit" value="Send">
      <button type="button" aria-label="Close">×</button> <button type="button"><span class="sr-only">Menu</span></button>
      <a href="/"><img src="data:," alt="Home"></a> <img src="data:," alt="">`);
    eq(p.problems().join('\n'), '');
    p.done();
  });

  await test('a11y: names unlabeled fields, nameless buttons and links, and images without alt', async () => {
    const p = await page(`<h1>x</h1><input id="name" placeholder="Name"><select></select>
      <button type="button"></button><a href="/x"><svg></svg></a><img src="cat.png">`);
    const problems = p.problems();
    has(problems, /<input#name> has no label: add <label for="name">/);
    has(problems, /<select> has no label/);
    has(problems, /<button> has no name/);
    has(problems, /<a> has no name/);
    has(problems, /<img src="cat.png"> has no alt/);
    eq(problems.length, 5, problems.join('\n'));
    p.done();
  });

  await test('a11y: duplicate ids, a <label for> pointing nowhere, two <h1>s and no <html lang>', async () => {
    const p = await page(`<h1>One</h1><h1>Two</h1><p id="a"></p><p id="a"></p><label for="gone">Gone</label>`, { lang: '' });
    const problems = p.problems();
    has(problems, /id="a" is used 2 times/);
    has(problems, /<label> "Gone" points at id="gone"/);
    has(problems, /2 <h1>s \("One", "Two"\)/);
    has(problems, /<html> has no lang/);
    p.done();
  });

  await test('a11y: low-contrast text is reported once per color pair, with the ratio and colors', async () => {
    const p = await page(`<h1>Title</h1><p class="faint">one</p><p class="faint">two</p>
      <p class="big">Large text needs only 3:1</p><button type="button" disabled class="faint">off</button>
      <div class="card"><p>on a card</p></div>`,
      { css: '.faint { color: #aaa; } .big { color: #888; font-size: 28px; } .card { background: oklch(0.3 0 0); color: #333; }' });
    const problems = p.problems();
    has(problems, /<p\.faint> "one": text contrast 2\.3:1 \(#aaaaaa on #ffffff\), needs 4\.5:1/);
    has(problems, /<p> "on a card": text contrast 1\.\d:1 \(#333333 on #/); // oklch background, converted
    eq(problems.filter((x) => x.includes('"two"') || x.includes('Large') || x.includes('"off"')).length, 0, problems.join('\n'));
    eq(problems.length, 2, problems.join('\n'));
    p.done();
  });

  await test('a11y: contrast blends see-through backgrounds and skips images and hidden text', async () => {
    const p = await page(`<h1>x</h1><div class="glass"><p>over glass</p></div>
      <div class="photo"><p>on a photo</p></div><p class="sr-only faint">hidden</p>`,
      { css: 'body { background: #000; color: #fff; } .glass { background: rgb(255 255 255 / 0.9); color: #777; } .photo { background-image: linear-gradient(#000, #fff); color: #444; } .faint { color: #111; }' });
    const problems = p.problems();
    has(problems, /"over glass": text contrast .* on #e6e6e6/);
    eq(problems.length, 1, problems.join('\n'));
    eq(p.problems({ contrastOnly: true }).length, 1);
    p.done();
  });
}
