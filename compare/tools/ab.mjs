// A/B: Pith before (a copy of an older pith/ in .pith-before/) vs Pith now, on every app's runtime operations,
// alternated in one session so noise cancels out.
//   node tools/ab.mjs [rounds=3] [--app trade,sheet] [--out ab-runtime.json]
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const results = join(import.meta.dirname, '..', 'results');
const args = process.argv.slice(2);
const rounds = Number(args[0]) || 3;
const opt = (name) => (args.includes(name) ? [name, args[args.indexOf(name) + 1]] : []);
const out = opt('--out')[1] ?? 'ab-runtime.json';
const runs = [];
for (let r = 0; r < rounds; r++) {
  for (const order of ['pith-before,pith', 'pith,pith-before']) {
    const file = `ab-tmp-${runs.length}.json`;
    execFileSync(process.execPath, [join(import.meta.dirname, 'measure.mjs'), 'runtime', '--rounds', '1', '--impl', order, ...opt('--app'), '--out', file], { stdio: 'ignore' });
    runs.push(JSON.parse(readFileSync(join(results, file), 'utf8')).runtime);
    rmSync(join(results, file));
  }
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const table = {};
console.log(`${'operation'.padEnd(36)}  before   after  change`);
for (const app of Object.keys(runs[0])) {
  for (const op of Object.keys(runs[0][app].pith)) {
    const before = median(runs.map((r) => r[app]['pith-before'][op]));
    const after = median(runs.map((r) => r[app].pith[op]));
    table[`${app}: ${op}`] = { before, after };
    console.log(`${`${app}: ${op}`.padEnd(36)} ${before.toFixed(1).padStart(7)} ${after.toFixed(1).padStart(7)} ${`${after < before ? '' : '+'}${Math.round(((after - before) / before) * 100)}%`.padStart(7)}`);
  }
}
writeFileSync(join(results, out), JSON.stringify(table, null, 2) + '\n');
