// npm run check (from a project folder): one command that tells you whether everything still works.
//   1. Node tests: framework/tests/*.test.mjs and the project's tests/*.test.mjs
//   2. framework tests (framework/tests/index.html) in headless Chrome
//   3. user flows (the project's tests/flows.js): click, type, see, like a person
//   4. every route in app/router.js renders, with a title and no errors or [mini] warnings,
//      and doesn't scroll sideways on a phone-sized screen (390px). :param routes are checked with the
//      first URL the project's prerender.mjs lists for them (if it lists any).
//   5. types: JSDoc type check with TypeScript (fetched once by npx; skipped if offline)
//   6. size: the whole framework, minified + gzipped, stays within its 10 KB budget (tools/size.mjs)
//   7. preloads: index.html preloads exactly the modules the app loads at startup (tools/preloads.mjs)
// Stages that don't apply (e.g. no app/router.js when run from framework/) are skipped.
// Flags: --json prints one JSON object (for tools and AI agents).
//        --build builds the app with Vite first (npm run build) and checks the built dist/ instead,
//        including that every route, and every URL prerender.mjs lists, was prerendered to dist/<path>/index.html.
// Set CHROME_PATH if Chrome isn't found.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { findChrome, loadPage, parseResults, unescapeHtml } from './chrome.mjs';
import { routeFile } from './prerender.mjs';
import { prerenderTargets } from './routes.mjs';
import { startServer, projectRoot } from './dev-server.mjs';
import { BUDGET, measureFramework } from './size.mjs';
import { checkPreloads } from './preloads.mjs';

const frameworkTests = join(import.meta.dirname, '..', 'tests');
const project = (...parts) => join(projectRoot, ...parts);

// Every fixed route in app/router.js is checked, so new pages are covered automatically, plus one URL per
// :param route from prerender.mjs (all of them are checked for their prerendered file with --build).
const { targets, warnings: pathWarnings } = await prerenderTargets(projectRoot);
const ROUTES = targets.filter((t) => !t.extra).map((t) => t.path);
const EXTRA = targets.filter((t) => t.extra);
const SAMPLES = EXTRA.filter((t, i) => EXTRA.findIndex((u) => u.route === t.route) === i).map((t) => t.path);
const NOT_FOUND = '/__check-unknown-page__';
const PAGES = ROUTES.length || SAMPLES.length ? [...ROUTES, ...SAMPLES, NOT_FOUND] : [];
const hasFlows = existsSync(project('tests', 'flows.js'));
const PROBLEM = /\[mini |Uncaught|Error|Failed to load/;
const json = process.argv.includes('--json');
const built = process.argv.includes('--build');

// --build: the route's HTML file must hold its prerendered page, so it shows before JS runs.
// Routes that redirect (a `redirect`, or the guard) are left out on purpose; other prerender warnings fail.
let prerendered = null;
function prerenderProblems(path) {
  if (prerendered?.redirected?.includes(path)) return [];
  const warning = prerendered?.warnings.find((w) => w.includes(` ${path} `) && !w.includes('W063'));
  if (warning) return [warning];
  const file = join('dist', routeFile(path));
  if (!existsSync(project(file))) return [`not prerendered: ${file} is missing`];
  const page = readFileSync(project(file), 'utf8');
  if (!/<div\b[^>]*\bdata-prerendered\b/.test(page)) return [`not prerendered: ${file} has no data-prerendered markup in #app`];
  if (!/<h1[\s>]/.test(page)) return [`not prerendered: ${file} has no <h1> before JS runs`];
  return [];
}

const report = { ok: true, build: null, node: null, framework: null, flows: null, pages: [], types: null, size: null, preloads: null };

if (built) {
  const { buildProject } = await import('./build.mjs');
  try {
    report.build = { ok: true, ms: await buildProject({ quiet: true, onPrerender: (done) => (prerendered = done) }) };
  } catch (err) {
    report.build = { ok: false, error: String(err?.message ?? err) };
  }
}

// The size budget is measured in the background too.
const sizeDone = measureFramework().then(
  (size) => (size.skipped ? { ok: true, ...size } : { ok: size.core <= BUDGET, budget: BUDGET, ...size }),
  (err) => ({ ok: false, error: String(err?.message ?? err) })
);

// Types run in the background while the browser stages run.
const typesDone = !existsSync(project('jsconfig.json'))
  ? Promise.resolve({ ok: true, skipped: 'no jsconfig.json in this folder' })
  : new Promise((resolve) => {
      const child = spawn('npx', ['-y', '-p', 'typescript@5.9.3', 'tsc', '-p', 'jsconfig.json', '--pretty', 'false'], { cwd: projectRoot });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
      child.on('error', () => resolve({ ok: true, skipped: 'npx not available' }));
      child.on('close', (code) => {
        const errors = out.split('\n').filter((l) => l.includes('error TS'));
        if (code === 0) resolve({ ok: true, errors: [] });
        else if (errors.length) resolve({ ok: false, errors });
        else resolve({ ok: true, skipped: 'TypeScript could not be fetched (offline?)' });
      });
    });

// ---------- 1. Node tests ----------
const testFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).map((f) => join(dir, f)) : []);
const nodeFiles = [...new Set([...testFiles(frameworkTests), ...testFiles(project('tests'))])];
const node = spawnSync(process.execPath, ['--test', ...nodeFiles], { encoding: 'utf8', cwd: projectRoot });
const count = (label) => Number(node.stdout.match(new RegExp(`ℹ ${label} (\\d+)`))?.[1] ?? 0);
report.node = {
  ok: node.status === 0,
  passed: count('pass'),
  failed: node.stdout.split('\n').filter((l) => /^\s*✖/.test(l) && !/failing tests/.test(l)).map((l) => l.trim()),
};

