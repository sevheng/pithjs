import { html, computed } from 'pith';
import { router } from '../router.js';
import { cart, checkout } from '../store.js';
import { icon } from '../icons.js';
import { shopHeader } from '../shop/header.js';
import { productArt } from '../shop/art.js';
import { optionText } from '../shop/cart.js';
import { totals, money, DELIVERY } from '../shop/pricing.js';

export const STEPS = [
  ['shipping', 'Shipping'],
  ['delivery', 'Delivery'],
  ['payment', 'Payment'],
];

// The frame of the three checkout steps (/shop/checkout/shipping, /delivery, /payment): the steps on top and the
// order summary beside the step's form. It stays mounted from step to step, so the summary doesn't load or
// redraw; each step's form keeps what was typed in the checkout store (app/store.js). The router's guard sends you
// back to the first step that's missing (or to /shop when the cart is empty).
export default function ShopCheckoutLayout(page) {
  const step = computed(() => router.path.value.split('/')[3] ?? 'shipping');
  const at = computed(() => STEPS.findIndex(([id]) => id === step.value));
  const sum = computed(() => totals(cart.lines.value, checkout.delivery.value));
  const deliveryName = () => DELIVERY.find((d) => d.id === checkout.delivery.value)?.name;

  return html`
    <div class="shop">
      ${shopHeader()}
      <div class="checkout">
        <ol class="steps" aria-label="Checkout steps">
          ${STEPS.map(([id, label], i) => html`
            <li class=${() => (i < at.value ? 'step done' : i === at.value ? 'step now' : 'step')} aria-current=${() => (i === at.value ? 'step' : null)}>
              <span class="step-mark" aria-hidden="true">${() => (i < at.value ? icon('check') : String(i + 1))}</span>
              ${() => (i < at.value ? html`<a href=${`/shop/checkout/${id}`}>${label}</a>` : html`<span>${label}</span>`)}
              ${() => (i < at.value ? html`<span class="sr-only"> (done)</span>` : null)}
            </li>`)}
        </ol>
        <div class="checkout-main">${page}</div>
        <aside class="checkout-sum card" aria-labelledby="sum-title">
          <h2 id="sum-title">Order summary</h2>
          <ul class="sum-lines">
            ${() => cart.lines.value.map((l) => html`
              <li><span class="sum-art">${productArt(l, l.tint, { size: 48 })}<span class="sum-qty" aria-hidden="true">${l.qty}</span></span>
                <span class="sum-name"><span class="sr-only">${l.qty} × </span>${l.name}${optionText(l) ? html`<span class="muted note">${optionText(l)}</span>` : null}</span>
                <span class="sum-price">${money(l.price * l.qty)}</span></li>`)}
          </ul>
          <dl class="sum">
            <div><dt>Subtotal</dt><dd>${() => money(sum.value.subtotal)}</dd></div>
            <div><dt>${() => (checkout.delivery.value ? `Delivery (${deliveryName()})` : 'Delivery')}</dt>
              <dd>${() => (!checkout.delivery.value ? html`<span class="muted">Next step</span>` : sum.value.shipping ? money(sum.value.shipping) : 'Free')}</dd></div>
            <div class="sum-total"><dt>Total</dt><dd>${() => money(sum.value.total - (checkout.delivery.value ? 0 : sum.value.shipping))}</dd></div>
          </dl>
          <p class="muted note sum-note">${icon('lock')} A demo shop: nothing is charged, and no card details are kept.</p>
        </aside>
      </div>
    </div>`;
}
