import { html } from 'pith';
import { code, api, note, c } from '../ui.js';
import { createCommand } from '../../brand.js';

const create = `
${createCommand}
# or from a checkout of the Pith repo:
node framework/tools/cli.mjs create my-app

cd my-app
npm install                   # Pith's tools (pithjs) and Vite, the two dev dependencies
npm run dev                   # → http://localhost:8000
npm run check                 # a new project prints "All good"`;

const layout = `
index.html           the import map ('pith' → /pith/index.js) and preloads
app/main.js          mounts the app shell (after \`await router.ready\`)
app/router.js        the route table: one lazy line per page
app/store.js         shared state (signals, saved to localStorage)
app/pages/*.js       one page per file: export default function XxxPage(params) { ... }
app/components/*.js  one component per file: define('tag-name', setup)
app/ui.js            confirm(), dialog() and toast(): app code, yours to change
styles/main.css      all CSS, with design tokens (var(--accent), ...) and classes
api/*.mjs            optional fake backend for development: api/users.mjs answers /api/users
prerender.mjs        URLs of :param pages to prerender (build only)
tests/flows.js       user flows: a person clicking through a feature
AGENTS.md            the rules and patterns, for people and AI agents (CLAUDE.md points to it)
.claude/skills/      pith-frontend and pith-design, the agent skills for UI work`;

const newPage = `
npm run new page about -- --nav
# ✓ Created app/pages/about.js
# ✓ Added route '/about' to app/router.js (loads on demand)
# ✓ Added a nav link in app/components/nav-bar.js`;

const route = `
'/about': { title: 'About', load: () => import('./pages/about.js') },`;

const page = `
import { html, signal } from 'pith';

export default function AboutPage() {
  const likes = signal(0);

  return html\`
    <section class="section narrow">
      <h1>About</h1>
      <p class="lead">We make small, fast sites.</p>
      <button class="btn" type="button" @click=\${() => likes.value++}>
        Liked \${likes} times
      </button>
    </section>
  \`;
}`;

const paramPage = `
// app/router.js
'/user/:id': { title: 'User', load: () => import('./pages/user.js') },

// app/pages/user.js
export default function UserPage({ id }) {
  return html\`<h1>User \${id}</h1>\`;
}`;

const flowSample = `
flow('about: the like button counts', async (app) => {
  await app.go('/about');
  await app.click('Liked 0 times');
  await app.see('Liked 1 times');
});`;

export default () => html`
  <p>
    You need Node 24 or newer, and Chrome or Chromium for the checks (set ${c('CHROME_PATH')} if it isn't
    found). Nothing else: Pith has no runtime dependencies.
  </p>

  <h2 id="make-a-project">Make a project</h2>
  <p>
    The ${c('pith create')} command copies a starter project: a home page, a 404 page, a nav bar, the router,
    ${c('app/ui.js')}, styles, a first user flow, ${c('AGENTS.md')} and the agent skills.
  </p>
  ${code(create)}
  ${note(html`Pith isn't on npm yet (its ${c('package.json')} is ${c('"private": true')}), so for now run the
    command from a checkout of the repo. The new project then links ${c('pithjs')} as ${c('file:...')}.`)}

  <h2 id="commands">The commands</h2>
  <p>A project's ${c('package.json')} scripts call the ${c('pith')} command. You use them through npm:</p>
  ${api([
    ['npm run dev', html`Vite dev server on port 8000 (${c('PORT=3000 npm run dev')} for another). Reloads on save, updates CSS in place.`],
    ['npm run dev:no-build', 'The same app with no Vite at all: the folder served as it is.'],
    ['npm run check', html`Everything: tests, user flows, every route, phones, accessibility, types. Must print ${html`<strong>All good</strong>`}.`],
    ['npm run see /path', 'The page as a text outline, plus a screenshot.'],
    ['npm run new page <name>', html`A new page and its lazy route (${c('-- --nav')} also adds a nav link).`],
    ['npm run new component <tag-name>', 'A new component file.'],
    ['npm run build', html`A production build into ${c('dist/')}, with every route prerendered.`],
    ['npm run preview', html`Serves the built ${c('dist/')}.`],
  ])}
  <p>
    Flags go after ${c('--')}, so npm passes them on: ${c('npm run see /about -- --mobile')}.
  </p>

  <h2 id="where-things-go">Where things go</h2>
  ${code(layout, { label: 'Project folders and files' })}
  <p>
    The framework and its tools live in ${c('node_modules/pithjs/')}. Don't edit it; its ${c('README.md')} is
    the full API reference and ${c('docs/errors.md')} explains every warning.
  </p>

  <h2 id="a-first-page">A first page and route</h2>
  <p>Let the tool make the file and wire it up, rather than writing both by hand:</p>
  ${code(newPage)}
  <p>It adds one line to the route table. The page's code downloads only when someone first visits it:</p>
  ${code(route, { file: 'app/router.js' })}
  <p>Then edit the page. It reloads in the browser when you save:</p>
  ${code(page, { file: 'app/pages/about.js' })}
  <p>
    A page file must ${c('export default')} its function (E005), and every page renders one ${c('<h1>')}.
    For a URL with parts that change, use a ${c(':param')}; it arrives as the page function's argument:
  </p>
  ${code(paramPage)}
  <p>Finally, add a flow for what a person does on the page, and run ${c('npm run check')}:</p>
  ${code(flowSample, { file: 'tests/flows.js' })}

  <h2 id="the-six-rules">The six rules</h2>
  <p>Most mistakes in a Pith app are one of these. Each has a warning or error code that explains it.</p>
  <ol>
    <li><strong>Import from ${c("'pith'")}</strong>: ${c("import { html, signal } from 'pith';")}. Dialogs and toasts come from ${c('app/ui.js')}.</li>
    <li><strong>Reactive means a signal or function as the whole hole.</strong> ${c('${count}')} and ${c('${() => count.value * 2}')} update; ${c('${count.value}')} is a snapshot that never does.</li>
    <li><strong>Events take functions</strong>: ${c('@click=${() => save()}')}, not ${c('@click=${save()}')} (W001).</li>
    <li><strong>Attribute holes are whole values</strong>: ${c('class=${cls}')}, not ${c('class="btn ${cls}"')} (E001). Build the string in JS.</li>
    <li><strong>Update arrays and objects immutably</strong>: ${c('todos.value = [...todos.value, item]')}. A ${c('push()')} changes nothing on screen.</li>
    <li><strong>Lists use ${c('repeat()')} with a stable unique key</strong>, and ${c('selector()')} to mark the selected row.</li>
  </ol>
  <p>
    Next: <a href="/docs/signals">Signals</a>, the first of the Core pages, or
    <a href="/docs/ai-agents">Building with AI</a> if an agent will write the code.
  </p>
`;
