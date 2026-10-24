// Headless Chrome helpers shared by check.mjs, see.mjs and prerender.mjs.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { availableParallelism, loadavg, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'chrome'];
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    for (const name of names) if (existsSync(join(dir, name))) return join(dir, name);
  }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return existsSync(mac) ? mac : null;
}

// Each Chrome is a dozen processes: running one per page at once overloads the machine and makes
// timing-based checks flaky. So: a quarter of the cores, minus what the machine is already busy with
// (measured: on a 16-core machine at load 35-45, 4 Chromes failed 1 check run in 5; 1 Chrome, none in 80).
// PITH_CHROME_JOBS overrides how many run at the same time.
/** @param {{ cores?: number, load?: number, env?: string }} [machine] */
export function chromeJobs({ cores = availableParallelism(), load = loadavg()[0], env = process.env.PITH_CHROME_JOBS } = {}) {
  if (Number(env) > 0) return Number(env);
  const most = Math.max(2, Math.floor(cores / 4)); // a quiet machine: as before
  return Math.max(1, Math.round(most * Math.max(0, 1 - load / cores)));
}
const jobs = chromeJobs();
let running = 0;
const waiting = [];
async function slot() {
  if (running >= jobs) await new Promise((resolve) => waiting.push(resolve));
  running++;
  return () => {
    running--;
    waiting.shift()?.();
  };
}

/**
 * Load a URL in a fresh headless profile. Returns the final DOM (or a screenshot) and console lines.
 * @param {string} chrome
 * @param {string} url
 * @param {{ screenshot?: string, width?: number, height?: number, dark?: boolean }} [options]
 *   dark: the page sees prefers-color-scheme: dark (its own dark theme, not Chrome's auto-darkening)
 */
export async function loadPage(chrome, url, { screenshot, width = 1280, height = 900, dark = false } = {}) {
  const release = await slot();
  const profile = mkdtempSync(join(tmpdir(), 'pith-chrome-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
    `--user-data-dir=${profile}`, '--enable-logging=stderr', '--v=0',
    `--window-size=${width},${height}`, '--virtual-time-budget=120000',
    ...(dark ? ['--blink-settings=preferredColorScheme=0'] : []),
    screenshot ? `--screenshot=${screenshot}` : '--dump-dom', url,
  ];
  return new Promise((resolve) => {
    const child = spawn(chrome, args);
    let dom = '';
    let log = '';
    child.stdout.on('data', (d) => (dom += d));
    child.stderr.on('data', (d) => (log += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 90_000);
    child.on('close', () => {
      clearTimeout(timer);
      rmSync(profile, { recursive: true, force: true });
      release();
      const consoleLines = [...log.matchAll(/CONSOLE[^\]]*\] "(.*)", source: (\S+)/g)].map(
        ([, msg, src]) => `${msg} (${src.replace(/^https?:\/\/[^/]+/, '')})`
      );
      resolve({ dom, consoleLines });
    });
  });
}

/**
 * Check each item, then check the failed ones once more (all at once). On a busy machine a page can miss its
 * load timeout; a real problem fails both times. A pass on the second try is kept, with `retried: true`.
 * @template {{ ok: boolean }} R
 * @param {any[]} items @param {(item: any) => Promise<R>} run
 * @returns {Promise<(R & { retried?: boolean })[]>}
 */
export async function retryFailures(items, run) {
  const first = await Promise.all(items.map(run));
  return Promise.all(first.map(async (r, i) => (r.ok ? r : { ...(await run(items[i])), retried: true })));
}

export const unescapeHtml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Results written by framework/tests/harness.js report() and framework/tests/index.html.
export function parseResults(dom) {
  return [...dom.matchAll(/<li class="(pass|fail)">([^<]*)<\/li>/g)].map(([, status, text]) => ({
    ok: status === 'pass',
    name: unescapeHtml(text).replace(/^[✓✗] /, ''),
  }));
}
