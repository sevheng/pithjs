// Code and developer-experience numbers:
//   - lines of app code per implementation (non-blank, non-comment), files, characters
//   - npm packages each framework needs (transitive, from package-lock.json) and their size on disk
// Framework/library code is not counted as app code; shared/ (CSS, the feed, the formula engine) is the same for all.
// Writes results/code.json.

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const compare = join(import.meta.dirname, '..');
import { APPS } from './server.mjs';
const SOURCE_EXT = new Set(['.js', '.jsx', '.vue', '.html']);

function files(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['dist', 'node_modules'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(path));
    else if (SOURCE_EXT.has(extname(entry.name))) out.push(path);
  }
  return out;
}

// Drop comments, then count non-blank lines.
function countLines(text) {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''));
  return stripped.filter((l) => l.trim()).length;
}

const code = {};
for (const app of APPS) {
  for (const impl of ['pith', 'react', 'vue']) {
    const list = files(join(compare, app, impl)).filter((f) => !f.endsWith('vite.config.js'));
    const texts = list.map((f) => readFileSync(f, 'utf8'));
    code[`${app}/${impl}`] = {
      files: list.length,
      lines: texts.reduce((s, t) => s + countLines(t), 0),
      chars: texts.reduce((s, t) => s + t.replace(/\s+/g, ' ').length, 0),
      list: list.map((f) => relative(compare, f)),
    };
  }
}

// Transitive npm dependencies of a set of root packages, from the lockfile.
const lock = JSON.parse(readFileSync(join(compare, 'package-lock.json'), 'utf8')).packages;
function closure(roots) {
  const seen = new Set();
  const visit = (name) => {
    const key = `node_modules/${name}`;
    if (seen.has(key) || !lock[key]) return;
    seen.add(key);
    const pkg = lock[key];
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })) visit(dep);
  };
  roots.forEach(visit);
  // optional platform binaries that npm didn't install don't take space
  return [...seen].filter((k) => !lock[k].optional || statSafe(join(compare, k)));
}
function statSafe(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}
function diskMB(keys) {
  let bytes = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(p); // nested packages are counted as their own keys
      } else bytes += statSync(p).size;
    }
  };
  for (const k of keys) if (statSafe(join(compare, k))) walk(join(compare, k));
  return Math.round(bytes / 1024 / 1024);
}

const toolchain = ['vite'];
const sets = {
  pith: [],
  react: ['react', 'react-dom', '@vitejs/plugin-react', ...toolchain],
  vue: ['vue', '@vitejs/plugin-vue', ...toolchain],
};
const deps = {};
for (const [name, roots] of Object.entries(sets)) {
  const keys = closure(roots);
  deps[name] = { direct: roots.length, total: keys.length, diskMB: diskMB(keys) };
}

mkdirSync(join(compare, 'results'), { recursive: true });
writeFileSync(join(compare, 'results', 'code.json'), JSON.stringify({ code, deps }, null, 2) + '\n');
for (const [k, v] of Object.entries(code)) console.log(k.padEnd(12), `${v.lines} lines, ${v.files} files, ${v.chars} chars`);
console.log('deps', JSON.stringify(deps));
