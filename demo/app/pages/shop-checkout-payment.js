import { html, form, rules, fetchJSON, batch } from 'pith';
import { router } from '../router.js';
import { cart, checkout } from '../store.js';
import { icon } from '../icons.js';
import { totals, money, DELIVERY } from '../shop/pricing.js';

const digits = (/** @type {string} */ v) => String(v).replace(/[\s-]/g, '');
const cardNumber = (/** @type {string} */ v) => (/^\d{16}$/.test(digits(v)) ? null : 'Enter the 16 digits on the card');
const expiry = (/** @type {string} */ v) => {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(v).trim());
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return 'Use MM/YY, like 08/29';
  const end = new Date(2000 + Number(m[2]), Number(m[1])); // the first day after the card's last month
  return end <= new Date() ? 'This card has expired' : null;
};

// Checkout, step 3 of 3: a look over the order, then the card. A demo: nothing is charged and nothing is kept,
// and the server takes test numbers only. 4242 4242 4242 4242 pays; 4000 0000 0000 0002 is declined (a 402,
// shown in the form, with what was typed kept); other numbers get a 422 under the card number.
export default function ShopCheckoutPayment() {
  router.preload('/shop/order/FF-0'); // the confirmation page's code
  const address = checkout.address.peek();
  const delivery = DELIVERY.find((d) => d.id === checkout.delivery.peek()) ?? DELIVERY[0];
  const f = form({
    initial: { cardName: address?.name ?? '', card: '', expiry: '', cvc: '' },
    validate: {
      cardName: rules.required('Enter the name on the card'),
      card: [rules.required('Enter the card number'), cardNumber],
      expiry: [rules.required('Enter the expiry date'), expiry],
      cvc: [rules.required('Enter the 3 digits on the back'), rules.pattern(/^\d{3}$/, '3 digits')],
    },
    onSubmit: async (values) => {
      const order = await fetchJSON('/api/shop', { json: {
        action: 'order',
        lines: cart.lines.peek().map(({ slug, colour, size, qty }) => ({ slug, colour, size, qty })),
        address: checkout.address.peek(),
        delivery: delivery.id,
        payment: values,
      } });
      batch(() => {
        checkout.placed.value = order.id;
        checkout.address.value = null;
        checkout.delivery.value = null;
        cart.lines.value = [];
      });
      router.navigate(`/shop/order/${order.id}`);
    },
  });
  const useTest = (/** @type {string} */ number) => {
    f.set('card', number);
    if (!f.fields.expiry.peek()) f.set('expiry', '12/30');
    if (!f.fields.cvc.peek()) f.set('cvc', '123');
  };
  const sum = () => totals(cart.lines.value, delivery.id);

  return html`
    <h1>Payment</h1>
    <dl class="review card">
      <div><dt>Deliver to</dt><dd>${address ? `${address.name}, ${address.address}, ${address.city} ${address.postcode}` : ''}</dd>
        <a class="review-change" href="/shop/checkout/shipping" aria-label="Change the address">Change</a></div>
      <div><dt>Delivery</dt><dd>${delivery.name}, ${delivery.when}</dd>
        <a class="review-change" href="/shop/checkout/delivery" aria-label="Change the delivery">Change</a></div>
    </dl>
    <div class="demo-card notice" role="note">
      <p><strong>This is a demo shop.</strong> No real payments are taken, and only test card numbers work. Never type a real card here.</p>
      <p class="row">
        <button class="btn small-btn" type="button" @click=${() => useTest('4242 4242 4242 4242')}>Use the test card</button>
        <button class="btn ghost small-btn" type="button" @click=${() => useTest('4000 0000 0000 0002')}>Use a card that's declined</button>
      </p>
    </div>
    <form class="form card checkout-form" novalidate @submit=${f.submit}>
      ${f.input('cardName', { label: 'Name on card', autocomplete: 'off' })}
      ${f.input('card', { label: 'Card number', autocomplete: 'off', placeholder: '4242 4242 4242 4242', hint: 'Test numbers only' })}
      <div class="form-pair">
        ${f.input('expiry', { label: 'Expiry (MM/YY)', autocomplete: 'off', placeholder: '12/30' })}
        ${f.input('cvc', { label: 'Security code', autocomplete: 'off', placeholder: '123' })}
      </div>
      ${() => (f.submitError.value ? html`<p class="form-error" role="alert">${f.submitError.value.body?.message ?? f.submitError.value.message}</p>` : null)}
      <div class="checkout-actions">
        <a class="btn ghost" href="/shop/checkout/delivery">${icon('back')} Delivery</a>
        <button class="btn primary big" type="submit" ?disabled=${f.submitting}>
          ${() => (f.submitting.value ? 'Placing your order…' : html`${icon('lock')} Pay ${money(sum().total)}`)}</button>
      </div>
    </form>`;
}
