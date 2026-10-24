import { html } from 'pith';
import { router } from '../router.js';
import { session } from '../store.js';
import { icon } from '../icons.js';
import { cartCount } from './cart.js';
import { openCart } from './cart-drawer.js';

const items = (/** @type {number} */ n) => `${n} ${n === 1 ? 'item' : 'items'}`;

// The shop's own header, on every /shop page (each of the shop's three layouts draws it). It looks the same on
// all of them, so on a page change it's a still layer of its own (.shop-head in styles/main.css), not part of
// the page's fade.
export function shopHeader() {
  const path = () => router.path.value;
  const inAccount = () => path().startsWith('/shop/account');
  return html`
    <header class="shop-head">
      <a class="shop-brand" href="/shop">${icon('leaf')}<span>Fern &amp; Field</span></a>
      <nav class="shop-nav" aria-label="Shop">
        <a class="shop-link" href="/shop" aria-current=${() => (path() === '/shop' ? 'page' : null)}>Shop</a>
        <a class="shop-link" href="/shop/account/profile" aria-current=${() => (inAccount() ? 'page' : null)}>
          ${icon('user')}<span>${() => session.user.value?.name ?? 'Account'}</span></a>
      </nav>
      <button class="btn cart-btn" type="button" @click=${() => openCart()}
        aria-label=${() => (cartCount.value ? `Cart, ${items(cartCount.value)}` : 'Cart, empty')}>
        ${icon('bag')}<span>Cart</span>
        ${() => (cartCount.value ? html`<span class="cart-count" aria-hidden="true">${cartCount.value}</span>` : null)}
      </button>
    </header>`;
}
