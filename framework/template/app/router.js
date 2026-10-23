import { createRouter, html } from 'pith';
import { statusPage } from './brand.js';

// One line per page. Each page's code downloads only when it's first needed (or when a link to it is hovered).
// Add pages with: npm run new page <name> [--nav]
export const router = createRouter(
  {
    '/': { title: 'Home', load: () => import('./pages/home.js') },
    '*': { title: 'Not found', load: () => import('./pages/not-found.js') },
  },
  {
    title: (t) => `${t} · __APP_NAME__`,
    focus: '#main',
    // A page whose code didn't load (offline, a new deploy) or that crashed: the rest of the site still works.
    error: (err, retry) => statusPage({
      code: 'Error',
      title: 'Something went wrong',
      text: "This page didn't load or hit a bug. The rest of the site still works.",
      detail: err instanceof Error ? err.message : String(err),
      actions: html`
        <button class="btn primary" type="button" @click=${retry}>Try again</button>
        <a class="btn" href="/">Go home</a>
      `,
    }),
  }
);
