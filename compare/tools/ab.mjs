// A/B: Pith before (.pith-before/) vs Pith now, alternated in one session so noise cancels out.
//   node tools/ab.mjs [rounds=3] [--out ab-runtime.json]
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const results = join(import.meta.dirname, '..', 'results');
const rounds = Number(process.argv[2]) || 3;
const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? process.argv[outArg + 1] : 'ab-runtime.json';
const runs = [];
for (let r = 0; r < rounds; r++) {
  for (const order of ['pith-before,pith', 'pith,pith-before']) {
    const file = `ab-tmp-${runs.length}.json`;
    execFileSync(process.execPath, [join(import.meta.dirname, 'measure.mjs'), 'runtime', '--impl', order, '--out', file], { stdio: 'ignore' });
    runs.push(JSON.parse(readFileSync(join(results, file), 'utf8')).runtime);
    rmSync(join(results, file));
  }
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const table = {};
console.log(`${'operation'.padEnd(24)}  before   after  change`);
for (const op of Object.keys(runs[0].pith)) {
  const before = median(runs.map((r) => r['pith-before'][op]));
  const after = median(runs.map((r) => r.pith[op]));
  table[op] = { before, after };
  console.log(`${op.padEnd(24)} ${before.toFixed(1).padStart(7)} ${after.toFixed(1).padStart(7)} ${`${after < before ? '' : '+'}${Math.round(((after - before) / before) * 100)}%`.padStart(7)}`);
}
writeFileSync(join(results, out), JSON.stringify(table, null, 2) + '\n');
