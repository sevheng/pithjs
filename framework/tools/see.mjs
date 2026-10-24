// npm run see /todos  → prints what the page shows as text, and saves a screenshot.
// Lets anyone (or any AI) "look" at a page without opening a browser.
//   --mobile   use a phone-sized window (390x844)
//   --dark     the dark theme (prefers-color-scheme: dark); also checks text contrast in it
//   --full     screenshot the whole page, not just the first screen
//   --state    also print what the pages, stores and components hold (dev mode; see tests/state.js)
//   --no-shot  skip the screenshot

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findChrome, loadPage, unescapeHtml } from './chrome.mjs';
import { startServer, projectRoot } from './dev-server.mjs';

/**
 * @param {string[]} args the command line after `see`
 */
export function seeOptions(args) {
  const path = args.find((a) => a.startsWith('/')) ?? '/';
  const mobile = args.includes('--mobile');
  const dark = args.includes('--dark');
  const full = args.includes('--full');
  const [width, height] = mobile ? [390, 844] : [1280, 900];
  const name = (path === '/' ? 'home' : path.slice(1).replace(/[^\w-]+/g, '_')) +
    (mobile ? '-mobile' : '') + (dark ? '-dark' : '') + (full ? '-full' : '');
  return { path, width, height, mobile, dark, full, state: args.includes('--state'), shot: !args.includes('--no-shot'), name };
}

if (import.meta.main) {
  const { path, width, height, dark, full, state, shot, name } = seeOptions(process.argv.slice(2));
  const chrome = findChrome();
  if (!chrome) {
    console.error('Chrome not found. Install Chrome/Chromium or set CHROME_PATH=/path/to/chrome');
    process.exit(1);
  }
  const shotDir = join(projectRoot, '.pith', 'screenshots');
  const shotFile = join(shotDir, `${name}.png`);

  const server = await startServer(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    const query = new URLSearchParams({ path, width: String(width), height: String(height) });
    if (state) query.set('state', '1');
    if (dark) query.set('dark', '1');
    const text = loadPage(chrome, `${base}/__pith/see.html?${query}`, { dark });
    // --full needs the page's height first (see.html measures it); otherwise both load at once.
    const picture = !shot ? null
      : full ? text.then(({ dom }) => loadPage(chrome, base + path, { screenshot: shotFile, width, height: Math.max(height, Number(pick(dom, 'height')) || height), dark }))
      : loadPage(chrome, base + path, { screenshot: shotFile, width, height, dark });
    if (shot) mkdirSync(shotDir, { recursive: true });
    const [{ dom }] = await Promise.all([text, picture]);

    console.log(`Page ${path} (${width}x${height}${dark ? ', dark theme' : ''})\n`);
    console.log(pick(dom, 'outline') || '(nothing rendered)');
    if (state) console.log(`\nState:\n${pick(dom, 'state') || '(none)'}`);
    const problems = pick(dom, 'problems');
    console.log(problems ? `\nProblems:\n${problems}` : '\nNo errors or warnings.');
    const layout = pick(dom, 'layout');
    if (layout) console.log(`\nLayout:\n${layout}`);
    const a11y = pick(dom, 'a11y');
    if (a11y) console.log(`\nAccessibility${dark ? ' (dark theme: contrast)' : ''}:\n${a11y}`);
    if (shot) console.log(`\nScreenshot: ${shotFile}`);
  } finally {
    server.close();
  }
}

/** The text see.html wrote into <pre id="…">. */
function pick(dom, id) {
  return unescapeHtml(dom.match(new RegExp(`<pre id="${id}">([\\s\\S]*?)</pre>`))?.[1] ?? '');
}
