import { html } from 'pith';
import { code, note, c } from '../ui.js';

const taste = `
import { define, html, signal, computed, repeat } from 'pith';

define('todo-app', () => {
  const todos = signal([]);
  const draft = signal('');
  const left = computed(() => todos.value.filter((t) => !t.done).length);

  const add = (e) => {
    e.preventDefault();
    if (!draft.value.trim()) return;
    const todo = { id: crypto.randomUUID(), text: draft.value.trim(), done: false };
    todos.value = [...todos.value, todo];
    draft.value = '';
  };

  return html\`
    <form @submit=\${add}>
      <label for="new">New todo</label>
      <input id="new" .value=\${draft} @input=\${(e) => (draft.value = e.target.value)}>
      <button>Add</button>
    </form>
    <ul>\${repeat(todos, (t) => t.id, (t) => html\`<li>\${t.text}</li>\`)}</ul>
    <p>\${left} left</p>
  \`;
});`;

const sectionsList = [
  ['/docs/getting-started', 'Getting started', 'make a project, run it, add a page.'],
  ['/docs/ai-agents', 'Building with AI', 'AGENTS.md, the skills, and the tools an agent uses to check its own work.'],
  ['/docs/deploying', 'Building and deploying', 'a Vite build with prerendered pages, or the files as they are.'],
  ['/docs/signals', 'Core', 'signals, templates, lists, components, routing, shared state, data, forms and animation, one page each, with a live example.'],
  ['/docs/testing', 'Tools', 'npm run check, user flows, npm run see, and every warning code with its fix.'],
  ['/docs/examples', 'Examples', 'whole apps (chat, inbox, kanban, dashboard, trading, spreadsheet, settings) and how they are built.'],
  ['/docs/benchmarks', 'Performance', 'Pith, React and Vue measured on a slow phone.'],
];

export default () => html`
  <p>
    Pith is a small framework for building web apps on what the browser already does well. It gives you
    <strong>signals</strong> for state, <strong>${c('html`…`')} templates</strong> that update only the text
    that changed, <strong>components</strong> as real custom elements, a lazy-loading <strong>router</strong>,
    a <strong>store</strong>, <strong>data loading</strong> and <strong>forms</strong>. That's the whole
    framework: about 10 KB gzipped, with no runtime dependencies.
  </p>
  <p>
    It needs no build step. The files you write are the files the browser runs, through an import map. A new
    project still uses Vite by default, for reload-on-save in development and a bundled, prerendered
    production build, but you can drop it and deploy the folder as it is.
  </p>

  <h2 id="what-is-in-the-core">What's in the core, and what isn't</h2>
  <p>
    The core keeps only what most apps need and what is hard to get right by hand: updating the page when
    state changes, keyed lists, cancelling stale requests, accessible form errors, lazy routes, error
    boundaries. Every byte counts against a 10 KB budget that ${c('npm run check')} enforces, so a new feature
    has to pay for itself.
  </p>
  <p>
    Everything else is <strong>app code</strong>. Dialogs, toasts, tabs, menus and other widgets are a few
    dozen lines on top of the browser's own ${c('<dialog>')}, ${c('popover')} and CSS, and every app wants its
    own look anyway. A new project ships with ${c('app/ui.js')} (${c('confirm')}, ${c('dialog')},
    ${c('toast')}) as a starting point to change. An AI agent can write the rest from the browser's APIs; see
    <a href="/docs/dialogs">Dialogs and toasts</a>.
  </p>
  ${note(html`Pith is built so an AI agent can work on it safely: one rules file (${c('AGENTS.md')}), a code
    for every mistake, and one command that says whether everything still works.
    See <a href="/docs/ai-agents">Building with AI</a>.`)}

  <h2 id="a-taste">A taste</h2>
  <p>
    A component is a function that runs once and returns a template. A signal in a ${c('${}')} hole updates
    that spot in place when it changes; nothing else re-renders.
  </p>
  ${code(taste, { file: 'app/components/todo-app.js' })}
  <p>
    Then use it like any HTML tag: ${c('<todo-app></todo-app>')}. Text in holes is always escaped, so user
    input is safe to show.
  </p>

  <h2 id="how-the-docs-are-organized">How these docs are organized</h2>
  <ul>
    ${sectionsList.map(([href, title, text]) => html`<li><a href=${href}>${title}</a>: ${text}</li>`)}
  </ul>
  <p>
    New to Pith? Start with <a href="/docs/getting-started">Getting started</a>, then read the Core pages in
    order. Each one has a live example you can try, and its source.
  </p>
`;
