// Headless Chrome helpers shared by check.mjs, see.mjs and prerender.mjs.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
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
// timing-based checks flaky. MINI_CHROME_JOBS overrides how many run at the same time.
const jobs = Number(process.env.MINI_CHROME_JOBS) || Math.max(2, Math.floor(availableParallelism() / 4));
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
 * @param {{ screenshot?: string, width?: number, height?: number }} [options]
 */
export async function loadPage(chrome, url, { screenshot, width = 1280, height = 900 } = {}) {
  const release = await slot();
  const profile = mkdtempSync(join(tmpdir(), 'mini-chrome-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
    `--user-data-dir=${profile}`, '--enable-logging=stderr', '--v=0',
    `--window-size=${width},${height}`, '--virtual-time-budget=120000',
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

export const unescapeHtml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Results written by framework/tests/harness.js report() and framework/tests/index.html.
export function parseResults(dom) {
  return [...dom.matchAll(/<li class="(pass|fail)">([^<]*)<\/li>/g)].map(([, status, text]) => ({
    ok: status === 'pass',
    name: unescapeHtml(text).replace(/^[✓✗] /, ''),
  }));
}
