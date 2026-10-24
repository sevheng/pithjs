import { html, signal } from 'pith';
import { apps } from '../apps.js';
import { icon } from '../icons.js';
import { preview } from '../previews.js';
import '../components/counter.js';

// The hero's code: a shortened app/components/counter.js, whose full version runs beside it.
const heroCode = `import { define, html, signal, computed } from 'pith';

define('pith-counter', (props) => {
  const count = signal(Number(props.start.value));
  const double = computed(() => count.value * 2);

  return html\`
    <p>\${count}</p>
    <p>Double: \${double}</p>
    <button @click=\${() => count.value++}>+</button>
  \`;
}, { props: ['start'] });`;

// A tiny highlighter for the hero code: keywords, strings, Pith's functions. Text only, no innerHTML.
const TOKENS = /(\/\/.*$)|('[^']*'|`)|\b(import|from|const|return)\b|\b(define|html|signal|computed)\b/gm;
const highlight = (src) => {
  const out = [];
  let last = 0;
  for (const m of src.matchAll(TOKENS)) {
    out.push(src.slice(last, m.index));
    const kind = m[1] ? 'syn-com' : m[2] ? 'syn-str' : m[3] ? 'syn-key' : 'syn-fn';
    out.push(html`<span class=${kind}>${m[0]}</span>`);
    last = m.index + m[0].length;
  }
  out.push(src.slice(last));
  return out;
};

// Measured in ../compare (RESULTS.md), on a slow phone and in the js-framework-benchmark operations.
const numbers = [
  ['<10', 'KB', 'the whole framework, gzipped'],
  ['0', '', 'runtime dependencies, no build needed'],
  ['29%', '', 'sooner on screen than React'],
  ['½', '', "the memory of React's and Vue's lists"],
];

// What `npm run check` prints, shortened.
const checkOutput = [
  ['dim', '$ npm run check'],
  ['', ''],
  ['', 'User flows'],
  ['ok', '  ✓ 58 passed'],
  ['', 'Pages'],
  ['ok', '  ✓ /           Home · Pith'],
  ['ok', '  ✓ /docs       Introduction · Pith'],
  ['ok', '  ✓ /chat/:room Chat · Pith (phone, a11y, dark)'],
  ['', 'Types, size, preloads'],
  ['ok', '  ✓ framework 9.8 KB of 10 KB'],
  ['', ''],
  ['good', 'All good'],
];

const forAgents = [
  ['check', 'One verdict', 'npm run check runs the tests, every page at phone width, accessibility in both themes and the types, then says "All good" or exactly what\'s wrong.'],
  ['search', 'Pages as text', 'npm run see /page prints what a page shows, its state by variable name, and saves a screenshot to look at.'],
  ['file', 'Errors with the fix', 'Every warning has a code like [pith W001] and a fix in the docs, so an agent repairs instead of guessing.'],
  ['pencil', 'Rules and skills', 'Every project gets AGENTS.md and two skills, for building views right and making them look good.'],
];

const core = [
  ['signals', 'Signals', 'Update exactly the text that changed.'],
  ['lists', 'Lists', 'Keyed rows, moved instead of rebuilt.'],
  ['router', 'Routing', 'Lazy pages, params, layouts, guards.'],
  ['resource', 'Data', 'Loading, errors, stale requests, optimistic saves.'],
  ['forms', 'Forms', 'Validation, accessible errors, server errors.'],
  ['store', 'Shared state', 'Saved and synced across tabs.'],
  ['errors', 'Error boundaries', 'One crash doesn\'t take down the page.'],
  ['animation', 'Animation', 'View Transitions that can\'t stall.'],
];

// The order of the showcase tiles: Chat is the big one; the others fill a 3-column grid.
const SHOWCASE = ['Chat', 'Inbox', 'Kanban', 'Dashboard', 'Trading', 'Settings'];

