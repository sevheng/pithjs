import { html, computed, repeat, transition, untrack } from 'pith';
import { router } from '../router.js';
import { cart } from '../store.js';
import { dialog } from '../ui.js';
import { icon } from '../icons.js';
import { productArt } from './art.js';
import { cartTotals, setQty, removeLine, optionText } from './cart.js';
import { money, FREE_OVER, MAX_QTY } from './pricing.js';

/** @typedef {import('../store.js').CartLine} CartLine */

let open = false;

/**
 * The cart, in a panel on the right (a sheet from the bottom on phones): a dialog() from app/ui.js, so it traps
 * focus, closes on Esc or a click outside, and gives focus back. Changing a quantity or removing a line changes
 * the cart store, so the header's count and any other tab follow.
 */
export function openCart() {
  if (open) return;
  open = true;
  router.preload('/shop/checkout/shipping'); // the likely next page: its code downloads while the cart is open
  dialog((close) => {
    // The rows are keyed by the line's key and read their line from the store, so changing a quantity updates
    // that row's numbers in place (and keeps focus on the + button) instead of building the row again.
    const keys = computed(() => cart.lines.value.map((l) => l.key));
    const empty = computed(() => keys.value.length === 0);
    const go = (/** @type {string} */ href) => {
      close();
      router.navigate(href);
    };
    const toFree = () => FREE_OVER - cartTotals.value.subtotal;

    /** @param {string} key */
    const row = (key) => {
      const l = /** @type {CartLine} */ (cart.lines.peek().find((x) => x.key === key));
      const qty = computed(() => cart.lines.value.find((x) => x.key === key)?.qty ?? l.qty);
      return html`
      <li class="cart-line">
        <a class="cart-line-art" href=${`/shop/p/${l.slug}`} tabindex="-1" aria-hidden="true" @click=${(/** @type {Event} */ e) => (e.preventDefault(), go(`/shop/p/${l.slug}`))}>
          ${productArt(l, l.tint, { size: 64 })}</a>
        <div class="cart-line-text">
          <a class="cart-line-name" href=${`/shop/p/${l.slug}`} @click=${(/** @type {Event} */ e) => (e.preventDefault(), go(`/shop/p/${l.slug}`))}>${l.name}</a>
          ${optionText(l) ? html`<span class="muted note">${optionText(l)}</span>` : null}
          <div class="stepper" role="group" aria-label=${`Quantity of ${l.name}`}>
            <button class="icon-btn" type="button" aria-label=${`One fewer ${l.name}`} ?disabled=${() => qty.value <= 1} @click=${() => setQty(key, qty.peek() - 1)}>${icon('minus')}</button>
            <span class="stepper-value">${qty}</span>
            <button class="icon-btn" type="button" aria-label=${`One more ${l.name}`} ?disabled=${() => qty.value >= MAX_QTY} @click=${() => setQty(key, qty.peek() + 1)}>${icon('plus')}</button>
          </div>
        </div>
        <div class="cart-line-end">
          <span class="cart-line-price">${() => money(l.price * qty.value)}</span>
          <button class="btn ghost small-btn" type="button" aria-label=${`Remove ${l.name}`}
            @click=${() => removeLine(/** @type {CartLine} */ (cart.lines.peek().find((x) => x.key === key)), transition)}>Remove</button>
        </div>
      </li>`;
    };

    const full = () => html`
      <ul class="cart-lines scroll-quiet" aria-label="Items in your cart">${repeat(keys, (k) => k, row)}</ul>
      <div class="cart-foot">
        ${() => (toFree() > 0
          ? html`<p class="free-note"><span class="free-bar" style=${`--done: ${Math.round((cartTotals.value.subtotal / FREE_OVER) * 100)}%`}></span>
              Add ${money(toFree())} more for free standard delivery.</p>`
          : html`<p class="free-note done">${icon('check')} Free standard delivery on this order.</p>`)}
        <dl class="sum">
          <div><dt>Subtotal</dt><dd>${() => money(cartTotals.value.subtotal)}</dd></div>
          <div class="muted"><dt>Delivery</dt><dd>Chosen at checkout</dd></div>
        </dl>
        <button class="btn primary big cart-go" type="button" @click=${() => go('/shop/checkout/shipping')}>${icon('lock')} Check out</button>
      </div>`;

    const none = () => html`
      <div class="cart-empty">
        <span class="icon-tile">${icon('bag')}</span>
        <p><strong>Your cart is empty.</strong></p>
        <p class="muted note">Things you add show up here, and stay when you come back.</p>
        <button class="btn" type="button" @click=${() => (router.path.peek() === '/shop' ? close() : go('/shop'))}>Browse the shop</button>
      </div>`;

    return html`
      <div class="cart-drawer">
        <div class="cart-head">
          <h2 id="cart-title">Your cart <span class="muted">${() => (cartTotals.value.items ? `(${cartTotals.value.items})` : '')}</span></h2>
          <button class="icon-btn" type="button" aria-label="Close cart" @click=${() => close()}>${icon('close')}</button>
        </div>
        <div class="cart-body motion">${() => (empty.value ? untrack(none) : untrack(full))}</div>
      </div>`;
  }).finally(() => (open = false));
}
