// CPU-profile one operation and print where the time goes (self time by function).
//   node tools/profile.mjs <app> <impl> '<setup js>' '<run js>' [path]
//   e.g. node tools/profile.mjs sheet pith 'bench.fill()' 'bench.set("A1", String(Math.random()))'
// setup runs outside the profile, run inside it (then one task and a layout), 20 times after 5 warm-ups.
import { findChrome } from '../../framework/tools/chrome.mjs';
import { launch } from './cdp.mjs';
import { startServer } from './server.mjs';

const [app = 'sheet', impl = 'pith', setupJs = '', runJs = '', path = '/'] = process.argv.slice(2);
const server = await startServer({ app, impl });
const browser = await launch(findChrome());
const page = await browser.newPage();
await page.send('Page.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: 'globalThis.PITH_DEV = false;' });
const loaded = page.once('Page.loadEventFired');
await page.send('Page.navigate', { url: server.url + path });
await loaded;
await page.evaluate(`new Promise((r) => { const t = setInterval(() => window.bench && (clearInterval(t), r()), 20); })`);

const tick = `new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); })`;
const setup = `(async () => { await (async () => { ${setupJs} })(); await ${tick}; document.body.offsetHeight; window.gc?.(); })()`;
const measured = `(async () => { await (async () => { ${runJs} })(); await ${tick}; document.body.offsetHeight; })()`;
for (let i = 0; i < 5; i++) { await page.evaluate(setup); await page.evaluate(measured); }
await page.send('Profiler.enable');
await page.send('Profiler.setSamplingInterval', { interval: 25 });
const profiles = [];
for (let i = 0; i < 20; i++) {
  await page.evaluate(setup);
  await page.send('Profiler.start');
  await page.evaluate(measured);
  profiles.push((await page.send('Profiler.stop')).profile);
}

// Self time per function, from the sample counts.
const self = new Map();
let total = 0;
for (const profile of profiles) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const counts = new Map();
  for (const id of profile.samples) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    const { functionName, url, lineNumber } = byId.get(id).callFrame;
    if (functionName === '(idle)' || functionName === '(program)') continue;
    const where = url ? `${url.replace(/^https?:\/\/[^/]+/, '')}:${lineNumber + 1}` : '';
    const key = `${functionName || '(anonymous)'} ${where}`;
    self.set(key, (self.get(key) ?? 0) + n);
    total += n;
  }
}
console.log(`${app}/${impl}: top self time (${total} samples)`);
for (const [key, n] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 22)) {
  console.log(`${((n / total) * 100).toFixed(1).padStart(5)}%  ${key}`);
}
await page.close();
await browser.close();
server.close();
