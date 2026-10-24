// How an order's status and date read, on the order page and in the account's list.

/** @typedef {{ id: string, date: string, status: 'processing' | 'shipped' | 'delivered', lines: import('../store.js').CartLine[],
 *   address: { name: string, address: string, city: string, postcode: string, country: string }, delivery: string, payment: string,
 *   subtotal: number, shipping: number, total: number }} Order */

const STATUS = { processing: 'Being packed', shipped: 'On its way', delivered: 'Delivered' };
/** @param {Order['status']} s */
export const orderStatus = (s) => STATUS[s] ?? s;
/** "Oct 19, 2026", from "2026-10-19" (read as a day, not a moment, so no time zone moves it). @param {string} iso */
export const orderDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
