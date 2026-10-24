import { html } from 'pith';
import { shopHeader } from '../shop/header.js';

// The frame of the shop's own pages (/shop, a product, an order): the shop header with the cart, above the page.
// The account and the checkout have layouts of their own, with the same header.
export default function ShopLayout(page) {
  return html`<div class="shop">${shopHeader()}${page}</div>`;
}
