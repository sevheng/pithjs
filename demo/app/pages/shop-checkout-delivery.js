import { html, form, rules } from 'pith';
import { router } from '../router.js';
import { cart, checkout } from '../store.js';
import { icon } from '../icons.js';
import { DELIVERY, deliveryPrice, totals, money } from '../shop/pricing.js';
import { COUNTRIES } from './shop-checkout-shipping.js';

// Checkout, step 2 of 3: how it travels. The prices follow the cart (standard is free over $75), and the summary
// beside the form shows the choice at once.
export default function ShopCheckoutDelivery() {
  router.preload('/shop/checkout/payment');
  const address = checkout.address.peek();
  const f = form({
    initial: { delivery: checkout.delivery.peek() ?? 'standard' },
    validate: { delivery: rules.required('Pick how you want it delivered') },
    onSubmit: (values) => {
      checkout.delivery.value = values.delivery;
      router.navigate('/shop/checkout/payment');
    },
  });
  const subtotal = () => totals(cart.lines.value).subtotal;
  const pick = (/** @type {string} */ id) => {
    f.set('delivery', id);
    checkout.delivery.value = id; // the summary follows the choice before Continue
  };
  if (!checkout.delivery.peek()) checkout.delivery.value = f.fields.delivery.peek();

  return html`
    <h1>Delivery</h1>
    ${address ? html`<p class="muted address-line">To ${address.name}, ${address.address}, ${address.city} ${address.postcode},
      ${COUNTRIES.find(([c]) => c === address.country)?.[1]}. <a href="/shop/checkout/shipping">Change</a></p>` : null}
    <form class="form card checkout-form" novalidate @submit=${f.submit}>
      <fieldset class="choice-list">
        <legend class="field-label">Delivery</legend>
        ${DELIVERY.map((d) => html`
          <label class="choice">
            <input type="radio" name="delivery" value=${d.id} .checked=${() => f.fields.delivery.value === d.id} @change=${() => pick(d.id)}>
            <span class="choice-text"><strong>${d.name}</strong><span class="muted note">${d.when}</span></span>
            <span class="choice-price">${() => (deliveryPrice(d.id, subtotal()) ? money(deliveryPrice(d.id, subtotal())) : 'Free')}</span>
          </label>`)}
      </fieldset>
      ${() => (f.error('delivery') ? html`<p class="field-error" role="alert">${f.error('delivery')}</p>` : null)}
      <div class="checkout-actions">
        <a class="btn ghost" href="/shop/checkout/shipping">${icon('back')} Shipping</a>
        <button class="btn primary big" type="submit">Continue to payment</button>
      </div>
    </form>`;
}
