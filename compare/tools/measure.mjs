// Measure every implementation the same way, with real (not virtual) time:
//   load:    fresh profile per run, "slow 4G + 4x slower CPU" phone profile, over HTTP/1.1 and HTTP/2
//   runtime: each app's operations (median of 10, after warm-up, GC between runs; 3 pages per implementation
//            per round, --rounds rounds in rotated order)
//   stress:  each app under sustained load for a few seconds: frames per second, frame times, long tasks
//   memory:  JS heap after GC in each app's states
//
//   node tools/measure.mjs [load] [runtime] [stress] [memory] [--app trade,sheet] [--runs 9] [--rounds 4]
//                          [--source] [--impl pith,pith-vite,react,vue] [--out file.json]
//
// What to measure comes from each app's <app>/measure.js (see the contract at the end of this comment).
// Writes results/measure.json. Pith runs with dev warnings off (PITH_DEV=false), like the others'
// production builds. Its load test serves it as deployed without a build: one file, pith.min.js
// (framework/tools/release.mjs). --source loads its dev sources instead (dev code included).
//
// <app>/measure.js exports (scripts are strings evaluated in the page, with the helpers below as __m):
//   load:    { path, ready }                       ready: a CSS selector present once real content is on screen
//   runtime: [{ path, script }]                    script resolves to { 'operation': ms } via __m.ops({...})
//   stress:  [{ name, path, script }]              script resolves to __m.underLoad(...)'s result
//   memory:  [{ name, path, script? }]             script (optional) brings the page to that state first
// In the page:
//   __m.ops({ name: { setup, run, ok, n? } })      setup/run may be async; run's own work is what's timed:
//                                                  from run() to the DOM updated and laid out
//   __m.underLoad(start, stop, ms = 5000)          frames per second, median / 95th-percentile frame and long tasks
//   __m.tick(), __m.afterFrame(), __m.waitFor(fn)

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { findChrome } from '../../framework/tools/chrome.mjs';
import { launch } from './cdp.mjs';
import { startServer, APPS } from './server.mjs';

const compare = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const PARTS = ['load', 'runtime', 'stress', 'memory'];
const want = (part) => !args.some((a) => PARTS.includes(a)) || args.includes(part);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const RUNS = Number(opt('--runs', 9));
const ROUNDS = Number(opt('--rounds', 4));
const IMPLS = opt('--impl', 'pith,pith-vite,react,vue').split(',');
const ONLY_APPS = opt('--app', APPS.join(',')).split(',');
const DEPLOY = !args.includes('--source');
const OUT = opt('--out', 'measure.json');

const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const specs = {};
for (const app of ONLY_APPS) specs[app] = await import(join(compare, app, 'measure.js'));

const chromePath = findChrome();
if (!chromePath) throw new Error('Chrome not found (set CHROME_PATH)');
const browser = await launch(chromePath);
const resultsFile = join(compare, 'results', OUT);
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, 'utf8')) : {};
results.environment = {
  ...results.environment,
  date: new Date().toISOString(),
  chrome: (await (await browser.newPage()).evaluate('navigator.userAgent')).match(/Chrome\/[\d.]+/)?.[0],
  node: process.version,
  ...(want('load') ? { runs: RUNS } : {}),
  ...(want('runtime') || want('stress') ? { rounds: ROUNDS } : {}),
};

// Turn off Pith's dev warnings for measurements (the server injects nothing into React/Vue).
const prodScript = 'globalThis.PITH_DEV = false;';

// The in-page helpers every app's script uses, so all are timed the same way.
const helpers = `
globalThis.__m = (() => {
  const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  // Start each measurement right after the browser has drawn a frame. Otherwise its next regular frame
  // (style, paint: several ms) lands inside the timed window more or less often depending on how long the
  // setup took. The timeout keeps a page that never draws (headless, hidden) from waiting forever.
  const afterFrame = () => new Promise((r) => { let t; requestAnimationFrame(() => { clearTimeout(t); setTimeout(r, 0); }); t = setTimeout(r, 100); });
  const settle = async () => { await tick(); await tick(); globalThis.gc?.(); await tick(); await afterFrame(); };
  const waitFor = async (fn, ms = 10000) => { const end = performance.now() + ms; while (!fn()) { if (performance.now() > end) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 10)); } };
  async function ops(list) {
    const out = {};
    for (const [name, op] of Object.entries(list)) {
      const times = [];
      const n = op.n ?? 10;
      for (let i = 0; i < n + 3; i++) {
        await op.setup?.();
        await settle();
        const t0 = performance.now();
        const p = op.run();
        if (p?.then) await p;
        await tick();
        document.body.offsetHeight; // include style and layout
        const t = performance.now() - t0;
        if (!(await op.ok())) throw new Error(name + ': wrong result');
        if (i >= 3) times.push(t); // the first 3 are warm-up
      }
      times.sort((a, b) => a - b);
      out[name] = times[Math.floor(times.length / 2)];
    }
    return out;
  }
  // Run the app under load for ms and record every frame: how smooth it stays, and how much it blocks.
  async function underLoad(start, stop, ms = 5000) {
    await settle();
    const frames = [];
    let longTasks = 0, longMs = 0;
    const obs = new PerformanceObserver((l) => { for (const e of l.getEntries()) { longTasks++; longMs += e.duration; } });
    try { obs.observe({ type: 'longtask' }); } catch {}
    let last = 0, running = true;
    const frame = (t) => { if (last) frames.push(t - last); last = t; if (running) requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    const t0 = performance.now();
    await start();
    await new Promise((r) => setTimeout(r, ms));
    await stop();
    running = false;
    const elapsed = performance.now() - t0;
    obs.disconnect();
    const s = [...frames].sort((a, b) => a - b);
    const pick = (q) => s[Math.min(s.length - 1, Math.floor(s.length * q))];
    return { fps: (frames.length / elapsed) * 1000, frameP50: pick(0.5), frameP95: pick(0.95), longTasks, longMs };
  }
  return { tick, afterFrame, settle, waitFor, ops, underLoad };
})();`;

