// npm run see /todos  → prints what the page shows as text, and saves a screenshot.
// Lets anyone (or any AI) "look" at a page without opening a browser.
//   --mobile   use a phone-sized window (390x844)
//   --state    also print what the pages, stores and components hold (dev mode; see tests/state.js)
//   --no-shot  skip the screenshot

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findChrome, loadPage, unescapeHtml } from './chrome.mjs';
import { startServer, projectRoot } from './dev-server.mjs';

const args = process.argv.slice(2);
const path = args.find((a) => a.startsWith('/')) ?? '/';
const mobile = args.includes('--mobile');
const [width, height] = mobile ? [390, 844] : [1280, 900];

const chrome = findChrome();
if (!chrome) {
  console.error('Chrome not found. Install Chrome/Chromium or set CHROME_PATH=/path/to/chrome');
  process.exit(1);
}

const shotDir = join(projectRoot, '.mini', 'screenshots');
const shotFile = join(shotDir, `${path === '/' ? 'home' : path.slice(1).replace(/[^\w-]+/g, '_')}${mobile ? '-mobile' : ''}.png`);

const server = await startServer(0);
const base = `http://localhost:${server.address().port}`;
try {
  const query = new URLSearchParams({ path, width: String(width), height: String(height) });
  if (args.includes('--state')) query.set('state', '1');
  const jobs = [loadPage(chrome, `${base}/__mini/see.html?${query}`)];
  if (!args.includes('--no-shot')) {
    mkdirSync(shotDir, { recursive: true });
    jobs.push(loadPage(chrome, base + path, { screenshot: shotFile, width, height }));
  }
  const [{ dom }] = await Promise.all(jobs);
  const pick = (id) => unescapeHtml(dom.match(new RegExp(`<pre id="${id}">([\\s\\S]*?)</pre>`))?.[1] ?? '');

  console.log(`Page ${path} (${width}x${height})\n`);
  console.log(pick('outline') || '(nothing rendered)');
  if (query.has('state')) console.log(`\nState:\n${pick('state') || '(none)'}`);
  const problems = pick('problems');
  console.log(problems ? `\nProblems:\n${problems}` : '\nNo errors or warnings.');
  const layout = pick('layout');
  if (layout) console.log(`\nLayout:\n${layout}`);
  const a11y = pick('a11y');
  if (a11y) console.log(`\nAccessibility:\n${a11y}`);
  if (jobs.length > 1) console.log(`\nScreenshot: ${shotFile}`);
} finally {
  server.close();
}
