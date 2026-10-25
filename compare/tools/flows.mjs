// Run the shared user flows against every implementation.
//   node tools/flows.mjs [trade|sheet] [pith|react|vue|pith-vite] [--flows path/to/flows.js] [--deploy]
//   --deploy: pith loads its no-build production copy (pith.min.js), as measure.mjs loads it
// Exits non-zero if any flow fails anywhere.

import { findChrome, loadPage, parseResults } from '../../framework/tools/chrome.mjs';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { startServer, appRoot, APPS, IMPLS } from './server.mjs';

const args = process.argv.slice(2);
const apps = args.filter((a) => APPS.includes(a));
const impls = args.filter((a) => IMPLS.includes(a));
const flowsArg = args.indexOf('--flows');
const flows = flowsArg >= 0 ? resolve(args[flowsArg + 1]) : null;
const chrome = findChrome();
if (!chrome) throw new Error('Chrome not found (set CHROME_PATH)');

let failures = 0;
for (const app of apps.length ? apps : APPS) {
  for (const impl of impls.length ? impls : IMPLS.filter((i) => i !== 'pith-before')) {
    if (!existsSync(appRoot(app, impl))) { console.log(`✗ ${app}/${impl}: not built (npm run build)`); failures++; continue; }
    const server = await startServer({ app, impl, flows, deploy: args.includes('--deploy') });
    try {
      const { dom, consoleLines } = await loadPage(chrome, `${server.url}/__pith/flows.html`);
      const results = parseResults(dom);
      const failed = results.filter((r) => !r.ok);
      const problems = consoleLines.filter((l) => /Uncaught|Error|\[pith /.test(l));
      const ok = results.length > 0 && failed.length === 0 && problems.length === 0;
      if (!ok) failures++;
      console.log(`${ok ? '✓' : '✗'} ${app}/${impl}: ${results.length - failed.length}/${results.length} flows passed`);
      if (!results.length) console.log('    the flows page did not finish');
      // The whole message: the page outline, and (Pith, dev mode) the app's state after it.
      for (const f of failed) console.log(`    ✗ ${f.name.split('\n').join('\n      ')}`);
      for (const p of problems) console.log(`    console: ${p}`);
    } finally {
      server.close();
    }
  }
}
process.exit(failures ? 1 : 0);
