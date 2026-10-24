import { html, signal, computed, resource, fetchJSON } from 'pith';
import { router } from '../router.js';
import { toast } from '../ui.js';
import { icon } from '../icons.js';
import { productArt } from '../shop/art.js';
import { productCard } from '../shop/card.js';
import { addToCart } from '../shop/cart.js';
import { openCart } from '../shop/cart-drawer.js';
import { money, FREE_OVER, MAX_QTY } from '../shop/pricing.js';

/** @typedef {import('../shop/card.js').Product & { blurb: string, details: string[] }} FullProduct */

const CATEGORY = { kitchen: 'Kitchen', home: 'Home', garden: 'Garden', desk: 'Desk' };
/** "ceramic-mug" → "Ceramic mug": names are sentence case, so the slug is enough for the heading while loading. */
const nameOf = (/** @type {string} */ slug) => slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');

// /shop/p/:slug, one product. Every product page is prerendered (prerender.mjs): it's HTML on the first load,
// with its data handed over, so the live page takes over without a "Loading…" in between. The colour is in the
// URL (?colour=), so a link to the clay apron shows the clay apron.
/** @param {{ slug: string }} params */
export default function ShopProductPage({ slug }) {
  const res = resource(({ signal: abort }) => fetchJSON(`/api/shop?slug=${encodeURIComponent(slug)}`, { signal: abort }));

  const skeleton = () => html`
    <div class="product">
      <div class="product-gallery"><div class="product-hero-art shop-skel"></div></div>
      <div class="product-info">
        <h1>${nameOf(slug)}</h1>
        <span class="shop-skel line short"></span><span class="shop-skel block"></span>
      </div>
    </div>
    <p class="sr-only" role="status">Loading ${nameOf(slug)}…</p>`;

  return html`${res.render({
    loading: skeleton,
    error: (err, retry) => (err?.status === 404
      ? html`<section class="shop-missing">
          <span class="icon-tile">${icon('search')}</span>
          <h1>No such product</h1>
          <p class="muted">There's nothing called “${slug}” in the shop. It may have sold out for good, or the link is wrong.</p>
          <a class="btn primary" href="/shop">Browse the shop</a></section>`
      : html`<h1 class="sr-only">${nameOf(slug)}</h1><div class="load-error" role="alert">
          <p><strong>Couldn't load this product.</strong> ${err?.message ?? ''}</p>
          <button class="btn" type="button" @click=${retry}>${icon('refresh')} Try again</button></div>`),
    ready: (/** @type {{ product: FullProduct, related: import('../shop/card.js').Product[] }} */ data) => view(data.product, data.related),
  })}`;
}

/** @param {FullProduct} p @param {import('../shop/card.js').Product[]} related */
function view(p, related) {
  const many = p.colours.length > 1;
  const colour = computed(() => p.colours.find((c) => c.id === router.query.value.colour) ?? p.colours[0]);
  const size = signal(p.sizes[0] ?? null);
  const qty = signal(1);

  const add = () => {
    const now = addToCart({ ...p, tint: colour.value.id }, { colour: many ? colour.value.id : null, size: size.value, qty: qty.value });
    const what = [many ? colour.value.name : '', size.value].filter(Boolean).join(', ');
    toast(html`Added ${p.name}${what ? ` (${what})` : ''}${now > qty.value ? `: ${now} in your cart` : ''}
      <button class="toast-undo" type="button" @click=${() => openCart()}>View cart</button>`, { type: 'success', timeout: 6000 });
    qty.value = 1;
  };

  const optionGroup = (/** @type {string} */ legend, /** @type {() => unknown} */ chosen, /** @type {unknown} */ body) => html`
    <fieldset class="option">
      <legend><span class="field-label">${legend}</span> <span class="muted">${chosen}</span></legend>
      ${body}
    </fieldset>`;

  return html`
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/shop">Shop</a><span aria-hidden="true">›</span>
      <a href=${`/shop?category=${p.category}`}>${CATEGORY[/** @type {keyof typeof CATEGORY} */ (p.category)]}</a><span aria-hidden="true">›</span>
      <span aria-current="page">${p.name}</span>
    </nav>
    <div class="product">
      <div class="product-gallery">
        <div class="product-hero-art">${() => productArt(p, colour.value.id, { size: 560 })}</div>
      </div>
      <div class="product-info">
        ${p.soldOut ? html`<span class="badge soft">Sold out</span>` : p.badge ? html`<span class="badge">${p.badge}</span>` : null}
        <h1>${p.name}</h1>
        <p class="product-page-price">${money(p.price)}</p>
        <p class="product-blurb">${p.blurb}</p>

        ${many ? optionGroup('Colour', () => colour.value.name, html`
          <div class="swatch-picker">${p.colours.map((c) => html`
            <label class="swatch-option" title=${c.name}>
              <input class="sr-only" type="radio" name="colour" value=${c.id} .checked=${() => colour.value.id === c.id}
                @change=${() => router.setQuery({ colour: c.id === p.colours[0].id ? null : c.id })}>
              <span class="swatch big" style=${`--c: var(--swatch-${c.id})`}></span><span class="sr-only">${c.name}</span>
            </label>`)}</div>`) : null}

        ${p.sizes.length ? optionGroup('Size', () => size.value, html`
          <div class="pill-picker">${p.sizes.map((s) => html`
            <label class="pill-option">
              <input class="sr-only" type="radio" name="size" value=${s} .checked=${() => size.value === s} @change=${() => (size.value = s)}>
              <span>${s}</span>
            </label>`)}</div>`) : null}

        <div class="buy-row">
          <div class="stepper big" role="group" aria-label="Quantity">
            <button class="icon-btn" type="button" aria-label="One fewer" ?disabled=${() => qty.value <= 1 || p.soldOut} @click=${() => qty.value--}>${icon('minus')}</button>
            <span class="stepper-value" aria-live="polite">${qty}</span>
            <button class="icon-btn" type="button" aria-label="One more" ?disabled=${() => qty.value >= MAX_QTY || p.soldOut} @click=${() => qty.value++}>${icon('plus')}</button>
          </div>
          <button class="btn primary big add-btn" type="button" ?disabled=${p.soldOut} @click=${add}>
            ${p.soldOut ? 'Sold out' : html`${icon('bag')} Add to cart`}</button>
        </div>
        ${p.soldOut ? html`<p class="muted note">More are being made. Check back in a few weeks.</p>` : null}
        <p class="delivery-note">${icon('truck')}<span>Free standard delivery over ${money(FREE_OVER)}. In stock, ships in 1–2 working days.</span></p>

        <h2 class="product-sub">Details</h2>
        <ul class="check-list">${p.details.map((d) => html`<li>${icon('check')}<span>${d}</span></li>`)}</ul>
      </div>
    </div>

    ${related.length ? html`
      <section class="related" aria-labelledby="related-title">
        <h2 id="related-title">You may also like</h2>
        <ul class="product-grid">${related.map((r) => productCard(r, { heading: 'h3' }))}</ul>
      </section>` : null}`;
}

