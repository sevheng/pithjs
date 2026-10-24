import { createRouter, html } from 'pith';
import { session } from './store.js';
import { statusPage } from './brand.js';
import { docByName } from './docs/index.js';

// The settings pages share one layout (side nav + a display name field). It downloads with the first
// settings page, and stays mounted while you move between them.
const settings = { load: () => import('./layouts/settings.js') };
// The docs sidebar stays mounted while you move between docs pages.
const docs = { load: () => import('./layouts/docs.js') };
const docTitle = ({ page = 'introduction' }) => docByName(page)?.title ?? 'Docs';
// The chat frame (rooms list + the open room) stays mounted while you switch rooms.
const chat = { load: () => import('./layouts/chat.js') };
// ---------- Inbox (/inbox) ---------- the folders pane stays mounted while you switch folders.
const inbox = { load: () => import('./layouts/inbox.js') };
// ---------- end Inbox ----------
// Trading (/trade): the watchlist, the feed and the account bar stay mounted while you switch symbols.
const trade = { load: () => import('./layouts/trade.js') };

// Each page's code is downloaded only when it's first needed (or when a link to it is hovered).
export const router = createRouter(
  {
    '/': { title: 'Home', load: () => import('./pages/home.js') },
    '/docs': { title: docTitle, layout: docs, load: () => import('./pages/doc.js') },
    '/docs/:page': { title: docTitle, layout: docs, load: () => import('./pages/doc.js') },
    '/chat': { title: 'Chat', layout: chat, load: () => import('./pages/chat-home.js') },
    '/chat/:room': { title: 'Chat', layout: chat, load: () => import('./pages/chat-room.js') },
    // ---------- Inbox (/inbox) ----------
    '/inbox': { redirect: '/inbox/inbox' },
    '/inbox/:folder': { title: 'Inbox', layout: inbox, load: () => import('./pages/inbox.js') },
    // ---------- end Inbox ----------
    // ---------- Kanban (/kanban) ----------
    '/kanban': { title: 'Kanban', load: () => import('./pages/kanban.js') },
    '/dashboard': { title: 'Dashboard', load: () => import('./pages/dashboard.js') }, // Dashboard (/dashboard)
    // ---------- Trading (/trade) ----------
    '/trade': { redirect: '/trade/NWX' },
    '/trade/:symbol': { title: ({ symbol }) => `${symbol} · Trading`, layout: trade, load: () => import('./pages/trade.js') },
    // ---------- end Trading ----------
    // Older URLs of this demo: the feature pages, the examples hub and the benchmarks moved into the docs.
    '/features': { redirect: '/docs' },
    '/features/:name': { redirect: ({ name }) => `/docs/${name}` },
    '/examples': { redirect: '/docs/examples' },
    '/benchmarks': { redirect: '/docs/benchmarks' },
    '/todos': { redirect: '/docs/examples' },
    '/team': { redirect: '/docs/examples' },
    '/team/:id': { redirect: '/docs/examples' },
    '/contact': { redirect: '/docs/examples' },
    '/about': { redirect: '/docs/benchmarks' },
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
