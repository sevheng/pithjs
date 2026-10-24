import { html, form, rules, fetchJSON } from 'pith';
import { router } from '../router.js';
import { session } from '../store.js';
import { toast } from '../ui.js';

// A pretend sign-in: any email and a password of 6 or more characters work. The guard sends visitors here from a
// page that needs it (?next=/shop/account/orders), with a notice, and they go back there after.
export default function ShopSignIn() {
  const next = () => {
    const n = router.query.value.next ?? '';
    return n.startsWith('/shop/') ? n : '/shop/account/orders'; // only back into the shop, never another site
  };
  const f = form({
    initial: { email: '', password: '' },
    validate: { email: [rules.required('Enter your email address'), rules.email()], password: [rules.required('Enter your password'), rules.minLength(6)] },
    onSubmit: async (values) => {
      session.user.value = await fetchJSON('/api/shop', { json: { action: 'sign-in', ...values } });
      toast(`Signed in as ${values.email}`, { type: 'success' });
      router.navigate(next(), { replace: true });
    },
  });

  return html`
    <h1>Sign in</h1>
    ${() => (router.query.value.next && !session.user.value
      ? html`<p class="notice" role="alert">Sign in to see your orders.</p>`
      : html`<p class="muted">See your orders and check out faster.</p>`)}
    ${() => (session.user.value
      ? html`<div class="card account-form"><p>You're signed in as <strong>${session.user.value.email}</strong>.</p>
          <a class="btn primary" href="/shop/account/orders">Your orders</a></div>`
      : html`<form class="form card account-form" novalidate @submit=${f.submit}>
          ${f.input('email', { label: 'Email', type: 'email', autocomplete: 'email' })}
          ${f.input('password', { label: 'Password', type: 'password', autocomplete: 'current-password', hint: 'A demo: any password of 6 or more characters works' })}
          ${() => (f.submitError.value ? html`<p class="form-error" role="alert">${f.submitError.value.message}</p>` : null)}
          <button class="btn primary" type="submit" ?disabled=${f.submitting}>${() => (f.submitting.value ? 'Signing in…' : 'Sign in')}</button>
        </form>`)}
  `;
}
