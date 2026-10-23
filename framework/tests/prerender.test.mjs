import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { escapeHtml, extractData, extractPage, injectPage, landedElsewhere, recordData, routeFile } from '../tools/prerender.mjs';
import { loadPrerenderPaths, matchRoute, prerenderTargets, readRouteTable, readRoutes } from '../tools/routes.mjs';

const shell = `<!doctype html>
<html lang="en">
<head>
  <title>Mini</title>
  <script type="module" crossorigin src="/assets/index-abc.js"></script>
</head>
<body>
  <div id="app">
    <noscript><p>Needs JavaScript.</p></noscript>
  </div>
</body>
</html>`;

test('injectPage puts the markup in #app, marks it, and sets the title', () => {
  const out = injectPage(shell, { html: '<main><h1>Todos</h1></main>', title: 'Todos · Mini' });
  assert.match(out, /<div id="app"><div data-prerendered style="display:contents"><main><h1>Todos<\/h1><\/main><\/div><\/div>/);
  assert.match(out, /<title>Todos · Mini<\/title>/);
  assert.doesNotMatch(out, /noscript/);
  assert.match(out, /<script type="module" crossorigin src="\/assets\/index-abc.js"><\/script>/);
  assert.equal(out.match(/<title>/g).length, 1);
});

test('injectPage inlines a script right after #app (escaping </script>)', () => {
  const out = injectPage(shell, { html: '<h1>Hi</h1>', title: 'Hi', script: 'go("</script>")' });
  assert.match(out, /<\/div><\/div><script>go\("<\\\/script>"\)<\/script>\s*<\/body>/);
  assert.doesNotMatch(injectPage(shell, { html: '<h1>Hi</h1>', title: 'Hi', script: '' }), /<script>/);
});

test('injectPage escapes the title, and keeps $ patterns in markup literal', () => {
  const out = injectPage(shell, { html: '<p>costs $& and $1</p>', title: 'A <b> & "c"' });
  assert.match(out, /<title>A &lt;b&gt; &amp; &quot;c&quot;<\/title>/);
  assert.match(out, /<p>costs \$& and \$1<\/p>/);
});

test('injectPage adds module preloads to the head', () => {
  const out = injectPage(shell, { html: '<h1>x</h1>', title: 'x', preload: ['/assets/todos-1.js'] });
  assert.match(out, /<link rel="modulepreload" crossorigin href="\/assets\/todos-1.js">\s*<\/head>/);
});

test('injectPage writes the GET answers the page was built with as #mini-data (safe inside a <script>)', () => {
  const data = { '/api/team?q=': [{ name: '</script><b>$&' }] };
  const out = injectPage(shell, { html: '<h1>Team</h1>', title: 'Team', script: '', data });
  const block = out.match(/<\/div><\/div><script type="application\/json" id="mini-data">(.*?)<\/script>\s*<\/body>/)?.[1];
  assert.ok(block, 'no #mini-data block after #app');
  assert.doesNotMatch(block, /</);
  assert.deepEqual(JSON.parse(block), data);
  assert.doesNotMatch(injectPage(shell, { html: '<h1>x</h1>', title: 'x', data: {} }), /mini-data/);
});

test('recordData adds a fetch recorder to the head; extractData reads what it recorded from the dumped DOM', () => {
  const out = recordData(shell);
  const script = out.match(/<head>\s*<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'no recorder script at the start of <head>');
  assert.doesNotThrow(() => new Function(script), 'the recorder does not parse');
  assert.match(script, /fetch/);
  const dom = `<html><head><script type="application/json" id="mini-prerender-data">{"/api/x":{"a":"\\u003c"}}</script></head></html>`;
  assert.deepEqual(extractData(dom), { '/api/x': { a: '<' } });
  assert.deepEqual(extractData('<html></html>'), {});
});

test('injectPage fails loudly when the shell has no #app', () => {
  assert.throws(() => injectPage('<html><body></body></html>', { html: '', title: '' }), /id="app"/);
});

