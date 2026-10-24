import { html, computed, resource, fetchJSON, repeat, transition, untrack } from 'pith';
import { router } from '../router.js';
import { icon } from '../icons.js';
import { productCard, cardSkeleton } from '../shop/card.js';
import { FREE_OVER, money } from '../shop/pricing.js';

/** @typedef {import('../shop/card.js').Product} Product */

const SORTS = [['featured', 'Featured'], ['newest', 'Newest'], ['price-asc', 'Price, low to high'], ['price-desc', 'Price, high to low'], ['name', 'Name']];
/** @type {Record<string, (a: Product, b: Product) => number>} */
const COMPARE = {
  featured: (a, b) => a.rank - b.rank,
  newest: (a, b) => a.added - b.added,
  'price-asc': (a, b) => a.price - b.price || a.rank - b.rank,
  'price-desc': (a, b) => b.price - a.price || a.rank - b.rank,
  name: (a, b) => a.name.localeCompare(b.name),
};

// /shop: every product, filtered by category, searched and sorted, all kept in the URL (?category, ?q, ?sort), so
// a reload or a shared link shows the same grid. There are 24 products, so they load once and the filtering is
// done here: a filter is instant, and the cards that stay glide to their new places (class="motion" on the grid,
// the change wrapped in transition()). A shop with thousands would send ?q to the server instead.
// ?fail makes the API answer 500, to see the error view.
export default function ShopPage() {
  const query = () => router.query.value;
  const fail = 'fail' in router.query.peek();
  const products = resource(({ signal }) => fetchJSON(fail ? '/api/shop?fail' : '/api/shop', { signal }));

  const category = computed(() => query().category ?? '');
  const sort = computed(() => (COMPARE[query().sort] ? query().sort : 'featured'));
  const q = computed(() => query().q ?? '');
  const needle = computed(() => q.value.trim().toLowerCase());
  const filtering = computed(() => !!(category.value || needle.value));

  // Category and sort animate; typing in the search box changes the grid at once (no animation per key).
  const set = (/** @type {Record<string, string | null>} */ change) => transition(() => router.setQuery(change));
  const clear = () => set({ category: null, q: null });

  const grid = products.live({
    loading: () => html`<ul class="product-grid" aria-busy="true">${Array.from({ length: 8 }, cardSkeleton)}</ul>
      <p class="sr-only" role="status">Loading the shop…</p>`,
    error: (err, retry) => html`<div class="load-error shop-error" role="alert">
      <p><strong>Couldn't load the shop.</strong> ${err?.message ?? ''}</p>
      <button class="btn" type="button" @click=${retry}>${icon('refresh')} Try again</button></div>`,
    ready: (/** @type {{ value: { products: Product[], categories: { id: string, name: string, count: number }[] } }} */ data) => {
      const all = computed(() => data.value.products);
      const cats = computed(() => data.value.categories);
      const shown = computed(() => {
        const n = needle.value;
        return all.value
          .filter((p) => (!category.value || p.category === category.value) && (!n || p.name.toLowerCase().includes(n) || p.category.includes(n)))
          .toSorted(COMPARE[sort.value]);
      });
      const catName = () => cats.value.find((c) => c.id === category.value)?.name ?? '';
      const summary = () => {
        const n = shown.value.length;
        const what = `${n} ${n === 1 ? 'product' : 'products'}`;
        if (needle.value) return `${what} matching “${q.value.trim()}”${category.value ? ` in ${catName()}` : ''}`;
        return category.value ? `${what} in ${catName()}` : what;
      };
      const pressed = (/** @type {string} */ id) => () => String(category.value === id);

      return html`
        <div class="shop-tools">
          <div class="segmented shop-cats" role="group" aria-label="Category">
            <button type="button" aria-pressed=${pressed('')} @click=${() => set({ category: null })}>All</button>
            ${() => cats.value.map((c) => untrack(() => html`<button type="button" aria-pressed=${pressed(c.id)} @click=${() => set({ category: c.id })}>${c.name}</button>`))}
          </div>
          <div class="search-field shop-search">
            ${icon('search')}
            <label class="sr-only" for="shop-search">Search the shop</label>
            <input id="shop-search" class="input" type="search" placeholder="Search" autocomplete="off"
              .value=${q} @input=${(/** @type {Event} */ e) => router.setQuery({ q: /** @type {HTMLInputElement} */ (e.target).value || null })}>
          </div>
          <div class="shop-sort">
            <label class="muted note" for="shop-sort">Sort</label>
            <select id="shop-sort" class="input" @change=${(/** @type {Event} */ e) => {
              const v = /** @type {HTMLSelectElement} */ (e.target).value;
              set({ sort: v === 'featured' ? null : v });
            }}>
              ${SORTS.map(([v, label]) => html`<option value=${v} ?selected=${() => sort.value === v}>${label}</option>`)}
            </select>
          </div>
        </div>
        <p class="shop-count muted" aria-live="polite">${summary}</p>
        ${() => (shown.value.length ? null : untrack(() => html`
          <div class="shop-empty">
            <span class="icon-tile">${icon('search')}</span>
            <h2>Nothing matches “${q.value.trim()}”${category.value ? html` in ${catName()}` : ''}</h2>
            <p class="muted">Try another word, or look through everything.</p>
            <button class="btn primary" type="button" @click=${clear}>Clear filters</button>
          </div>`))}
        <ul class="product-grid motion" aria-label="Products">${repeat(shown, (p) => p.slug, (p) => productCard(p))}</ul>`;
    },
  });

  return html`
    <section class="shop-hero" aria-labelledby="shop-title">
      <p class="eyebrow">Fern &amp; Field</p>
      <h1 id="shop-title">Good things for home and garden.</h1>
      <p class="lead">Small batches from our studio in Portland, made to be used every day. Free standard delivery over ${money(FREE_OVER)}.</p>
    </section>
    ${() => (query().cart === 'empty'
      ? html`<p class="notice shop-notice" role="status">Your cart is empty, so there's nothing to check out yet.
          <button class="btn ghost small-btn" type="button" @click=${() => router.setQuery({ cart: null })}>Dismiss</button></p>`
      : null)}
    <div class="shop-catalog">${grid}</div>
  `;
}
