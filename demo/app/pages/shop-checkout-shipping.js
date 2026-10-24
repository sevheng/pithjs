import { html, form, rules, fetchJSON } from 'pith';
import { router } from '../router.js';
import { checkout, session } from '../store.js';

export const COUNTRIES = [['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['AU', 'Australia']];

// Checkout, step 1 of 3. The server checks the address too (a 422 shows under its field: try the postcode 00000).
// What's typed is kept in the checkout store, so coming back from a later step finds it filled in.
export default function ShopCheckoutShipping() {
  router.preload('/shop/checkout/delivery'); // the next step's code downloads while this one is filled in
  const saved = checkout.address.peek();
  const f = form({
    initial: saved ?? { name: session.user.peek()?.name ?? '', email: session.user.peek()?.email ?? '', address: '', city: '', postcode: '', country: 'US' },
    validate: {
      name: rules.required('Enter the name to deliver to'),
      email: [rules.required('Enter an email address for the receipt'), rules.email()],
      address: rules.required('Enter a street address'),
      city: rules.required('Enter a town or city'),
      postcode: [rules.required('Enter a postcode'), rules.pattern(/^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/, 'Letters, digits and spaces, 2 to 10 of them')],
    },
    onSubmit: async (values) => {
      await fetchJSON('/api/shop', { json: { action: 'address', ...values } });
      checkout.address.value = values;
      router.navigate('/shop/checkout/delivery');
    },
  });

  return html`
    <h1>Shipping</h1>
    <p class="muted">Where should we send your order?</p>
    <form class="form card checkout-form" novalidate @submit=${f.submit}>
      ${f.input('name', { label: 'Full name', autocomplete: 'name' })}
      ${f.input('email', { label: 'Email', type: 'email', autocomplete: 'email', hint: 'For the receipt and delivery updates' })}
      ${f.input('address', { label: 'Street address', autocomplete: 'street-address' })}
      <div class="form-pair">
        ${f.input('city', { label: 'Town or city', autocomplete: 'address-level2' })}
        ${f.input('postcode', { label: 'Postcode', autocomplete: 'postal-code' })}
      </div>
      ${f.select('country', { label: 'Country', options: COUNTRIES })}
      ${() => (f.submitError.value ? html`<p class="form-error" role="alert">${f.submitError.value.message}</p>` : null)}
      <div class="checkout-actions">
        <button class="btn primary big" type="submit" ?disabled=${f.submitting}>${() => (f.submitting.value ? 'Checking…' : 'Continue to delivery')}</button>
      </div>
    </form>`;
}
