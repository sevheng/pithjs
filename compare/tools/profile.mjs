// CPU-profile one benchmark operation and print where the time goes (self time by function).
//   node tools/profile.mjs [impl] [op]     op: run | runlots | add | update | swaprows | clear (button ids)
import { findChrome } from '../../framework/tools/chrome.mjs';
import { launch } from './cdp.mjs';
import { startServer } from './server.mjs';

const [impl = 'mini', op = 'run'] = process.argv.slice(2);
const server = await startServer({ app: 'bench', impl });
const browser = await launch(findChrome());
const page = await browser.newPage();
await page.send('Page.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: 'globalThis.MINI_DEV = false;' });
const loaded = page.once('Page.loadEventFired');
await page.send('Page.navigate', { url: `${server.url}/` });
await loaded;
await page.evaluate(`new Promise((r) => { const t = setInterval(() => document.querySelector('#run') && (clearInterval(t), r()), 20); })`);

// Setup (outside the profile) and the measured operation (inside it), 20 times.
const tick = `new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); })`;
const SETUP = { run: '#clear', runlots: '#clear', update: '#run', clear: '#run', swaprows: '#run', add: '#run' };
const setup = `(async () => { document.querySelector('${SETUP[op] ?? '#clear'}').click(); await ${tick}; document.body.offsetHeight; window.gc?.(); })()`;
const measured = `(async () => { document.querySelector('#${op}').click(); await ${tick}; document.body.offsetHeight; })()`;
for (let i = 0; i < 5; i++) { await page.evaluate(setup); await page.evaluate(measured); } // warm up
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
console.log(`${impl} · ${op}: top self time (${total} samples)`);
for (const [key, n] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 22)) {
  console.log(`${((n / total) * 100).toFixed(1).padStart(5)}%  ${key}`);
}
await page.close();
await browser.close();
server.close();
