import { createRouter, html } from 'pith';
import { session, cart, checkout } from './store.js';
import { statusPage } from './brand.js';
import { docByName } from './docs/index.js';

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
// ---------- Shop (/shop) ----------
// Three layouts, each with the shop header and the cart: the shop's pages, the account (a side nav, kept mounted
// between account pages) and the checkout (the steps and the order summary, kept mounted between steps).
const shop = { load: () => import('./layouts/shop.js') };
const shopAccount = { load: () => import('./layouts/shop-account.js') };
const shopCheckout = { load: () => import('./layouts/shop-checkout.js') };
// "ceramic-mug" → "Ceramic mug": product names are sentence case, so the title needs no data.
const productTitle = (/** @type {Record<string, string>} */ { slug }) => `${slug.charAt(0).toUpperCase()}${slug.slice(1).replace(/-/g, ' ')} · Shop`;
// A checkout step needs something in the cart, and the steps before it: otherwise go to the first one missing.
// (So the steps are never prerendered with an empty cart: a redirect isn't.)
const checkoutStep = (step) => {
  if (!cart.lines.value.length) return '/shop?cart=empty';
  if (step !== 'shipping' && !checkout.address.value) return '/shop/checkout/shipping';
  if (step === 'payment' && !checkout.delivery.value) return '/shop/checkout/delivery';
  return true;
};
// ---------- end Shop ----------

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
    // ---------- Shop (/shop) ----------
    '/shop': { title: 'Shop', layout: shop, load: () => import('./pages/shop.js') },
    '/shop/p/:slug': { title: productTitle, layout: shop, load: () => import('./pages/shop-product.js') },
    '/shop/order/:id': { title: ({ id }) => `Order ${id} · Shop`, layout: shop, load: () => import('./pages/shop-order.js') },
    '/shop/checkout': { redirect: '/shop/checkout/shipping' },
    '/shop/checkout/shipping': { title: 'Shipping · Checkout', layout: shopCheckout, step: 'shipping', load: () => import('./pages/shop-checkout-shipping.js') },
    '/shop/checkout/delivery': { title: 'Delivery · Checkout', layout: shopCheckout, step: 'delivery', load: () => import('./pages/shop-checkout-delivery.js') },
    '/shop/checkout/payment': { title: 'Payment · Checkout', layout: shopCheckout, step: 'payment', load: () => import('./pages/shop-checkout-payment.js') },
    '/shop/account': { redirect: '/shop/account/profile' },
    '/shop/account/profile': { title: 'Profile · Account', layout: shopAccount, load: () => import('./pages/shop-account-profile.js') },
    '/shop/account/orders': { title: 'Orders · Account', layout: shopAccount, auth: true, load: () => import('./pages/shop-account-orders.js') },
    '/shop/account/appearance': { title: 'Appearance · Account', layout: shopAccount, load: () => import('./pages/shop-account-appearance.js') },
    '/shop/account/sign-in': { title: 'Sign in · Account', layout: shopAccount, load: () => import('./pages/shop-sign-in.js') },
    // The Settings example became the Shop's account.
    '/settings': { redirect: '/shop/account/profile' },
    '/settings/profile': { redirect: '/shop/account/profile' },
    '/settings/appearance': { redirect: '/shop/account/appearance' },
    '/settings/account': { redirect: '/shop/account/orders' },
    // ---------- end Shop ----------
    // ---------- Spreadsheet (/sheet) ----------
    '/sheet': { title: 'Spreadsheet', load: () => import('./pages/sheet.js') },
    // ---------- end Spreadsheet ----------
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
    '*': { title: 'Not found', load: () => import('./pages/not-found.js') },
  },
  {
    title: (t) => `${t} · Pith`,
    focus: '#main',
    // Routes marked `auth: true` need a signed-in visitor; others go to Sign in (with a notice), and back after.
    guard: (to) => {
      if (to.route.auth && !session.user.value) return `/shop/account/sign-in?next=${encodeURIComponent(to.path)}`;
      if (to.route.step) return checkoutStep(to.route.step); // Shop (/shop)
      return true;
    },
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
