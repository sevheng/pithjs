import { html } from 'pith';
import { code, note, c } from '../ui.js';

export default () => html`
  <p>The storefront of Fern &amp; Field, the made-up shop whose back office is the <a href="/docs/dashboard">Dashboard</a>:
    the same name and the same products. This is the everyday kind of site most people build, where what matters is a
    fast first page, links that keep working, a cart that doesn't lose things, and a checkout that handles mistakes.
    It has 24 products, a cart, a three-step checkout and an account area (which took over the old Settings example:
    its URLs now open the account).</p>

  <h2 id="try">What to try</h2>
  <ul>
    <li>Pick a category, a sort and type a search on <a href="/shop">${c('/shop')}</a>: all three go into the URL, so a
      reload or a shared link shows the same grid. Picking a category or a sort moves the cards that stay to their new
      places.</li>
    <li>Open a product and pick a colour: the drawing and the URL follow (${c('?colour=')}). Add it to the cart: the count
      in the header goes up, and the toast has a View cart button.</li>
    <li>Open the cart. Change a quantity, remove a line, then Undo in the toast. Reload, or open the shop in a second tab:
      the cart is the same (and a change in one tab shows in the other).</li>
    <li>Check out. Leave the shipping form empty and continue: each field says what's missing. Use the postcode
      ${c('00000')}: the server refuses it (a 422), and its message shows under the field.</li>
    <li>On Payment, the page says it's a demo, and only test numbers work. "Use a card that's declined" fills in
      ${c('4000 0000 0000 0002')}: the server answers 402, and the form says so, keeping what you typed. "Use the test card"
      (${c('4242 4242 4242 4242')}) places the order, and you land on its confirmation.</li>
    <li>Open <a href="/shop/checkout/payment">${c('/shop/checkout/payment')}</a> with an empty cart: the guard sends you back
      to the shop with a notice. With something in the cart but no address, it sends you to Shipping.</li>
    <li>In the account, save a display name on Profile: "Hello, …" beside the menu follows. Go to Appearance and back: the
      name stayed, because the layout wasn't rebuilt. Appearance also sets the theme for the whole site.</li>
    <li>Open <a href="/shop/account/orders">Orders</a> while signed out: you land on Sign in, with a notice, and after
      signing in you're back on Orders, with the order you just placed on top.</li>
    <li>Open <a href="/shop/p/no-such-thing">a product that doesn't exist</a>, or <a href="/shop?fail">${c('/shop?fail')}</a>
      (the API answers 500): each says so, and the second offers Try again.</li>
  </ul>

  <h2 id="built">How it's built</h2>
  <ul>
    <li>${c('app/router.js')}: one lazy route per page, and three layouts: the shop's pages, the account and the checkout,
      each with the same header. The guard handles both Orders (${c('auth: true')}) and the checkout steps (${c('step')}).</li>
    <li>${c('app/pages/shop.js')}: the grid. ${c('app/pages/shop-product.js')}: a product. ${c('shop-checkout-*.js')}: the three
      steps. ${c('shop-order.js')}: an order. ${c('shop-account-*.js')} and ${c('shop-sign-in.js')}: the account.</li>
    <li>${c('app/layouts/shop-account.js')}: the side nav, the greeting and Sign in / Sign out; it provides the display name
      through ${c('<account-context>')} (${c('app/components/account-context.js')}), read by ${c('account-greeting.js')} and
      ${c('account-profile.js')}.</li>
    <li>${c('app/layouts/shop-checkout.js')}: the steps and the order summary, kept mounted from step to step.</li>
    <li>${c('app/shop/')}: the header, the cart drawer, the cart's helpers (add, quantity, remove with Undo), the product
      card, the drawings (SVG standing in for photos) and ${c('pricing.js')}: the delivery options and totals, imported by
      the browser and by the API, so both count the same.</li>
    <li>${c('app/store.js')}: the cart (saved), the checkout's answers so far (not saved: a card number never is), the theme and
      the pretend session.</li>
    <li>${c('api/shop.mjs')}: the dev API. The products (the Dashboard's ten plus fourteen more), one product with related ones,
      the account's orders, and POSTs that check an address, sign in, and place an order, priced from the catalogue rather
      than from what the browser says.</li>
    <li>${c('prerender.mjs')}: lists every product page, so each is built into HTML.</li>
  </ul>

  <h2 id="pith">The Pith parts it uses</h2>
  <ul>
    <li><a href="/docs/deploying">Building and deploying</a>: every product page prerendered, with the API's answer handed
      over, so the live page takes over without a "Loading…".</li>
    <li><a href="/docs/store">Shared state</a>: the cart in ${c('createStore()')} with ${c('persist')}, so it survives a reload and
      follows other tabs; a store with a ${c('name')} and no ${c('persist')} for the session and the checkout.</li>
    <li><a href="/docs/forms">Forms</a>: ${c('form()')} on each step, with rules here and 422s from the server per field, and a
      402 shown as the form's error.</li>
    <li><a href="/docs/router">Routing</a>: layouts kept mounted, a guard, ${c('router.query')} and ${c('setQuery()')} for the
      filters, ${c('router.preload()')} for the next step, and redirects from the old Settings URLs.</li>
    <li><a href="/docs/components">Components</a>: ${c('provide()')} and ${c('inject()')} for the display name.</li>
    <li><a href="/docs/resource">Loading data</a>: ${c('resource()')} with ${c('live()')} for the grid, so a filter patches it
      instead of rebuilding it; loading skeletons the size of the cards; a 404 with its own view.</li>
    <li><a href="/docs/animation">Animation</a>: ${c('class="motion"')} on the grid, with ${c('transition()')} around a category or
      sort change. In the cart, the list scrolls inside the panel, so its lines change at once (W051); the panel's parts
      move as blocks instead.</li>
    <li><a href="/docs/dialogs">Dialogs and toasts</a>: the cart is a ${c('dialog()')}, and Undo lives in a toast.</li>
  </ul>

  <h2 id="code">The interesting parts</h2>
  <h3 id="code-prerender">Every product page is HTML</h3>
  <p>${c('prerender.mjs')} lists the product URLs. ${c('npm run build')} loads each in a browser, with the dev API, and writes the
    page and the API's answers into ${c('dist/shop/p/<slug>/index.html')}. On the first load the page is there before any
    script runs, and the page's first ${c('fetchJSON')} of the same URL gets the answer from the file.</p>
  ${code(`
