// Measure every implementation the same way, with real (not virtual) time:
//   load:    fresh profile per run, "slow 4G + 4x slower CPU" phone profile, over HTTP/1.1 and HTTP/2
//   runtime: js-framework-benchmark-style operations (median of 10, after warm-up, GC between runs)
//   memory:  JS heap after load, with 1k / 10k rows, and after create/clear cycles (leak check)
//
//   node tools/measure.mjs [load] [runtime] [--runs 5]
// Writes results/measure.json. Mini runs with dev warnings off (MINI_DEV=false), like the others'
// production builds.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { findChrome } from '../../framework/tools/chrome.mjs';
import { launch } from './cdp.mjs';
import { startServer } from './server.mjs';

const compare = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const want = (part) => !args.some((a) => ['load', 'runtime'].includes(a)) || args.includes(part);
const runsArg = args.indexOf('--runs');
const RUNS = runsArg >= 0 ? Number(args[runsArg + 1]) : 5;
const implArg = args.indexOf('--impl');
const IMPLS = implArg >= 0 ? args[implArg + 1].split(',') : ['mini', 'mini-vite', 'react', 'vue'];
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'measure.json';

const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chromePath = findChrome();
if (!chromePath) throw new Error('Chrome not found (set CHROME_PATH)');
const browser = await launch(chromePath);
const resultsFile = join(compare, 'results', OUT);
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, 'utf8')) : {};
results.environment = {
  date: new Date().toISOString(),
  chrome: (await (await browser.newPage()).evaluate('navigator.userAgent')).match(/Chrome\/[\d.]+/)?.[0],
  node: process.version,
  runs: RUNS,
};

// Turn off Mini's dev warnings for measurements (the server injects nothing into React/Vue).
const prodScript = 'globalThis.MINI_DEV = false;';

// ---------- Load ----------
const LOAD_PAGES = [
  { app: 'todo', path: '/', ready: 'li.todo' },
  { app: 'crm', path: '/', ready: '.stat-value' },
  { app: 'crm', path: '/customers', ready: '.table tbody tr' },
];

const injectLoad = (selector) => `
  window.__lcp = 0; window.__tbt = 0;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
          .observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!window.__readyAt) window.__tbt += Math.max(0, e.duration - 50); })
          .observe({ type: 'longtask', buffered: true }); } catch {}
  const check = () => { if (!window.__readyAt && document.querySelector(${JSON.stringify(selector)})) window.__readyAt = performance.now(); };
  new MutationObserver(check).observe(document, { childList: true, subtree: true });
  ${prodScript}
`;

async function loadOnce(url, selector) {
  const page = await browser.newPage();
  try {
    await page.send('Page.enable');
    await page.send('Network.enable');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    // Lighthouse's mobile profile: 150 ms RTT, 1.6 Mbps down, 750 Kbps up, 4x CPU slowdown.
    await page.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
    });
    await page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: injectLoad(selector) });
    await page.send('Page.navigate', { url });
    const deadline = Date.now() + 60_000;
    while (!(await page.evaluate('window.__readyAt ?? 0'))) {
      if (Date.now() > deadline) throw new Error(`never became ready: ${url}`);
      await sleep(50);
    }
    await sleep(1000); // let paint and LCP entries settle
    return await page.evaluate(`(() => {
      const res = performance.getEntriesByType('resource');
      const js = res.filter((r) => /\\.m?js$/.test(new URL(r.name).pathname));
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        lcp: window.__lcp || null,
        ready: window.__readyAt,
        tbt: window.__tbt,
        jsKB: js.reduce((s, r) => s + r.encodedBodySize, 0) / 1024,
        jsFiles: js.length,
        requests: res.length + 1,
        protocol: nav.nextHopProtocol,
      };
    })()`);
  } finally {
    await page.close();
  }
}

if (want('load')) {
  results.load = {};
  for (const { app, path, ready } of LOAD_PAGES) {
    for (const impl of IMPLS) {
      for (const h2 of [false, true]) {
        const server = await startServer({ app, impl, h2 });
        const runs = [];
        try {
          for (let i = 0; i < RUNS; i++) runs.push(await loadOnce(server.url + path, ready));
        } finally {
          server.close();
        }
        const key = `${app}${path === '/' ? '' : path} · ${impl} · ${h2 ? 'h2' : 'h1'}`;
        const pick = (field) => Math.round(median(runs.map((r) => r[field])) * 10) / 10;
        results.load[key] = {
          app: `${app}${path === '/' ? '' : path}`, impl, protocol: runs[0].protocol,
          fcp: pick('fcp'), lcp: pick('lcp'), ready: pick('ready'), tbt: pick('tbt'),
          jsKB: pick('jsKB'), jsFiles: runs[0].jsFiles, requests: runs[0].requests,
        };
        console.log(key.padEnd(34), JSON.stringify(results.load[key]));
      }
    }
  }
}

