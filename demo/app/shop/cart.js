import { html, computed } from 'pith';
import { cart } from '../store.js';
import { toast } from '../ui.js';
import { totals, MAX_QTY } from './pricing.js';

/** @typedef {import('../store.js').CartLine} CartLine */

// The cart's numbers, for the header's count, the drawer and the checkout summary.
export const cartTotals = computed(() => totals(cart.lines.value));
export const cartCount = computed(() => cartTotals.value.items);

/** A line is one product in one colour and size. */
const keyOf = (/** @type {string} */ slug, /** @type {string | null} */ colour, /** @type {string | null} */ size) => [slug, colour ?? '', size ?? ''].join('|');

/**
 * Add a product to the cart (or more of it, up to MAX_QTY). Returns how many are in the cart now.
 * @param {{ slug: string, name: string, price: number, art: string, tint: string }} p
 * @param {{ colour: string | null, size: string | null, qty: number }} choice
 */
export function addToCart(p, { colour, size, qty }) {
  const key = keyOf(p.slug, colour, size);
  const lines = cart.lines.value;
  const same = lines.find((l) => l.key === key);
  const next = Math.min(MAX_QTY, (same?.qty ?? 0) + qty);
  cart.lines.value = same
    ? lines.map((l) => (l.key === key ? { ...l, qty: next } : l))
    : [...lines, { key, slug: p.slug, name: p.name, price: p.price, art: p.art, tint: p.tint, colour, size, qty: next }];
  return next;
}

/** @param {string} key @param {number} qty 1 to MAX_QTY */
export function setQty(key, qty) {
  const n = Math.max(1, Math.min(MAX_QTY, qty));
  cart.lines.value = cart.lines.value.map((l) => (l.key === key ? { ...l, qty: n } : l));
}

/**
 * Take a line out at once, with Undo in a toast that puts it back where it was.
 * @param {CartLine} line
 * @param {(fn: () => void) => void} [change] runs each change (e.g. inside transition(), so it animates)
 */
export function removeLine(line, change = (fn) => fn()) {
  const at = cart.lines.value.findIndex((l) => l.key === line.key);
  if (at < 0) return;
  change(() => (cart.lines.value = cart.lines.value.filter((l) => l.key !== line.key)));
  const undo = () => {
    dismiss();
    if (cart.lines.value.some((l) => l.key === line.key)) return;
    const lines = [...cart.lines.value];
    lines.splice(Math.min(at, lines.length), 0, line);
    change(() => (cart.lines.value = lines));
  };
  const dismiss = toast(html`Removed ${line.name}
    <button class="toast-undo" type="button" @click=${undo}>Undo</button>`, { timeout: 8000 });
}

/** "Sage · Large", or '' for a product without options. @param {{ colour: string | null, size: string | null }} l @param {{ id: string, name: string }[]} [colours] */
export function optionText(l, colours) {
  const colour = l.colour ? (colours?.find((c) => c.id === l.colour)?.name ?? l.colour.charAt(0).toUpperCase() + l.colour.slice(1)) : '';
  return [colour, l.size].filter(Boolean).join(' · ');
}
