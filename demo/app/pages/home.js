import { html } from 'pith';
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

// Measured in ../compare (RESULTS.md), on a slow phone and in the js-framework-benchmark operations.
const numbers = [
  ['9.7 KB', 'the whole framework, gzipped'],
  ['0', 'runtime dependencies, no build step'],
  ['17–21%', 'sooner on screen than Vue'],
  ['~½', "the memory of React's and Vue's lists"],
];

const forAgents = [
  ['One verdict', '`npm run check` tests flows, every page, phone layout, accessibility and types, then says “All good” or exactly what’s wrong.'],
  ['Errors with the fix', 'Every warning has a code like `[pith W001]` and a fix in the docs, so an agent repairs instead of guessing.'],
  ['Pages as text', '`npm run see /page --state` prints what a page shows and what its state holds, by variable name.'],
  ['Tests like a person', 'Flows click and type by visible text, and a failing step shows the page and the app’s state.'],
];

const tour = [
  ['signals', 'Signals', 'Update exactly the text that changed.'],
  ['lists', 'Lists', 'Keyed, moved instead of rebuilt, animated.'],
  ['resource', 'Data', 'Loading, errors and stale requests, handled.'],
  ['forms', 'Forms', 'Validation, accessible errors, server errors.'],
  ['router', 'Routing', 'Lazy pages, params, query, layouts, guards.'],
  ['errors', 'Error boundaries', 'One crash doesn’t take down the page.'],
];

// `inline code` in the short texts above.
const withCode = (text) => text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? html`<code>${part}</code>` : part));

export default function HomePage() {
  return html`
    <section class="hero home-hero">
      <div>
        <p class="eyebrow">Pith · a 10 KB web framework</p>
        <h1>The essential core of a web app.</h1>
        <p class="lead">
          Signals, components, routing, data and forms, on the browser's own tech. No build step,
          no runtime dependencies, and tools made for AI agents.
        </p>
        <div class="row">
          <a class="btn primary" href="/docs">Read the docs</a>
          <a class="btn" href="#start">Get started</a>
        </div>
      </div>
      <figure class="hero-demo">
        <pre class="code" tabindex="0" aria-label="A Pith component"><code>${heroCode}</code></pre>
        <figcaption class="muted note">Runs as is, no build. Live (with two more buttons):</figcaption>
        <pith-counter start="5"></pith-counter>
      </figure>
    </section>

    <section class="section" aria-labelledby="numbers">
      <h2 id="numbers" class="sr-only">In numbers</h2>
      <ul class="number-strip">
        ${numbers.map(([value, label]) => html`<li class="card stat"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></li>`)}
      </ul>
      <p class="muted note">Measured against the same apps in React and Vue: <a href="/docs/benchmarks">see the benchmarks</a></p>
    </section>

    <section class="section" aria-labelledby="agents">
      <h2 id="agents">Built for AI agents</h2>
      <p class="muted">Every project comes with <code>AGENTS.md</code>: the rules, patterns and commands an agent needs. Then:</p>
      <ul class="feature-grid agent-grid">
        ${forAgents.map(([title, text]) => html`<li class="card feature"><h3>${title}</h3><p>${withCode(text)}</p></li>`)}
      </ul>
    </section>

    <section class="section" aria-labelledby="tour">
      <h2 id="tour">What's in the core</h2>
      <ul class="feature-grid">
        ${tour.map(([name, title, text]) => html`
          <li class="card feature-card"><h3><a href=${`/docs/${name}`}>${title}</a></h3><p>${text}</p></li>`)}
      </ul>
      <p><a href="/docs">All of Pith, with live examples →</a></p>
    </section>

    <section class="section narrow" id="start" aria-labelledby="get-started">
      <h2 id="get-started">Get started</h2>
      <pre class="code" tabindex="0" aria-label="Commands to start a project"><code>npx pithjs create my-app
cd my-app
npm install
npm run dev      # → http://localhost:8000
npm run check    # "All good"</code></pre>
      <p class="muted note">Not on npm yet: from the Pith repo, run <code>node framework/tools/cli.mjs create my-app</code>.</p>
    </section>
  `;
}
