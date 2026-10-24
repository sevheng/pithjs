import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProject } from '../tools/create.mjs';
import { checkPreloads } from '../tools/preloads.mjs';

const framework = join(import.meta.dirname, '..');
const SKILLS = ['pith-frontend', 'pith-design'];
const read = (...p) => readFileSync(join(...p), 'utf8');
const filesIn = (dir, base = dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? filesIn(join(dir, e.name), base) : [join(dir, e.name).slice(base.length + 1)]);

test('createProject writes a working starter project, named after its folder', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'pith-create-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const dir = join(parent, 'my-shop');
  createProject(dir);

  const files = filesIn(dir).sort();
  for (const f of ['.gitignore', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'index.html', 'jsconfig.json', 'package.json',
    'app/main.js', 'app/router.js', 'app/ui.js', 'app/brand.js', 'app/components/nav-bar.js', 'app/pages/home.js',
    'app/pages/not-found.js', 'styles/main.css', 'tests/flows.js']) assert.ok(files.includes(f), `missing ${f}`);
  assert.ok(!files.includes('gitignore'), 'gitignore is renamed to .gitignore');
  assert.ok(!files.some((f) => f.startsWith('api/')), 'a new project has no fake backend (add api/ when you need one)');

  for (const f of files) assert.doesNotMatch(read(dir, f), /__APP_NAME__/, `${f} still has the placeholder`);
  assert.match(read(dir, 'app/router.js'), /`\$\{t\} · My shop`/);

  const pkg = JSON.parse(read(dir, 'package.json'));
  assert.equal(pkg.name, 'my-shop');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.scripts.check, 'pith check');
  assert.equal(pkg.scripts['dev:no-build'], 'pith serve');
  assert.match(pkg.devDependencies.pithjs, /^file:|^\^\d/);
  assert.ok(pkg.devDependencies.vite);

  assert.equal(read(dir, 'AGENTS.md'), read(framework, 'AGENTS.md'), 'AGENTS.md is the framework\'s copy');
  assert.equal(read(dir, 'CLAUDE.md'), '@AGENTS.md\n');
  for (const skill of SKILLS) {
    assert.equal(read(dir, '.claude', 'skills', skill, 'SKILL.md'), read(framework, 'skills', skill, 'SKILL.md'), `${skill} is copied`);
  }
  assert.deepEqual(checkPreloads({ root: dir }), { missing: [], unused: [] });
});

test('createProject refuses a folder that already has files', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pith-create-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'notes.txt'), 'mine');
  assert.throws(() => createProject(dir), /isn't empty/);
  assert.equal(read(dir, 'notes.txt'), 'mine');
  mkdirSync(join(dir, 'empty'));
  createProject(join(dir, 'empty'));
  assert.ok(existsSync(join(dir, 'empty', 'index.html')));
});

test('each skill has a name and a description that says when to use it', () => {
  for (const skill of SKILLS) {
    const text = read(framework, 'skills', skill, 'SKILL.md');
    assert.match(text, new RegExp(`^---\\nname: ${skill}\\ndescription: >\\n[\\s\\S]+?\\n---\\n`), `${skill}: frontmatter`);
  }
});

test("the demo's skills are the framework's", (t) => {
  if (!existsSync(join(framework, '..', 'demo'))) return t.skip('no ../demo next to the framework');
  for (const skill of SKILLS) {
    assert.equal(read(framework, '..', 'demo', '.claude', 'skills', skill, 'SKILL.md'), read(framework, 'skills', skill, 'SKILL.md'),
      `demo/.claude/skills/${skill} differs from framework/skills/${skill}: copy it over`);
  }
});

test("the demo's styles start with the template's shared Pith design block", (t) => {
  const demo = join(framework, '..', 'demo', 'styles', 'main.css');
  if (!existsSync(demo)) return t.skip('no ../demo next to the framework');
  const block = (css) => css.slice(0, css.indexOf('/* ===== end of Pith design ===== */'));
  const shared = block(read(framework, 'template', 'styles', 'main.css'));
  assert.ok(shared.length > 1000, 'the template has the shared block');
  assert.equal(block(read(demo)), shared, 'demo/styles/main.css differs in the shared Pith design block: copy it over from template/styles/main.css');
});

test("the demo's AGENTS.md is the framework's, plus a section about the demo", (t) => {
  const demo = join(framework, '..', 'demo', 'AGENTS.md');
  if (!existsSync(demo)) return t.skip('no ../demo next to the framework');
  const general = read(framework, 'AGENTS.md');
  assert.ok(read(demo).startsWith(general.trimEnd()), 'demo/AGENTS.md must start with framework/AGENTS.md: copy it over');
});
