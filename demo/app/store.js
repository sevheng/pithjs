import { createStore, signal } from 'pith';

// A pretend sign-in, for the Shop's guarded /shop/account/orders page. Not saved: a reload signs you out.
export const session = createStore({ user: /** @type {{ name: string, email: string } | null} */ (null) }, { name: 'session' });

// The theme: 'light', 'dark', or 'system' (follow the device). The header's moon/sun button and the Shop's
// Appearance page both set it. Saved by hand, not in a store: index.html reads 'pith-theme' before any JS runs.
const saved = (() => {
  try {
    return localStorage.getItem('pith-theme');
  } catch {
    return null;
  }
})();
export const theme = signal(saved === 'light' || saved === 'dark' ? saved : 'system');
/** @param {'light' | 'dark' | 'system'} next */
export function setTheme(next) {
  theme.value = next;
  if (next === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  try {
    if (next === 'system') localStorage.removeItem('pith-theme');
    else localStorage.setItem('pith-theme', next);
  } catch {
    // storage blocked: the theme still applies for this visit
  }
}

// ---------- Shop (/shop) ----------
/** @typedef {{ key: string, slug: string, name: string, price: number, qty: number, colour: string | null, size: string | null, art: string, tint: string }} CartLine */
// colour: the colour picked (null for a product that comes in one); tint: the colour its drawing is in.
// The cart: saved, so it survives a reload and follows the shopper's other tabs. Here (not in the shop's own
// files) because the router's guard reads it: checkout steps need something in the cart.
export const cart = createStore({ lines: /** @type {CartLine[]} */ ([]) }, { persist: 'pith-shop-cart' });
// What the checkout steps have collected so far. Not saved (a card number must never be): a reload starts over.
/** @typedef {{ name: string, email: string, address: string, city: string, postcode: string, country: string }} Address */
export const checkout = createStore({
  address: /** @type {Address | null} */ (null),
  delivery: /** @type {string | null} */ (null),
  placed: /** @type {string | null} */ (null), // the order just placed, for its thank-you page
}, { name: 'checkout' });
// ---------- end Shop ----------
