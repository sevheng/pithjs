// Generate files in the shape Pith expects, and wire them up.
//   npm run new page contact            → app/pages/contact.js + a lazy route '/contact'
//   npm run new page about-us --nav     → same, plus a link in the nav bar
//   npm run new component user-card     → app/components/user-card.js

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd(); // the project folder (npm runs scripts there)
const [kind, name, ...flags] = process.argv.slice(2);

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const words = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1));
const read = (file) => readFileSync(join(root, file), 'utf8');
const write = (file, text) => writeFileSync(join(root, file), text);

// Insert `text` after the last line matching `pattern` (or before the first, with before: true).
function insertLine(file, pattern, text, { before = false } = {}) {
  const lines = read(file).split('\n');
  const indexes = lines.map((l, i) => (pattern.test(l) ? i : -1)).filter((i) => i >= 0);
  if (!indexes.length) fail(`couldn't find where to add it in ${file} (looked for ${pattern}). Add this line yourself:\n  ${text.trim()}`);
  const at = before ? indexes[0] : indexes.at(-1) + 1;
  const indent = lines[before ? at : at - 1].match(/^\s*/)[0];
  lines.splice(at, 0, indent + text.trim());
  write(file, lines.join('\n'));
}

if (kind === 'page') {
  if (!/^[a-z][a-z0-9-]*$/.test(name ?? '')) fail('usage: npm run new page <name>   (lowercase, dashes allowed: contact, about-us)');
  const file = `app/pages/${name}.js`;
  if (existsSync(join(root, file))) fail(`${file} already exists`);
  const title = words(name).join(' ');
  const fn = `${words(name).join('')}Page`;

  write(file, `import { html } from 'pith';

export default function ${fn}() {
  return html\`
    <section class="section narrow">
      <h1>${title}</h1>
      <p class="lead">This is the ${title} page.</p>
    </section>
  \`;
}
`);
  insertLine('app/router.js', /^\s*'\*'\s*:/, `'/${name}': { title: '${title}', load: () => import('./pages/${name}.js') },`, { before: true });
  if (flags.includes('--nav')) {
    insertLine('app/components/nav-bar.js', /^\s*\['\/[^']*', '[^']*'\],$/, `['/${name}', '${title}'],`);
  }

  console.log(`✓ Created ${file}`);
  console.log(`✓ Added route '/${name}' to app/router.js (loads on demand)`);
  if (flags.includes('--nav')) console.log('✓ Added a nav link in app/components/nav-bar.js');
  console.log(`\nNext: edit ${file}, add a flow to tests/flows.js, then run npm run check`);
} else if (kind === 'component') {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name ?? '')) {
    fail('usage: npm run new component <tag-name>   (lowercase with a dash: user-card, price-tag)');
  }
  const file = `app/components/${name}.js`;
  if (existsSync(join(root, file))) fail(`${file} already exists`);

  write(file, `import { define, html, signal } from 'pith';

define('${name}', (props, ctx) => {
  const count = signal(0);

  return html\`
    <div class="card">
      <p>${words(name).join(' ')}: clicked \${count} times</p>
      <button class="btn" type="button" @click=\${() => count.value++}>Click</button>
    </div>
  \`;
});
`);
  console.log(`✓ Created ${file}`);
  console.log(`\nNext: in the page that uses it, add  import '../components/${name}.js';`);
  console.log(`      and put <${name}></${name}> in its template. Then run npm run check`);
} else {
  fail('usage: npm run new page <name> [--nav]  |  npm run new component <tag-name>');
}
