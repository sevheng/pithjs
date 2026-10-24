import { html, resource, fetchJSON } from 'pith';
import { icon } from '../icons.js';
import { productArt } from '../shop/art.js';
import { money } from '../shop/pricing.js';
import { orderStatus, orderDate } from '../shop/orders.js';

// Guarded: the router shows it only to a signed-in visitor (`auth: true` in app/router.js); everyone else is sent to
// Sign in, and comes back here after. Orders placed at checkout show up at the top.
export default function ShopAccountOrders() {
  const orders = resource(({ signal }) => fetchJSON('/api/shop?view=orders', { signal }));

  return html`
    <h1>Orders</h1>
    ${orders.render({
      loading: () => html`<ul class="order-list" aria-busy="true">${[1, 2, 3].map(() => html`<li class="card order-row"><span class="shop-skel line"></span></li>`)}</ul>
        <p class="sr-only" role="status">Loading your orders…</p>`,
      error: (err, retry) => html`<div class="load-error" role="alert"><p><strong>Couldn't load your orders.</strong> ${err?.message ?? ''}</p>
        <button class="btn" type="button" @click=${retry}>${icon('refresh')} Try again</button></div>`,
      ready: (/** @type {{ orders: import('../shop/orders.js').Order[] }} */ { orders: list }) => (list.length
        ? html`<ul class="order-list">${list.map((o) => html`
            <li class="card order-row lift">
              <span class="order-arts" aria-hidden="true">${o.lines.slice(0, 3).map((l) => productArt(l, l.tint, { size: 44 }))}</span>
              <span class="order-main">
                <a class="stretched" href=${`/shop/order/${o.id}`}>Order ${o.id}</a>
                <span class="muted note">${orderDate(o.date)} · ${o.lines.reduce((n, l) => n + l.qty, 0)} items</span>
              </span>
              <span class=${`order-status ${o.status}`}>${orderStatus(o.status)}</span>
              <span class="order-total">${money(o.total)}</span>
            </li>`)}</ul>`
        : html`<div class="shop-empty"><span class="icon-tile">${icon('bag')}</span><h2>No orders yet</h2>
            <p class="muted">When you buy something, it shows up here.</p><a class="btn primary" href="/shop">Browse the shop</a></div>`),
    })}
  `;
}