// ---------- Runtime + memory ----------
const BENCH = `(async () => {
  const $ = (s) => document.querySelector(s);
  const rows = () => document.querySelectorAll('tbody tr').length;
  const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  const click = (sel) => $(sel).click();
  // Start each measurement right after the browser has drawn a frame. Otherwise its next regular frame
  // (style, paint: several ms) lands inside the timed window more or less often depending on how long the
  // setup took, which penalised whichever framework's setup happened to line up with it. The timeout
  // keeps a page that never draws (headless, hidden) from waiting forever.
  const afterFrame = () => new Promise((r) => { let t; requestAnimationFrame(() => { clearTimeout(t); setTimeout(r, 0); }); t = setTimeout(r, 100); });
  const settle = async () => { await tick(); await tick(); window.gc?.(); await tick(); await afterFrame(); };
  const fresh = async (n) => { click('#clear'); await tick(); if (n) { click(n === 1000 ? '#run' : '#runlots'); await tick(); } };

  const ops = {
    'create 1,000 rows':      { setup: () => fresh(0),    run: () => click('#run'),      ok: () => rows() === 1000 },
    'replace 1,000 rows':     { setup: () => fresh(1000), run: () => click('#run'),      ok: () => rows() === 1000 },
    'update every 10th row':  { setup: () => fresh(1000), run: () => click('#update'),   ok: () => $('tbody tr:nth-child(11) .lbl').textContent.endsWith(' !!!') },
    'select a row':           { setup: () => fresh(1000), run: () => $('tbody tr:nth-child(2) .lbl').click(), ok: () => $('tbody tr:nth-child(2)').classList.contains('selected') },
    'swap two rows':          { setup: () => fresh(1000), run: () => click('#swaprows'), ok: () => true },
    'remove a row':           { setup: () => fresh(1000), run: () => $('tbody tr:nth-child(4) .remove').click(), ok: () => rows() === 999 },
    'create 10,000 rows':     { setup: () => fresh(0),    run: () => click('#runlots'),  ok: () => rows() === 10000, n: 5 },
    'append 1,000 rows':      { setup: () => fresh(1000), run: () => click('#add'),      ok: () => rows() === 2000 },
    'clear 1,000 rows':       { setup: () => fresh(1000), run: () => click('#clear'),    ok: () => rows() === 0 },
  };
  const out = {};
  for (const [name, op] of Object.entries(ops)) {
    const times = [];
    const n = op.n ?? 10;
    for (let i = 0; i < n + 3; i++) {
      await op.setup();
      await settle();
      const t0 = performance.now();
      op.run();
      await tick();
      document.body.offsetHeight; // include style and layout
      const t = performance.now() - t0;
      if (!op.ok()) throw new Error(name + ': wrong result');
      if (i >= 3) times.push(t); // first 3 are warm-up
    }
    times.sort((a, b) => a - b);
    out[name] = times[Math.floor(times.length / 2)];
  }
  click('#clear');
  return out;
})()`;

async function heapMB(page) {
  await page.send('HeapProfiler.collectGarbage');
  const { usedSize } = await page.send('Runtime.getHeapUsage');
  return Math.round((usedSize / 1024 / 1024) * 100) / 100;
}

if (want('runtime')) {
  results.runtime = {};
  results.memory = {};
  for (const impl of IMPLS) {
    const server = await startServer({ app: 'bench', impl });
    const perPage = [];
    let memory;
    try {
      for (let pass = 0; pass < 3; pass++) {
        const page = await browser.newPage();
        try {
          await page.send('Page.enable');
          await page.send('Page.addScriptToEvaluateOnNewDocument', { source: prodScript });
          const loaded = page.once('Page.loadEventFired');
          await page.send('Page.navigate', { url: `${server.url}/` });
          await loaded;
          await page.evaluate(`new Promise((r) => { const t = setInterval(() => document.querySelector('#run') && (clearInterval(t), r()), 20); })`);
          if (pass === 0) {
            const click = (sel, n) => page.evaluate(`(async () => { document.querySelector('${sel}').click();
              await new Promise((r) => { const t = setInterval(() => document.querySelectorAll('tbody tr').length === ${n} && (clearInterval(t), r()), 10); }); })()`);
            const m = { ready: await heapMB(page) };
            await click('#run', 1000);
            m['1,000 rows'] = await heapMB(page);
            await click('#runlots', 10000);
            m['10,000 rows'] = await heapMB(page);
            for (let i = 0; i < 5; i++) {
              await click('#run', 1000);
              await click('#clear', 0);
            }
            m['after 5 create/clear'] = await heapMB(page);
            memory = m;
          }
          perPage.push(await page.evaluate(BENCH));
        } finally {
          await page.close();
        }
      }
    } finally {
      server.close();
    }
    results.runtime[impl] = Object.fromEntries(
      Object.keys(perPage[0]).map((op) => [op, Math.round(median(perPage.map((p) => p[op])) * 10) / 10])
    );
    results.memory[impl] = memory;
    console.log(impl.padEnd(10), JSON.stringify(results.runtime[impl]));
    console.log(''.padEnd(10), 'memory MB', JSON.stringify(memory));
  }
}

mkdirSync(join(compare, 'results'), { recursive: true });
writeFileSync(resultsFile, JSON.stringify(results, null, 2) + '\n');
await browser.close();
console.log(`\nwrote ${resultsFile}`);