export default function HomePage() {
  const copied = signal(false);
  const commands = 'npx pithjs create my-app\ncd my-app\nnpm install\nnpm run dev';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(commands);
      copied.value = true;
      setTimeout(() => (copied.value = false), 1500);
    } catch {
      // clipboard blocked: the commands are on screen to select
    }
  };

  return html`
    <section class="landing-hero" aria-labelledby="hero-title">
      <p class="badge soft">10 KB · no build needed · made for AI agents</p>
      <h1 id="hero-title">The essential core of a web app.</h1>
      <p class="lead">Signals, components, routing, data and forms, on the browser's own tech.
        Everything hard to get right, and nothing you don't need.</p>
      <div class="row">
        <a class="btn primary big" href="/docs/getting-started">Get started</a>
        <a class="btn big" href="/docs">Read the docs</a>
      </div>
    </section>

    <figure class="product-shot" aria-label="A Pith component and what it renders">
      <div class="window">
        <div class="window-bar" aria-hidden="true"><i></i><i></i><i></i><span>app/components/counter.js</span></div>
        <div class="window-body">
          <pre class="hero-code" tabindex="0" aria-label="A Pith component"><code>${highlight(heroCode)}</code></pre>
          <div class="hero-live">
            <span class="badge">Live</span>
            <pith-counter start="5"></pith-counter>
            <p class="muted note">Runs as written. No build step, no virtual DOM: only the two numbers change.</p>
          </div>
        </div>
      </div>
    </figure>

    <section class="section numbers" aria-labelledby="numbers-title">
      <h2 id="numbers-title" class="sr-only">In numbers</h2>
      <ul class="big-numbers">
        ${numbers.map(([value, unit, label]) => html`<li><span class="big-value">${value}${unit ? html`<small>${unit}</small>` : null}</span><span class="muted">${label}</span></li>`)}
      </ul>
      <p class="muted note center">Measured against the same apps in React and Vue on a slow phone. <a href="/docs/benchmarks">See the benchmarks →</a></p>
    </section>

    <section class="section" aria-labelledby="apps-title">
      <div class="section-head">
        <h2 id="apps-title">Real apps, not snippets.</h2>
        <p class="lead">Six complete apps in this demo, each with every state handled, on phones and in dark mode. Open one.</p>
      </div>
      <ul class="bento">
        ${SHOWCASE.map((name) => apps.find((a) => a.name === name)).map((a) => html`
          <li class=${`bento-tile lift tile-${a.name.toLowerCase()}`}>
            ${preview(a.name)}
            <div class="bento-text">
              <h3><a class="stretched" href=${a.href}>${a.name}</a></h3>
              <p class="muted">${a.text}</p>
            </div>
          </li>`)}
      </ul>
    </section>

    <section class="section agents-band" aria-labelledby="agents-title">
      <div class="agents-copy">
        <p class="eyebrow">Built for AI agents</p>
        <h2 id="agents-title">Your agent checks its own work.</h2>
        <ul class="agent-list">
          ${forAgents.map(([ic, title, text]) => html`<li><span class="icon-tile">${icon(ic)}</span><div><h3>${title}</h3><p class="muted">${text}</p></div></li>`)}
        </ul>
        <a href="/docs/ai-agents">How agents work with Pith →</a>
      </div>
      <div class="terminal" role="img" aria-label="npm run check: every test, page and check passed, All good">
        <div class="window-bar" aria-hidden="true"><i></i><i></i><i></i><span>Terminal</span></div>
        <pre aria-hidden="true">${checkOutput.map(([kind, line]) => html`<span class=${kind ? `t-line t-${kind}` : 't-line'}>${line || ' '}</span>`)}</pre>
      </div>
    </section>

    <section class="section" aria-labelledby="core-title">
      <div class="section-head">
        <h2 id="core-title">What's in the core</h2>
        <p class="lead">The parts most apps need and are easy to get wrong. Dialogs, toasts and widgets stay app code.</p>
      </div>
      <ul class="core-grid">
        ${core.map(([name, title, text]) => html`<li><a href=${`/docs/${name}`}><strong>${title}</strong><span class="muted">${text}</span></a></li>`)}
      </ul>
    </section>

    <section class="section start-band" id="start" aria-labelledby="start-title">
      <h2 id="start-title">Start in a minute.</h2>
      <div class="start-box">
        <pre class="start-code" tabindex="0" aria-label="Commands to start a project"><code>${commands}</code></pre>
        <button class="btn" type="button" @click=${copy}>${icon('copy')} ${() => (copied.value ? 'Copied' : 'Copy')}</button>
      </div>
      <p class="muted note">Not on npm yet: from the Pith repo, run <code>node framework/tools/cli.mjs create my-app</code>.</p>
      <div class="row"><a class="btn primary big" href="/docs/getting-started">Read the guide</a></div>
    </section>
  `;
}
