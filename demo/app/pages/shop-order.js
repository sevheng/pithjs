import { html, resource, fetchJSON } from 'pith';
import { checkout } from '../store.js';
import { icon } from '../icons.js';
import { productArt } from '../shop/art.js';
import { optionText } from '../shop/cart.js';
import { money, DELIVERY } from '../shop/pricing.js';
import { orderStatus, orderDate } from '../shop/orders.js';

// /shop/order/:id: one order. Right after checkout it says thank you; from the account's order list it's the
// order's details. An unknown id says so (the API answers 404).
/** @param {{ id: string }} params */
export default function ShopOrderPage({ id }) {
  const order = resource(({ signal }) => fetchJSON(`/api/shop?order=${encodeURIComponent(id)}`, { signal }));
  const fresh = checkout.placed.peek() === id;

  return html`<section class="order-page">${order.render({
    loading: () => html`<h1>${fresh ? 'Thank you' : `Order ${id}`}</h1><div class="card order-card"><span class="shop-skel block"></span></div>
      <p class="sr-only" role="status">Loading the order…</p>`,
    error: (err, retry) => (err?.status === 404
      ? html`<div class="shop-missing"><span class="icon-tile">${icon('search')}</span><h1>No such order</h1>
          <p class="muted">There's no order ${id}. Your orders are all in your account.</p>
          <a class="btn primary" href="/shop/account/orders">Your orders</a></div>`
      : html`<h1>Order ${id}</h1><div class="load-error" role="alert"><p><strong>Couldn't load the order.</strong> ${err?.message ?? ''}</p>
          <button class="btn" type="button" @click=${retry}>${icon('refresh')} Try again</button></div>`),
    ready: (/** @type {import('../shop/orders.js').Order} */ o) => {
      const delivery = DELIVERY.find((d) => d.id === o.delivery);
      return html`
        ${fresh ? html`
          <div class="order-thanks">
            <span class="thanks-mark">${icon('check')}</span>
            <h1>Thank you, ${o.address.name.split(' ')[0]}.</h1>
            <p class="lead">Order ${o.id} is confirmed. We'll email you when it ships${delivery?.id === 'pickup' ? ' (or when it is ready to pick up)' : ''}.</p>
          </div>` : html`
          <h1>Order ${o.id}</h1>
          <p class="muted">Placed ${orderDate(o.date)} · ${orderStatus(o.status)}</p>`}
        <div class="card order-card">
          <ul class="sum-lines">${o.lines.map((l) => html`
            <li><span class="sum-art">${productArt(l, l.tint, { size: 48 })}<span class="sum-qty" aria-hidden="true">${l.qty}</span></span>
              <span class="sum-name"><span class="sr-only">${l.qty} × </span><a href=${`/shop/p/${l.slug}`}>${l.name}</a>${optionText(l) ? html`<span class="muted note">${optionText(l)}</span>` : null}</span>
              <span class="sum-price">${money(l.price * l.qty)}</span></li>`)}</ul>
          <dl class="sum">
            <div><dt>Subtotal</dt><dd>${money(o.subtotal)}</dd></div>
            <div><dt>Delivery (${delivery?.name ?? o.delivery})</dt><dd>${o.shipping ? money(o.shipping) : 'Free'}</dd></div>
            <div class="sum-total"><dt>Total</dt><dd>${money(o.total)}</dd></div>
          </dl>
          <dl class="shop-facts">
            <div><dt>Deliver to</dt><dd>${o.address.name}<br>${o.address.address}<br>${o.address.city} ${o.address.postcode}</dd></div>
            <div><dt>Delivery</dt><dd>${delivery?.name}<br><span class="muted">${delivery?.when}</span></dd></div>
            <div><dt>Paid with</dt><dd>${o.payment}<br><span class="muted">(a demo: nothing was charged)</span></dd></div>
          </dl>
        </div>
        <p class="row order-next"><a class="btn primary" href="/shop">Keep shopping</a><a class="btn ghost" href="/shop/account/orders">All your orders</a></p>`;
    },
  })}</section>`;
}
