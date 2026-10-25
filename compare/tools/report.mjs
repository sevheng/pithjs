// Turn results/*.json into RESULTS.md (tables only; the reading of them is in README.md).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const compare = join(import.meta.dirname, '..');
const read = (name) => {
  const file = join(compare, 'results', name);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
};
const measure = read('measure.json') ?? {};
const code = read('code.json');
const builds = read('build.json');

const IMPLS = ['pith', 'pith-vite', 'react', 'vue'];
const NAMES = { pith: 'Pith', 'pith-vite': 'Pith + Vite', react: 'React', vue: 'Vue' };
const APPS = { trade: 'Trading', sheet: 'Spreadsheet' };
const out = [];
const table = (head, rows) => {
  out.push(`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i ? '---:' : '---')).join('|')}|`);
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  out.push('');
};
// Bold the best number in each row of numeric cells (the lowest, or the highest with high = true).
const boldBest = (cells, high = false) => {
  const nums = cells.filter((c) => typeof c === 'number');
  const best = high ? Math.max(...nums) : Math.min(...nums);
  return cells.map((c) => (c === best ? `**${c}**` : c ?? '–'));
};
const r1 = (x) => (typeof x === 'number' ? Math.round(x * 10) / 10 : x);

out.push('# Results', '');
if (measure.environment) {
  const e = measure.environment;
  out.push(`Measured ${e.date.slice(0, 10)} with ${e.chrome}, Node ${e.node}. Medians of ${e.runs} runs (load) and of ` +
    `10 runs × 3 pages × ${e.rounds} rotated rounds (runtime; under load, one 5-second run per round).`, '');
}

if (measure.load) {
  out.push('## Load on a slow phone', '',
    'Fresh browser profile each run, Slow 4G (150 ms RTT, 1.6 Mbps) and 4× CPU slowdown. ' +
    '"Ready" = the real content is on screen (the watchlist and chart, or the grid). ' +
    '"Blocking" = long-task time over 50 ms before ready. Lower is better; best per row in bold.', '');
  for (const proto of ['h1', 'h2']) {
    out.push(`### Over ${proto === 'h1' ? 'HTTP/1.1' : 'HTTP/2'}`, '');
    for (const app of Object.keys(APPS)) {
      const get = (impl) => measure.load[`${app} · ${impl} · ${proto}`];
      if (!get('pith')) continue;
      table([APPS[app], ...IMPLS.map((i) => NAMES[i])], [
        ['JS downloaded (KB, gzip)', ...boldBest(IMPLS.map((i) => get(i)?.jsKB))],
        ['JS files', ...boldBest(IMPLS.map((i) => get(i)?.jsFiles))],
        ['First paint (ms)', ...boldBest(IMPLS.map((i) => get(i)?.fcp))],
        ['Ready (ms)', ...boldBest(IMPLS.map((i) => get(i)?.ready))],
        ['Blocking (ms)', ...boldBest(IMPLS.map((i) => get(i)?.tbt))],
      ]);
    }
  }
}

if (measure.runtime) {
  out.push('## Runtime (ms, lower is better)', '',
    'Desktop CPU. Time from the call (or click) to the DOM updated and laid out; best per row in bold.', '');
  for (const [app, byImpl] of Object.entries(measure.runtime)) {
    out.push(`### ${APPS[app] ?? app}`, '');
    const ops = Object.keys(byImpl.pith ?? Object.values(byImpl)[0]);
    table(['Operation', ...IMPLS.map((i) => NAMES[i])], ops.map((op) => [op, ...boldBest(IMPLS.map((i) => byImpl[i]?.[op]))]));
  }
}

if (measure.stress) {
  out.push('## Under load', '',
    'Sustained work for 5 seconds while every frame is recorded. Frames per second (higher is better), the median and ' +
    '95th-percentile frame time, and long tasks (main-thread work over 50 ms).', '');
  for (const [app, runs] of Object.entries(measure.stress)) {
    for (const [name, byImpl] of Object.entries(runs)) {
      out.push(`### ${APPS[app] ?? app}: ${name}`, '');
      table(['', ...IMPLS.map((i) => NAMES[i])], [
        ['Frames per second', ...boldBest(IMPLS.map((i) => r1(byImpl[i]?.fps)), true)],
        ['Frame, median (ms)', ...boldBest(IMPLS.map((i) => r1(byImpl[i]?.frameP50)))],
        ['Frame, 95th percentile (ms)', ...boldBest(IMPLS.map((i) => r1(byImpl[i]?.frameP95)))],
        ['Long tasks', ...boldBest(IMPLS.map((i) => r1(byImpl[i]?.longTasks)))],
        ['Long-task time (ms)', ...boldBest(IMPLS.map((i) => r1(byImpl[i]?.longMs)))],
      ]);
    }
  }
}

if (measure.memory) {
  out.push('## Memory (JS heap after GC, MB, lower is better)', '');
  for (const [app, byImpl] of Object.entries(measure.memory)) {
    out.push(`### ${APPS[app] ?? app}`, '');
    const states = Object.keys(byImpl.pith ?? Object.values(byImpl)[0]);
    table(['State', ...IMPLS.map((i) => NAMES[i])], states.map((s) => [s, ...boldBest(IMPLS.map((i) => byImpl[i]?.[s]))]));
  }
}

if (code) {
  out.push('## Code (lines of app code, without comments and blank lines)', '',
    'The shared code (the feed, the chart geometry, the formula engine, the formatting) is the same for all and not counted.', '');
  table(['App', 'Pith', 'React', 'Vue'], Object.keys(APPS).filter((a) => code.code[`${a}/pith`]).map((app) => [
    APPS[app], ...boldBest(['pith', 'react', 'vue'].map((i) => code.code[`${app}/${i}`].lines)),
  ]));
  out.push('## Developer experience', '');
  const b = (app, impl) => builds?.[`${app}/${impl}`];
  table(['', 'Pith', 'React', 'Vue'], [
    ['npm packages to install', ...['pith', 'react', 'vue'].map((i) => code.deps[i].total)],
    ['node_modules size (MB)', ...['pith', 'react', 'vue'].map((i) => code.deps[i].diskMB)],
    ['Build step', 'none', 'Vite', 'Vite'],
    ['Production build of Trading (ms)', '0', b('trade', 'react') ?? '–', b('trade', 'vue') ?? '–'],
    ['Config files', '0', '1 (vite.config.js)', '1 (vite.config.js)'],
  ]);
}

writeFileSync(join(compare, 'RESULTS.md'), out.join('\n'));
console.log(`wrote RESULTS.md (${out.length} lines)`);
