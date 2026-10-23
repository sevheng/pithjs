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
const ai = read('ai.json');

const IMPLS = ['pith', 'pith-vite', 'react', 'vue'];
const NAMES = { pith: 'Pith', 'pith-vite': 'Pith + Vite', react: 'React', vue: 'Vue', 'pith-fine': 'Pith, fine-grained rows' };
// Runtime and memory also show Pith with fine-grained rows (bench/pith-fine, an opt-in pattern), when measured.
const BENCH_IMPLS = [...IMPLS, ...(measure.runtime?.['pith-fine'] ? ['pith-fine'] : [])];
const out = [];
const table = (head, rows) => {
  out.push(`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i ? '---:' : '---')).join('|')}|`);
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  out.push('');
};
// Bold the best (lowest) number in each row of numeric cells.
const boldBest = (cells) => {
  const nums = cells.map((c) => (typeof c === 'number' ? c : null));
  const best = Math.min(...nums.filter((n) => n !== null));
  return cells.map((c) => (c === best ? `**${c}**` : c ?? '–'));
};

out.push('# Results', '');
if (measure.environment) {
  const e = measure.environment;
  out.push(`Measured ${e.date.slice(0, 10)} with ${e.chrome}, Node ${e.node}. Medians of ${e.runs} runs (load) and 10 runs × 3 pages × 4 rotated rounds (runtime).`, '');
}

if (measure.load) {
  out.push('## Load on a slow phone', '',
    'Fresh browser profile each run, Slow 4G (150 ms RTT, 1.6 Mbps) and 4× CPU slowdown. ' +
    '"Ready" = the page\'s real content is on screen (todos, stats, or table rows). ' +
    '"Blocking" = long-task time over 50 ms before ready. Lower is better; best per row in bold.', '');
  const pages = [...new Set(Object.values(measure.load).map((r) => r.app))];
  for (const proto of ['h1', 'h2']) {
    out.push(`### Over ${proto === 'h1' ? 'HTTP/1.1' : 'HTTP/2'}`, '');
    for (const page of pages) {
      const get = (impl) => measure.load[`${page} · ${impl} · ${proto}`];
      table([`\`${page}\``, ...IMPLS.map((i) => NAMES[i])], [
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
    'js-framework-benchmark-style operations on the bench app, desktop CPU. Time from click to DOM updated and laid out.', '');
  const ops = Object.keys(measure.runtime.pith ?? {});
  table(['Operation', ...BENCH_IMPLS.map((i) => NAMES[i])], ops.map((op) => [op, ...boldBest(BENCH_IMPLS.map((i) => measure.runtime[i]?.[op]))]));
  if (BENCH_IMPLS.includes('pith-fine')) {
    out.push('"Pith, fine-grained rows" is the same Pith app with each row\'s label as a signal (bench/pith-fine), an opt-in pattern for big, busy lists. "Pith" is the default way to write it.', '');
  }
}

const ab = read('ab-runtime.json');
if (ab) {
  out.push('### Pith before and after the optimization pass', '',
    'Same session, old and new Pith alternated 6 times (medians), so session-to-session noise cancels out.',
    'Measured 2026-10-22, before runs started right after a frame: that timing penalised remove and select, so',
    'their "after" here is worse than in the main table above. The other operations show the pass itself.', '');
  table(['Operation', 'Pith before', 'Pith after', 'change'], Object.entries(ab).map(([op, { before, after }]) =>
    [op, Math.round(before * 10) / 10, Math.round(after * 10) / 10, `${after < before ? '' : '+'}${Math.round(((after - before) / before) * 100)}%`]));
}

if (measure.memory) {
  out.push('## Memory (JS heap, MB, lower is better)', '');
  const rows = Object.keys(measure.memory.pith ?? {});
  table(['State', ...BENCH_IMPLS.map((i) => NAMES[i])], rows.map((r) => [r, ...boldBest(BENCH_IMPLS.map((i) => measure.memory[i]?.[r]))]));
}

if (code) {
  out.push('## Code (lines of app code, without comments and blank lines)', '');
  table(['App', 'Pith', 'React', 'Vue'], ['todo', 'crm', 'bench'].map((app) => [
    app, ...boldBest(['pith', 'react', 'vue'].map((i) => code.code[`${app}/${i}`].lines)),
  ]));
  out.push('## Developer experience', '');
  const b = (app, impl) => builds?.[`${app}/${impl}`];
  table(['', 'Pith', 'React', 'Vue'], [
    ['npm packages to install', ...['pith', 'react', 'vue'].map((i) => code.deps[i].total)],
    ['node_modules size (MB)', ...['pith', 'react', 'vue'].map((i) => code.deps[i].diskMB)],
    ['Build step', 'none', 'Vite', 'Vite'],
    ['Production build of the CRM (ms)', '0', b('crm', 'react') ?? '–', b('crm', 'vue') ?? '–'],
    ['Config files', '0', '1 (vite.config.js)', '1 (vite.config.js)'],
  ]);
}

if (ai) {
  out.push('## AI-friendliness', '', ai.method, '');
  table(['Task', 'Pith', 'React', 'Vue'], ai.tasks.map((t) => [t.name, ...['pith', 'react', 'vue'].map((i) => t[i])]));
  if (ai.notes) out.push(...ai.notes.map((n) => `- ${n}`), '');
}

writeFileSync(join(compare, 'RESULTS.md'), out.join('\n'));
console.log(`wrote RESULTS.md (${out.length} lines)`);