import { products, orders } from './api/shop.mjs';

export default async function paths() {
  return [/* … */ ...products.map((p) => \`/shop/p/\${p.slug}\`), \`/shop/order/\${orders.at(-1).id}\`];
}`, { file: 'prerender.mjs' })}
  ${note(html`The checkout steps are never prerendered: built with an empty cart, they'd show "empty" for a moment to
    someone with a full one. The guard redirects them when the cart is empty, and a route that redirects isn't prerendered.`)}

  <h3 id="code-guard">One guard, two jobs</h3>
  <p>Guards are synchronous, so the cart is in ${c('app/store.js')}, where the guard can read it. A route can carry any
    field: ${c('auth')} marks the pages that need sign-in, ${c('step')} the checkout's.</p>
  ${code(`
'/shop/checkout/payment': { title: 'Payment · Checkout', layout: shopCheckout, step: 'payment', load: … },
'/shop/account/orders': { title: 'Orders · Account', layout: shopAccount, auth: true, load: … },
// …
guard: (to) => {
  if (to.route.auth && !session.user.value) return \`/shop/account/sign-in?next=\${encodeURIComponent(to.path)}\`;
  if (to.route.step) return checkoutStep(to.route.step);
  return true;
},`, { file: 'app/router.js' })}
  ${note(html`A guard only decides what the browser shows. The API checks the order again: prices, stock and the card.`, 'warn')}

  <h3 id="code-cart">A cart that's saved and follows other tabs</h3>
  ${code(`
export const cart = createStore({ lines: [] }, { persist: 'pith-shop-cart' });`, { file: 'app/store.js' })}
  <p>Everything that shows the cart reads ${c('cart.lines')}: the header's count, the drawer, the checkout's summary. A change in
    another tab arrives as a storage event, and the store updates itself, so they all follow.</p>

  <h3 id="code-context">provide and inject</h3>
  <p>The account layout puts ${c('{ displayName }')} on ${c('<account-context>')}, which provides it. Any component inside, on any
    account page, can inject it. Because it's a signal, the greeting changes when Profile saves.</p>
  ${code(`
define('account-context', (props, ctx) => {
  provide('account', props.value.value);
  return html\`\${ctx.children}\`;
}, { props: ['value'] });

define('account-greeting', () => {
  const account = inject('account', null);
  const name = () => account?.displayName.value.trim() || session.user.value?.name || 'there';
  return html\`<p class="account-hello">Hello, <strong>\${name}</strong></p>\`;
});`, { file: 'app/components/account-context.js, account-greeting.js' })}

  <h2 id="tests">Its tests</h2>
  <p>In ${c('tests/flows.js')}:</p>
  <ul>
    <li>shop: /shop lists the products; category, sort and search are kept in the URL</li>
    <li>shop: a product page has its colours and sizes, and Add to cart counts in the header</li>
    <li>shop: the cart changes quantities, removes with Undo, and survives a reload</li>
    <li>shop: checkout in three steps, with a server error and a declined card, then the order</li>
    <li>shop: checkout steps need a cart, and the steps before them</li>
    <li>shop: an unknown product and a shop that fails to load say so</li>
    <li>shop account: the layout keeps the display name across its pages (provide / inject)</li>
    <li>shop account: Orders needs sign-in; the guard sends you to Sign in with a notice, then back</li>
    <li>shop account: Appearance sets the theme for the whole site</li>
    <li>shop: the old /settings URLs open the account</li>
  </ul>
`;
