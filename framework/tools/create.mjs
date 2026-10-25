// pith create <folder>: a new Pith project from template/, ready for npm install.
//   index.html (import map + preloads), app/ (router, home and not-found pages, nav bar, ui.js),
//   styles/, tests/flows.js, AGENTS.md (this framework's rules, for AI agents), CLAUDE.md, jsconfig.json, and the
//   agent skills in .claude/skills/ (pith-frontend, pith-design: loaded only for UI work).
// package.json lists pithjs as a dev dependency: this version when Pith is installed from npm, or a link to
// this folder (file:...) when it runs from a checkout of the Pith repo.

import { cpSync, existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';

const framework = join(import.meta.dirname, '..');
const template = join(framework, 'template');
const VITE = '8.3.5';

/** 'my-shop' → 'My shop' */
const title = (name) => {
  const words = name.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Where a new project gets Pith from: a checkout of the repo is linked by its absolute path (so changes to it
 * show at once); a copy installed from a GitHub Release (npx --package=<.tgz>) points at that release's file.
 * @param {{ version: string, repository: { url: string } }} pkg Pith's package.json
 * @param {string} folder where this Pith is
 */
export function pithDependency(pkg, folder) {
  if (!folder.split(sep).includes('node_modules')) return `file:${folder}`;
  const repo = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
  return `${repo}/releases/download/v${pkg.version}/pithjs-${pkg.version}.tgz`;
}

/**
 * @param {string} dir the new project's folder (created; it must not exist or be empty)
 * @returns {string} the folder, resolved
 */
export function createProject(dir) {
  dir = resolve(dir);
  if (existsSync(dir) && readdirSync(dir).length) throw new Error(`${dir} isn't empty: pick a new folder name.`);
  const name = basename(dir).toLowerCase().replace(/[^a-z0-9-_.]+/g, '-');

  cpSync(template, dir, { recursive: true });
  renameSync(join(dir, 'gitignore'), join(dir, '.gitignore')); // npm drops .gitignore files from packages
  cpSync(join(framework, 'AGENTS.md'), join(dir, 'AGENTS.md'));
  cpSync(join(framework, 'skills'), join(dir, '.claude', 'skills'), { recursive: true });
  const fill = (path) => {
    const text = readFileSync(path, 'utf8');
    if (text.includes('__APP_NAME__')) writeFileSync(path, text.replaceAll('__APP_NAME__', title(name)));
  };
  const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : fill(join(d, e.name))));
  walk(dir);

  const pith = JSON.parse(readFileSync(join(framework, 'package.json'), 'utf8'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'pith dev',
      'dev:no-build': 'pith serve',
      build: 'pith build',
      preview: 'pith preview',
      check: 'pith check',
      see: 'pith see',
      new: 'pith new',
      types: 'npx -y -p typescript@5.9.3 tsc -p jsconfig.json',
    },
    engines: { node: '>=24' },
    devDependencies: {
      pithjs: pithDependency(pith, framework),
      vite: VITE,
    },
  }, null, 2) + '\n');
  return dir;
}

if (import.meta.main) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: pith create <folder>   (e.g. pith create my-app)');
    process.exit(1);
  }
  try {
    const dir = createProject(target);
    const cd = relative(process.cwd(), dir) || '.';
    console.log(`✓ Created ${dir}\n\nNext:\n  cd ${cd}\n  npm install\n  npm run dev      # → http://localhost:8000\n  npm run check    # must print "All good"`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
