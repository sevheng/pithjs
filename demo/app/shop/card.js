import { html } from 'pith';
import { productArt } from './art.js';
import { money } from './pricing.js';

/** @typedef {{ slug: string, name: string, category: string, price: number, art: string, colours: { id: string, name: string }[],
 *   sizes: string[], badge: string | null, soldOut: boolean, rank: number, added: number }} Product */

/**
 * A product in the grid (and under "You may also like"): the whole card is its link.
 * @param {Product} p
 * @param {{ heading?: 'h2' | 'h3' }} [options]
 */
export function productCard(p, { heading = 'h2' } = {}) {
  const name = html`<a class="stretched" href=${`/shop/p/${p.slug}`}>${p.name}</a>`;
  return html`
    <li class="product-card lift">
      <div class="product-art">${productArt(p, p.colours[0].id, { size: 280 })}
        ${p.soldOut ? html`<span class="badge soft product-badge">Sold out</span>` : p.badge ? html`<span class="badge product-badge">${p.badge}</span>` : null}</div>
      <div class="product-text">
        ${heading === 'h2' ? html`<h2>${name}</h2>` : html`<h3>${name}</h3>`}
        <p class="product-price">${money(p.price)}</p>
        ${p.colours.length > 1 ? html`<p class="swatches"><span class="swatch-dots" aria-hidden="true">
          ${p.colours.map((c) => html`<span class="swatch" style=${`--c: var(--swatch-${c.id})`}></span>`)}</span>
          <span class="muted note">${p.colours.length} colours</span></p>` : null}
      </div>
    </li>`;
}

/** The same card's shape while loading, so nothing moves when the products arrive. */
export const cardSkeleton = () => html`
  <li class="product-card skeleton-card" aria-hidden="true"><div class="product-art shop-skel"></div>
    <div class="product-text"><span class="shop-skel line"></span><span class="shop-skel line short"></span></div></li>`;
