// The Shop's prices and delivery options, and the totals they make. Plain functions with no imports, so the
// browser (the cart, the checkout summary) and the dev API (api/shop.mjs, which charges the order) compute the
// same numbers from the same rules.

export const FREE_OVER = 75; // standard delivery is free from this subtotal (the same rule as the Dashboard's orders)
export const MAX_QTY = 10; // of one item in one order

/** @typedef {{ id: string, name: string, when: string, price: number, freeOver?: number }} Delivery */
/** @type {Delivery[]} */
export const DELIVERY = [
  { id: 'standard', name: 'Standard', when: '3–5 working days', price: 6, freeOver: FREE_OVER },
  { id: 'express', name: 'Express', when: '1–2 working days', price: 14 },
  { id: 'pickup', name: 'Pick up at the studio', when: 'Portland, OR · ready the next day', price: 0 },
];

/** What a delivery option costs for this subtotal. @param {string} id @param {number} subtotal */
export function deliveryPrice(id, subtotal) {
  const d = DELIVERY.find((x) => x.id === id) ?? DELIVERY[0];
  return d.freeOver != null && subtotal >= d.freeOver ? 0 : d.price;
}

/**
 * The totals of a cart. Without a delivery choice yet, shipping is the standard price (an estimate).
 * @param {{ price: number, qty: number }[]} lines
 * @param {string | null} [delivery]
 */
export function totals(lines, delivery = null) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const shipping = lines.length ? deliveryPrice(delivery ?? 'standard', subtotal) : 0;
  return { subtotal, shipping, total: subtotal + shipping, items: lines.reduce((n, l) => n + l.qty, 0) };
}

/** "$24", or "$24.50" when there are cents. @param {number} n */
export const money = (n) => `$${Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
