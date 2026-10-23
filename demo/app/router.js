import { createRouter, html } from 'pith';
import { session } from './store.js';
import { statusPage } from './brand.js';

// The settings pages share one layout (side nav + a display name field). It downloads with the first
// settings page, and stays mounted while you move between them.
const settings = { load: () => import('./layouts/settings.js') };

// Each page's code is downloaded only when it's first needed (or when a link to it is hovered).
export const router = createRouter(
  {
    '/': { title: 'Home', load: () => import('./pages/home.js') },
    '/features': { title: 'Features', load: () => import('./pages/features.js') },
    '/features/:name': { title: 'Feature', load: () => import('./pages/feature.js') },
    '/todos': { title: 'Todos', load: () => import('./pages/todos.js') },
    '/team': { title: 'Team', load: () => import('./pages/team.js') },
    '/team/:id': { title: 'Member', load: () => import('./pages/member.js') },
    '/contact': { title: 'Contact', load: () => import('./pages/contact.js') },
    '/about': { title: 'About', load: () => import('./pages/about.js') },
    '/settings': { redirect: '/settings/profile' },
    '/settings/profile': { title: 'Profile', layout: settings, load: () => import('./pages/settings-profile.js') },
    '/settings/appearance': { title: 'Appearance', layout: settings, load: () => import('./pages/settings-appearance.js') },
    '/settings/account': { title: 'Account', layout: settings, auth: true, load: () => import('./pages/settings-account.js') },
    '*': { title: 'Not found', load: () => import('./pages/not-found.js') },
  },
  {
    title: (t) => `${t} · Pith`,
    focus: '#main',
    // Routes marked `auth: true` need a signed-in visitor; others go to the profile page with a notice.
    guard: (to) => (to.route.auth && !session.signedIn.value ? '/settings/profile?denied=1' : true),
    // A page whose code didn't load (offline, a new deploy) or that crashed: the rest of the app still works.
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
