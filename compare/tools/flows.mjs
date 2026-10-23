// Run the shared user flows against every implementation.
//   node tools/flows.mjs [todo|crm|bench] [mini|react|vue|mini-vite] [--flows path/to/flows.js] [--deploy]
//   --deploy: mini loads its no-build production copy (mini.min.js), as measure.mjs loads it
// Exits non-zero if any flow fails anywhere.

import { findChrome, loadPage, parseResults } from '../../framework/tools/chrome.mjs';
import { resolve } from 'node:path';
import { startServer, IMPLS } from './server.mjs';

const args = process.argv.slice(2);
const apps = args.filter((a) => ['todo', 'crm', 'bench'].includes(a));
const impls = args.filter((a) => IMPLS.includes(a));
const flowsArg = args.indexOf('--flows');
const flows = flowsArg >= 0 ? resolve(args[flowsArg + 1]) : null;
const chrome = findChrome();
if (!chrome) throw new Error('Chrome not found (set CHROME_PATH)');

let failures = 0;
for (const app of apps.length ? apps : ['todo', 'crm', 'bench']) {
  for (const impl of impls.length ? impls : IMPLS) {
    const server = await startServer({ app, impl, flows, deploy: args.includes('--deploy') });
    try {
      const { dom, consoleLines } = await loadPage(chrome, `${server.url}/__mini/flows.html`);
      const results = parseResults(dom);
      const failed = results.filter((r) => !r.ok);
      const problems = consoleLines.filter((l) => /Uncaught|Error|\[mini /.test(l));
      const ok = results.length > 0 && failed.length === 0 && problems.length === 0;
      if (!ok) failures++;
      console.log(`${ok ? '✓' : '✗'} ${app}/${impl}: ${results.length - failed.length}/${results.length} flows passed`);
      if (!results.length) console.log('    the flows page did not finish');
      // The whole message: the page outline, and (Mini, dev mode) the app's state after it.
      for (const f of failed) console.log(`    ✗ ${f.name.split('\n').join('\n      ')}`);
      for (const p of problems) console.log(`    console: ${p}`);
    } finally {
      server.close();
    }
  }
}
process.exit(failures ? 1 : 0);