async function heapMB(page) {
  await page.send('HeapProfiler.collectGarbage');
  const { usedSize } = await page.send('Runtime.getHeapUsage');
  return Math.round((usedSize / 1024 / 1024) * 100) / 100;
}

/** A fresh page on path, with the helpers in it, once its load event fired. */
async function openPage(server, path) {
  const page = await browser.newPage();
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: prodScript + helpers });
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url: server.url + path });
  await loaded;
  return page;
}

// ---------- Load ----------
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
  for (const app of ONLY_APPS) {
    const { path, ready } = specs[app].load;
    for (const impl of IMPLS) {
      for (const h2 of [false, true]) {
        const server = await startServer({ app, impl, h2, deploy: DEPLOY });
        const runs = [];
        try {
          for (let i = 0; i < RUNS; i++) {
            // A rare load hangs (seen once in ~200 over HTTP/2); retry it once instead of losing the whole run.
            runs.push(await loadOnce(server.url + path, ready).catch((err) => {
              console.warn(`  retrying after: ${err.message}`);
              return loadOnce(server.url + path, ready);
            }));
          }
        } finally {
          server.close();
        }
        const key = `${app} · ${impl} · ${h2 ? 'h2' : 'h1'}`;
        const pick = (field) => round1(median(runs.map((r) => r[field])));
        results.load[key] = {
          app, impl, protocol: runs[0].protocol,
          fcp: pick('fcp'), lcp: pick('lcp'), ready: pick('ready'), tbt: pick('tbt'),
          jsKB: pick('jsKB'), jsFiles: runs[0].jsFiles, requests: runs[0].requests,
        };
        console.log(key.padEnd(26), JSON.stringify(results.load[key]));
      }
    }
  }
}

// ---------- Runtime and stress ----------
// Rounds, with the implementations in a rotated order each round, and medians over all of them: whichever runs
// first is otherwise measured on a warmer, busier machine.
async function rounds(label, each) {
  const perImpl = Object.fromEntries(IMPLS.map((i) => [i, []]));
  for (let round = 0; round < ROUNDS; round++) {
    for (const impl of [...IMPLS.slice(round % IMPLS.length), ...IMPLS.slice(0, round % IMPLS.length)]) {
      perImpl[impl].push(...(await each(impl)));
      console.log(`${label} round ${round + 1}/${ROUNDS}`, impl);
    }
  }
  const out = {};
  for (const impl of IMPLS) {
    const all = perImpl[impl];
    out[impl] = Object.fromEntries(Object.keys(all[0]).map((k) => [k, round1(median(all.map((r) => r[k])))]));
    console.log(impl.padEnd(10), JSON.stringify(out[impl]));
  }
  return out;
}

async function inPages(app, impl, path, script, passes) {
  const server = await startServer({ app, impl });
  const got = [];
  try {
    for (let pass = 0; pass < passes; pass++) {
      const page = await openPage(server, path);
      try {
        got.push(await page.evaluate(script));
      } finally {
        await page.close();
      }
    }
  } finally {
    server.close();
  }
  return got;
}

if (want('runtime')) {
  results.runtime = {};
  for (const app of ONLY_APPS) {
    results.runtime[app] = await rounds(`${app} runtime`, async (impl) => {
      // Each of the app's pages (e.g. ?n=40 and ?n=1000) adds its operations to the same record.
      const pages = [];
      for (const { path, script } of specs[app].runtime) pages.push(await inPages(app, impl, path, script, 3));
      return pages[0].map((_, pass) => Object.assign({}, ...pages.map((p) => p[pass])));
    });
  }
}

if (want('stress')) {
  results.stress = {};
  for (const app of ONLY_APPS) {
    for (const { name, path, script } of specs[app].stress) {
      const byImpl = await rounds(`${app} stress ${name}`, (impl) => inPages(app, impl, path, script, 1));
      (results.stress[app] ??= {})[name] = byImpl;
    }
  }
}

if (want('memory')) {
  results.memory = {};
  for (const app of ONLY_APPS) {
    const byImpl = (results.memory[app] = {});
    for (const impl of IMPLS) {
      const server = await startServer({ app, impl });
      try {
        for (const { name, path, script } of specs[app].memory) {
          const page = await openPage(server, path);
          try {
            if (script) await page.evaluate(script);
            (byImpl[impl] ??= {})[name] = await heapMB(page);
          } finally {
            await page.close();
          }
        }
      } finally {
        server.close();
      }
      console.log(`${app} memory`, impl.padEnd(10), JSON.stringify(byImpl[impl]));
    }
  }
}

mkdirSync(join(compare, 'results'), { recursive: true });
writeFileSync(resultsFile, JSON.stringify(results, null, 2) + '\n');
await browser.close();
console.log(`\nwrote ${resultsFile}`);
