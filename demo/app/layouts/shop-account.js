import { html, signal } from 'pith';
import { router } from '../router.js';
import { session } from '../store.js';
import { toast } from '../ui.js';
import { icon } from '../icons.js';
import { shopHeader } from '../shop/header.js';
import '../components/account-context.js';
import '../components/account-greeting.js';

const links = [
  ['/shop/account/profile', 'Profile', 'user'],
  ['/shop/account/orders', 'Orders', 'bag'],
  ['/shop/account/appearance', 'Appearance', 'smile'],
];

// Shared by every /shop/account/* route. The router keeps it mounted while you move between them, so the side
// nav and the display name keep their state; only `page` changes. Pages read the display name with
// inject('account') (see components/account-greeting.js), instead of it being passed down as a prop.
// Orders needs sign-in: the router's guard sends a signed-out visitor to Sign in first (see app/router.js).
export default function ShopAccountLayout(page) {
  const displayName = signal('');
  const signOut = () => {
    session.user.value = null;
    toast('Signed out');
    router.navigate('/shop/account/sign-in');
  };

  return html`
    <div class="shop">
      ${shopHeader()}
      <account-context .value=${{ displayName }}>
        <div class="account">
          <aside class="account-side">
            <account-greeting></account-greeting>
            <nav aria-label="Account">
              <ul class="account-nav">
                ${links.map(([href, label, ic]) => html`
                  <li><a class="account-link" href=${href} aria-current=${() => (router.path.value === href ? 'page' : null)}>${icon(ic)}${label}</a></li>`)}
              </ul>
            </nav>
            ${() => (session.user.value
              ? html`<button class="btn ghost account-sign" type="button" @click=${signOut}>Sign out</button>`
              : router.path.value === '/shop/account/sign-in' ? null : html`<a class="btn account-sign" href="/shop/account/sign-in">Sign in</a>`)}
          </aside>
          <div class="account-body">${page}</div>
        </div>
      </account-context>
    </div>
  `;
}