// ---------- 2-4. Browser ----------
const chrome = findChrome();
if (!chrome) {
  report.ok = false;
  report.error = 'Chrome not found. Install Chrome/Chromium or set CHROME_PATH=/path/to/chrome';
} else if (report.build?.ok === false) {
  report.ok = false;
} else {
  const server = await startServer(0, { dist: built });
  const base = `http://localhost:${server.address().port}`;
  try {
    const suite = async (path) => {
      const { dom, consoleLines } = await loadPage(chrome, base + path);
      const results = parseResults(dom);
      return {
        ok: results.length > 0 && results.every((r) => r.ok),
        passed: results.filter((r) => r.ok).length,
        failed: results.length ? results.filter((r) => !r.ok).map((r) => r.name) : ['the page did not finish (no results found)'],
        console: consoleLines.filter((l) => PROBLEM.test(l)),
      };
    };
    const phone = (path) => loadPage(chrome, `${base}/__mini/see.html?${new URLSearchParams({ path, width: '390', height: '844' })}`);
    const [framework, flows, ...loaded] = await Promise.all([
      suite('/__mini/'),
      hasFlows ? suite('/__mini/flows.html') : null,
      ...PAGES.map((path) => loadPage(chrome, base + path)),
      ...PAGES.map(phone),
    ]);
    const pages = loaded.slice(0, PAGES.length);
    const phones = loaded.slice(PAGES.length);
    report.framework = framework;
    // Flows exercise the real app, so any console problem during them is a failure too.
    report.flows = flows ? { ...flows, ok: flows.ok && flows.console.length === 0 } : { ok: true, skipped: 'no tests/flows.js in this folder' };
    const titleOf = (dom) => unescapeHtml(dom.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
    const notFoundTitle = PAGES.length ? titleOf(pages.at(-1).dom) : '';
    report.pages = PAGES.map((path, i) => {
      const { dom, consoleLines } = pages[i];
      const title = titleOf(dom);
      const problems = consoleLines.filter((l) => PROBLEM.test(l));
      if (path !== NOT_FOUND && title === notFoundTitle) problems.unshift(`shows the not-found page ("${title}"): the route doesn't match`);
      if (!title) problems.unshift('the page has no title');
      if (!/<h1[\s>]/.test(dom)) problems.unshift('nothing rendered (no <h1>)');
      if (built && path !== NOT_FOUND) problems.push(...prerenderProblems(path));
      const layout = unescapeHtml(phones[i].dom.match(/<pre id="layout">([\s\S]*?)<\/pre>/)?.[1] ?? '');
      if (layout) problems.push(`on a phone (390px): ${layout}`);
      return { path: path === NOT_FOUND ? '(unknown URL)' : path, title, ok: problems.length === 0, problems };
    });
    // --build: the other prerender.mjs URLs only need their file (loading each in Chrome would be slow).
    if (built) {
      for (const { path } of EXTRA.filter((t) => !SAMPLES.includes(t.path))) {
        const problems = prerenderProblems(path);
        const file = project('dist', routeFile(path));
        const title = existsSync(file) ? titleOf(readFileSync(file, 'utf8')) : '';
        report.pages.push({ path, title: `${title} (prerendered file)`, ok: problems.length === 0, problems });
      }
    }
  } finally {
    server.close();
  }
}

// Bad URLs in prerender.mjs (W064–W066) fail the check, with or without --build.
if (pathWarnings.length) report.pages.push({ path: 'prerender.mjs', title: '', ok: false, problems: pathWarnings });

report.types = await typesDone;
report.size = await sizeDone;
const preloads = checkPreloads();
report.preloads = preloads.skipped ? { ok: true, ...preloads } : { ok: !preloads.missing.length && !preloads.unused.length, ...preloads };
report.ok &&= [report.build ?? { ok: true }, report.node, report.framework, report.flows, ...report.pages, report.types, report.size, report.preloads].every((r) => r?.ok);

// ---------- Output ----------
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  const red = (s) => `\x1b[31m${s}\x1b[0m`;
  const dim = (s) => `\x1b[2m${s}\x1b[0m`;
  const line = (ok, msg) => console.log(`  ${ok ? green('✓') : red('✗')} ${msg}`);
  const skip = (why) => console.log(`  ${dim('–')} skipped: ${why}`);
  const indent = (text) => text.split('\n').map((l) => `      ${l}`).join('\n');
  let problems = 0;

  const section = (title, s) => {
    console.log(`\n${title}`);
    if (!s) return;
    if (s.skipped) return skip(s.skipped);
    if (s.passed) line(true, `${s.passed} passed`);
    for (const f of s.ok ? [] : s.failed) {
      problems++;
      line(false, f.includes('\n') ? `${f.split('\n')[0]}\n${indent(f.split('\n').slice(1).join('\n'))}` : f);
    }
    for (const c of s.console ?? []) {
      problems++;
      line(false, `console: ${c}`);
    }
  };
  if (report.build) {
    console.log('\nBuild');
    if (report.build.ok) line(true, `built dist/ in ${report.build.ms} ms (checking the built app)`);
    else {
      problems++;
      line(false, report.build.error);
    }
  }
  section('Node tests', report.node);
  section('Framework tests', report.framework);
  section('User flows', report.flows);
  console.log('\nPages');
  if (!PAGES.length) skip('no app/router.js in this folder');
  for (const p of report.pages) {
    if (p.ok) line(true, `${p.path} ${dim(p.title)}`);
    else {
      problems += p.problems.length;
      line(false, `${p.path}`);
      for (const msg of p.problems) console.log(indent(msg));
    }
  }
  console.log('\nTypes');
  if (report.types.skipped) skip(report.types.skipped);
  else if (report.types.ok) line(true, 'no type errors');
  for (const e of report.types.errors ?? []) {
    problems++;
    line(false, e);
  }
  console.log('\nSize');
  const kb = (bytes) => `${(bytes / 1000).toFixed(1)} KB`;
  if (report.size.skipped) skip(report.size.skipped);
  else if (report.size.error) {
    problems++;
    line(false, `couldn't measure: ${report.size.error}`);
  } else {
    if (!report.size.ok) problems++;
    line(report.size.ok, `framework ${kb(report.size.core)} of ${kb(report.size.budget)} (minified + gzipped, every export) ${dim(`· mini/ui +${kb(report.size.ui)}`)}`);
  }
  console.log('\nPreloads');
  if (report.preloads.skipped) skip(report.preloads.skipped);
  else if (report.preloads.ok) line(true, 'index.html preloads every module loaded at startup, and nothing else');
  for (const url of report.preloads.missing ?? []) {
    problems++;
    line(false, `index.html doesn't preload ${url}: add <link rel="modulepreload" href="${url}"> (it loads at startup, a round trip late)`);
  }
  for (const url of report.preloads.unused ?? []) {
    problems++;
    line(false, `index.html preloads ${url}, which nothing loads at startup: remove that <link rel="modulepreload">`);
  }
  if (report.error) {
    problems++;
    console.log(`\n${red(report.error)}`);
  }
  console.log(report.ok ? `\n${green('All good')}\n` : `\n${red(`${problems || 1} problem${problems === 1 ? '' : 's'} found`)}\n`);
}
process.exit(report.ok ? 0 : 1);