test('extractPage reads #app (with nested divs) and the title from a dumped DOM', () => {
  const dom = `<html><head><title>Team &amp; co · Mini</title></head><body>
  <div id="app"><div class="a"><div>one</div></div><p>two</p></div><div id="toast">not mine</div>
</body></html>`;
  assert.deepEqual(extractPage(dom), {
    html: '<div class="a"><div>one</div></div><p>two</p>',
    title: 'Team & co · Mini',
  });
  assert.equal(extractPage('<html><body></body></html>'), null);
});

test('routeFile maps a route to its HTML file in dist/', () => {
  assert.equal(routeFile('/'), 'index.html');
  assert.equal(routeFile('/todos'), join('todos', 'index.html'));
  assert.equal(routeFile('/docs/intro/'), join('docs', 'intro', 'index.html'));
  assert.equal(routeFile('/caf%C3%A9'), join('café', 'index.html'));
  assert.throws(() => routeFile('/a/../../etc'), /Can't prerender/);
  assert.throws(() => routeFile('/user/:id'), /Can't prerender/);
});

test('routeFile maps a URL of a :param route to a nested file', () => {
  assert.equal(routeFile('/team/3'), join('team', '3', 'index.html'));
  assert.equal(routeFile('/blog/2024/hello-world/'), join('blog', '2024', 'hello-world', 'index.html'));
});

test('escapeHtml escapes the five HTML characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('readRoutes lists fixed routes only; readRouteTable finds page files', () => {
  const root = mkdtempSync(join(tmpdir(), 'mini-routes-'));
  try {
    mkdirSync(join(root, 'app'));
    writeFileSync(
      join(root, 'app', 'router.js'),
      `export const router = createRouter({
  '/': { title: 'Home', load: () => import('./pages/home.js') },
  "/todos": { title: 'Todos', load: () => import("./pages/todos.js") },
  '/user/:id': { title: 'User', load: () => import('./pages/user.js') },
  '*': { title: 'Not found', load: () => import('./pages/not-found.js') },
});`
    );
    assert.deepEqual(readRoutes(root), ['/', '/todos']);
    assert.deepEqual(readRouteTable(root).map((r) => r.file), [
      join(root, 'app', 'pages', 'home.js'),
      join(root, 'app', 'pages', 'todos.js'),
      join(root, 'app', 'pages', 'user.js'),
    ]);
    assert.deepEqual(readRoutes(join(root, 'nowhere')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readRouteTable reads each route title and whether it redirects', () => {
  const root = mkdtempSync(join(tmpdir(), 'mini-routes-'));
  try {
    mkdirSync(join(root, 'app'));
    writeFileSync(
      join(root, 'app', 'router.js'),
      `export const router = createRouter({
  '/settings': { redirect: '/settings/profile' },
  '/settings/account': { title: "Account", auth: true, load: () => import('./pages/account.js') },
  '/plain': () => html\`x\`,
});`
    );
    assert.deepEqual(
      readRouteTable(root).map(({ path, title, redirect }) => ({ path, title, redirect })),
      [
        { path: '/settings', title: null, redirect: true },
        { path: '/settings/account', title: 'Account', redirect: false },
        { path: '/plain', title: null, redirect: false },
      ]
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('landedElsewhere spots a route that a redirect or guard sent to another page', () => {
  assert.equal(landedElsewhere({ title: 'Account', redirect: false }, 'Profile · Mini'), true);
  assert.equal(landedElsewhere({ title: 'Account', redirect: false }, 'Account · Mini'), false);
  assert.equal(landedElsewhere({ title: null, redirect: true }, 'Profile · Mini'), true);
  assert.equal(landedElsewhere({ title: null, redirect: false }, 'Anything'), false);
});

const table = [
  { path: '/', file: null, title: 'Home', redirect: false },
  { path: '/team', file: null, title: 'Team', redirect: false },
  { path: '/team/:id', file: null, title: 'Member', redirect: false },
  { path: '/blog/:year/:slug', file: null, title: 'Post', redirect: false },
  { path: '/files/a.b', file: null, title: 'Dot', redirect: false },
];

test('matchRoute matches :params like the browser router, first route wins', () => {
  assert.deepEqual(matchRoute(table, '/team/3'), { route: table[2], params: { id: '3' } });
  assert.deepEqual(matchRoute(table, '/team/3/'), { route: table[2], params: { id: '3' } });
  assert.deepEqual(matchRoute(table, '/team'), { route: table[1], params: {} });
  assert.deepEqual(matchRoute(table, '/team/'), { route: table[1], params: {} });
  assert.deepEqual(matchRoute(table, '/'), { route: table[0], params: {} });
  assert.deepEqual(matchRoute(table, '/blog/2024/caf%C3%A9'), { route: table[3], params: { year: '2024', slug: 'café' } });
  assert.equal(matchRoute(table, '/team/3/extra'), null);
  assert.equal(matchRoute(table, '/blog/2024'), null);
  assert.equal(matchRoute(table, '/files/aXb'), null, 'a dot in a pattern is literal');
  assert.equal(matchRoute(table, '/nope'), null);
});

/** A temp project with app/router.js and, optionally, prerender.mjs. */
function project(prerenderSource) {
  const root = mkdtempSync(join(tmpdir(), 'mini-paths-'));
  mkdirSync(join(root, 'app'));
  writeFileSync(
    join(root, 'app', 'router.js'),
    `export const router = createRouter({
  '/': { title: 'Home', load: () => import('./pages/home.js') },
  '/team': { title: 'Team', load: () => import('./pages/team.js') },
  '/team/:id': { title: 'Member', load: () => import('./pages/member.js') },
});`
  );
  if (prerenderSource != null) writeFileSync(join(root, 'prerender.mjs'), prerenderSource);
  return root;
}

test('loadPrerenderPaths: no prerender.mjs means no extra URLs', async () => {
  const root = project(null);
  try {
    assert.deepEqual(await loadPrerenderPaths(root), { paths: [], warnings: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadPrerenderPaths reads the default export, and warns about bad URLs (W065)', async () => {
  const root = project(`export default async function paths() {
  return ['/team/1', '/team/2/', '/team/1', 'team/3', '/team/4?x=1', '/team/5#top', '/a/../b', '/team/:id', 7, '//evil.test/x', '/team/%E0%A4%A', '/team/a%2Fb'];
}`);
  try {
    const { paths, warnings } = await loadPrerenderPaths(root);
    assert.deepEqual(paths, ['/team/1', '/team/2']);
    assert.equal(warnings.length, 9);
    assert.ok(warnings.every((w) => w.startsWith('[mini W065] ')), warnings.join('\n'));
    assert.match(warnings[0], /"team\/3"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadPrerenderPaths warns (W066) when prerender.mjs throws or returns no array', async () => {
  for (const source of [
    `export default async () => { throw new Error('db down'); };`,
    `export default async () => 'nope';`,
    `export const paths = ['/team/1'];`,
    `this is not javascript`,
  ]) {
    const root = project(source);
    try {
      const { paths, warnings } = await loadPrerenderPaths(root);
      assert.deepEqual(paths, []);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /^\[mini W066\] prerender\.mjs/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('prerenderTargets: fixed routes, then prerender.mjs URLs with their route; unmatched ones warn (W064)', async () => {
  const root = project(`export default () => ['/team/1', '/team', '/team/2', '/nowhere/1'];`);
  try {
    const { targets, warnings } = await prerenderTargets(root);
    assert.deepEqual(
      targets.map((t) => [t.path, t.route.path, t.extra]),
      [['/', '/', false], ['/team', '/team', false], ['/team/1', '/team/:id', true], ['/team/2', '/team/:id', true]]
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^\[mini W064\] \/nowhere\/1 matches no route/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
