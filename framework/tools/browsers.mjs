// npm run check -- --browsers: the framework tests and the project's user flows in Firefox and WebKit (Safari's
// engine) too, not only Chrome. Pith leans on newer browser features (import maps, <dialog>, popover, View
// Transitions), so this catches what Chrome alone wouldn't.
// Optional, like Vite: it needs Playwright's browser driver in the project, once:
//   npm install --save-dev playwright-core && npx playwright-core install firefox webkit
// Used by check.mjs. Skipped (not failed) when Playwright isn't installed.

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { projectRoot } from './dev-server.mjs';

const HOW = 'npm install --save-dev playwright-core && npx playwright-core install firefox webkit';

/**
 * @param {{ base: string, flows: boolean, root?: string }} options base: a running server's URL ·
 *   flows: the project has tests/flows.js
 * @returns {Promise<{ skipped: string } | { browsers: { name: string, version?: string, ok: boolean, passed: number, failed: string[] }[] }>}
 */
export async function otherBrowsers({ base, flows, root = projectRoot }) {
  let pw;
  try {
    const mod = await import(createRequire(join(root, 'package.json')).resolve('playwright-core'));
    pw = mod.firefox ? mod : mod.default; // a CommonJS package: its exports may sit on `default`
  } catch {
    return { skipped: `Playwright isn't installed in this project: ${HOW}` };
  }
  const browsers = [];
  for (const name of ['firefox', 'webkit']) {
    let browser;
    try {
      browser = await pw[name].launch();
    } catch (err) {
      browsers.push({ name, ok: false, passed: 0, failed: [`couldn't start: ${String(err.message).split('\n')[0]} (npx playwright-core install ${name})`] });
      continue;
    }
    const result = { name, version: browser.version(), ok: true, passed: 0, failed: [] };
    for (const [label, path] of [['framework tests', '/__pith/'], ...(flows ? [['user flows', '/__pith/flows.html']] : [])]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`));
      try {
        await page.goto(base + path);
        await page.waitForFunction(() => document.title === 'PASS' || document.title === 'FAIL', null, { timeout: 180_000 });
      } catch (err) {
        errors.push(`the ${label} page did not finish: ${String(err.message).split('\n')[0]}`);
      }
      const items = await page.$$eval('li.pass, li.fail', (lis) => lis.map((li) => [li.className === 'pass', li.textContent ?? '']));
      result.passed += items.filter(([ok]) => ok).length;
      result.failed.push(...items.filter(([ok]) => !ok).map(([, text]) => `${label}: ${text.replace(/^✗ /, '')}`), ...errors);
      await page.close();
    }
    result.ok = result.failed.length === 0;
    browsers.push(result);
    await browser.close();
  }
  return { browsers };
}
