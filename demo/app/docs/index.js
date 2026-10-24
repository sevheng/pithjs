// The docs: every page at /docs/<name>, in sidebar order. A page's body is its own file in app/docs/pages/,
// downloaded only when it's opened. The frame around it (app/pages/doc.js) adds the title, the summary, the
// live example and its source (for pages with `example`, from app/examples/), an "Open the app" button (for
// pages with `app`, from app/apps.js), and links to the previous and next page.

/**
 * @typedef {{ name: string, title: string, summary: string, load: () => Promise<{ default: () => unknown }>,
 *   example?: string, app?: string, own?: true, wide?: true }} DocPage
 *   example: the live example from app/examples/<example>.js · app: the name of an app in app/apps.js ·
 *   own: the page renders its own heading and layout (Benchmarks) · wide: the full width, no "On this page" list
 */

/** @type {{ title: string, pages: DocPage[] }[]} */
export const sections = [
  {
    title: 'Start',
    pages: [
      { name: 'introduction', title: 'Introduction', summary: 'What Pith is, what it does for you, and what it leaves to the browser.',
        load: () => import('./pages/introduction.js') },
      { name: 'getting-started', title: 'Getting started', summary: 'Make a project, run it, and find your way around its files.',
        load: () => import('./pages/getting-started.js') },
      { name: 'ai-agents', title: 'Building with AI', summary: 'AGENTS.md, the skills, and the tools that let an agent check its own work.',
        load: () => import('./pages/ai-agents.js') },
      { name: 'deploying', title: 'Building and deploying', summary: 'A Vite build with prerendered pages, or the files as they are.',
        load: () => import('./pages/deploying.js') },
    ],
  },
  {
    title: 'Core',
    pages: [
      { name: 'signals', title: 'Signals', example: 'signals', summary: 'Values that update exactly the text that shows them, nothing else.',
        load: () => import('./pages/signals.js') },
      { name: 'templates', title: 'Templates', summary: 'html`…` with holes for text, attributes, events and nested templates.',
        load: () => import('./pages/templates.js') },
      { name: 'lists', title: 'Lists', example: 'lists', summary: 'Keyed lists that move rows instead of rebuilding them.',
        load: () => import('./pages/lists.js') },
      { name: 'selector', title: 'Selecting a row', example: 'selector', summary: 'Mark the selected item by touching 2 rows, not all of them.',
        load: () => import('./pages/selector.js') },
      { name: 'components', title: 'Components', example: 'components', summary: 'Custom elements with props, slots and context.',
        load: () => import('./pages/components.js') },
      { name: 'errors', title: 'Error boundaries', example: 'errors', summary: 'A crash shows a fallback with "Try again"; the rest of the page keeps working.',
        load: () => import('./pages/errors.js') },
      { name: 'router', title: 'Routing', example: 'router', summary: 'Lazy pages, :params, the ?query as signals, layouts and a guard.',
        load: () => import('./pages/router.js') },
      { name: 'store', title: 'Shared state', example: 'store', summary: 'Signals saved to localStorage and kept in step across tabs.',
        load: () => import('./pages/store.js') },
      { name: 'resource', title: 'Loading data', example: 'resource', summary: 'Loading, errors, refetch, optimistic saves and cancelled stale requests.',
        load: () => import('./pages/resource.js') },
      { name: 'paginated', title: 'Pages of data', example: 'paginated', summary: 'A long list a page at a time, with "Load more".',
        load: () => import('./pages/paginated.js') },
      { name: 'forms', title: 'Forms', example: 'forms', summary: 'Validation, accessible errors, submitting, and errors from the server.',
        load: () => import('./pages/forms.js') },
      { name: 'animation', title: 'Animation', summary: 'transition() for things that appear, move and leave, and CSS for the rest.',
        load: () => import('./pages/animation.js') },
    ],
  },
  {
    title: 'Tools',
    pages: [
      { name: 'testing', title: 'Checks and flows', summary: 'npm run check, user flows that click like a person, and npm run see.',
        load: () => import('./pages/testing.js') },
      { name: 'warnings', title: 'Warnings and errors', summary: 'Every [pith W…] and [pith E…] message, and how to fix it.',
        load: () => import('./pages/warnings.js') },
      { name: 'dialogs', title: 'Dialogs and toasts', example: 'dialogs', summary: 'App code on the native <dialog> and popover, not part of the framework.',
        load: () => import('./pages/dialogs.js') },
    ],
  },
  {
    title: 'Examples',
    pages: [
      { name: 'examples', title: 'All examples', wide: true, summary: 'Real apps, not snippets: every state handled, on phones and in dark mode.',
        load: () => import('./pages/examples.js') },
      { name: 'chat', title: 'Chat', app: 'Chat', summary: 'Rooms with rich messages, sent at once, with a bot, and 100,000 messages in #firehose.',
        load: () => import('./pages/chat.js') },
      { name: 'inbox', title: 'Inbox', app: 'Inbox', summary: 'A three-pane mail app: folders, search, bulk actions with Undo, and Compose.',
        load: () => import('./pages/inbox.js') },
      { name: 'kanban', title: 'Kanban', app: 'Kanban', summary: 'A board you change by drag and drop or the keyboard, saved in a store.',
        load: () => import('./pages/kanban.js') },
      { name: 'dashboard', title: 'Dashboard', app: 'Dashboard', summary: 'KPIs, SVG charts and a sortable, paged orders table, all kept in the URL.',
        load: () => import('./pages/dashboard.js') },
      { name: 'trading', title: 'Trading', app: 'Trading', summary: 'Live prices that tick in place, candlesticks, an order book and an order ticket.',
        load: () => import('./pages/trading.js') },
      // ---------- Shop (/shop) ----------
      { name: 'shop', title: 'Shop', app: 'Shop', summary: 'A storefront: prerendered product pages, a saved cart, a three-step checkout and an account.',
        load: () => import('./pages/shop.js') },
      // ---------- end Shop ----------
    ],
  },
  {
    title: 'Performance',
    pages: [
      { name: 'benchmarks', title: 'Benchmarks', own: true, summary: 'Pith, React and Vue, measured on a slow phone.',
        load: () => import('../pages/benchmarks.js') },
    ],
  },
];

export const docs = sections.flatMap((s) => s.pages);
export const docByName = (name) => docs.find((d) => d.name === name);
/** The URL of a docs page: the introduction is /docs itself. */
export const docHref = (name) => (name === 'introduction' ? '/docs' : `/docs/${name}`);
