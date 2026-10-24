// The storefront of "Fern & Field", the made-up shop whose back office is the Dashboard (api/dashboard.mjs):
// the same name, and its ten products are the first ten here, at the same prices.
// GET  /api/shop                → { products, categories } every product (24: the page filters and sorts them itself)
//      /api/shop?fail answers 500, so the error view (with Try again) can be seen.
// GET  /api/shop?slug=ceramic-mug → { product, related } (404 for an unknown slug)
// GET  /api/shop?view=orders    → { orders } the demo account's orders, newest first
// GET  /api/shop?order=FF-1041  → the order (404 if there's none)
// POST /api/shop { action: 'address', name, email, address, city, postcode, country } → { ok }, or 422 { errors }
//      (the postcode 00000 is refused: "we don't deliver there")
// POST /api/shop { action: 'sign-in', email, password } → { name, email }, or 422 { errors }
// POST /api/shop { action: 'order', lines, address, delivery, payment } → the order, priced here (not by the browser).
//      A demo: no card is charged and none is kept. 4242 4242 4242 4242 pays; 4000 0000 0000 0002 is declined (402);
//      any other number is refused (422).
// Dev-only demo data, kept in memory (orders placed stay while the dev server runs).
import { PRODUCTS as BACK_OFFICE } from './dashboard.mjs';
import { DELIVERY, MAX_QTY, totals } from '../app/shop/pricing.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const CATEGORIES = [
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'home', name: 'Home' },
  { id: 'garden', name: 'Garden' },
  { id: 'desk', name: 'Desk' },
];
// Product colours: the id is also the drawing's colour (--swatch-<id> in styles/main.css).
const COLOURS = {
  sage: 'Sage', sand: 'Sand', clay: 'Clay', charcoal: 'Charcoal', oat: 'Oat', moss: 'Moss', ink: 'Ink', honey: 'Honey', natural: 'Natural',
};

const price = (name) => BACK_OFFICE.find(([n]) => n === name)?.[1];
const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// [name, category, price, art, colours, sizes, extra]. Names are sentence case without punctuation, so the
// route's title can be made from the slug alone (see app/router.js).
const RAW = [
  ['Ceramic mug', 'kitchen', price('Ceramic mug'), 'mug', ['sage', 'sand', 'charcoal'], null, { badge: 'Bestseller',
    blurb: 'A wide, heavy mug thrown in stoneware and glazed inside and out. Holds a generous 12 oz and keeps its warmth.',
    details: ['Stoneware, food-safe glaze', '12 oz (350 ml)', 'Dishwasher and microwave safe'] }],
  ['Olive wood board', 'kitchen', price('Olive wood board'), 'board', ['natural'], ['Small', 'Large'], {
    blurb: 'Cut from the branches of old olive trees, so no two grains are alike. For bread, cheese, or just for the table.',
    details: ['Solid olive wood, oiled', 'Small 30 × 15 cm, large 40 × 20 cm', 'Hand wash, oil now and then'] }],
  ['Cotton apron', 'kitchen', price('Cotton apron'), 'apron', ['natural', 'clay', 'ink'], null, {
    blurb: 'A full apron in heavy cotton canvas with a deep front pocket and long ties that wrap around to the front.',
    details: ['100% cotton canvas', 'One size, adjustable neck strap', 'Machine wash at 40°'] }],
  ['Tea sampler', 'kitchen', price('Tea sampler'), 'tin', ['honey'], null, {
    blurb: 'Six loose-leaf teas from small gardens, from a smoky black to a soft green, in a tin you will keep.',
    details: ['6 × 25 g loose leaf', 'Steeping notes on each pouch', 'Tin 10 cm tall'] }],
  ['Linen napkins', 'kitchen', 28, 'cloth', ['oat', 'sage', 'clay'], null, {
    blurb: 'A set of four stonewashed linen napkins that get softer with every wash. Made to be used, not saved for best.',
    details: ['Set of 4, 45 × 45 cm', '100% European linen', 'Machine wash, no need to iron'] }],
  ['Stoneware bowl', 'kitchen', 26, 'bowl', ['sand', 'charcoal'], null, { badge: 'New',
    blurb: 'A deep bowl for soup, noodles or salad, in the same clay and glaze as our mugs.',
    details: ['Stoneware, food-safe glaze', '16 cm across, 750 ml', 'Dishwasher and microwave safe'] }],
  ['Wool throw', 'home', price('Wool throw'), 'throw', ['oat', 'moss', 'ink'], null, { badge: 'Bestseller',
    blurb: 'Woven on a slow loom from lambswool, with a soft brushed face and fringed ends. Big enough for two.',
    details: ['100% lambswool', '130 × 180 cm', 'Dry clean or cold hand wash'] }],
  ['Beeswax candle', 'home', price('Beeswax candle'), 'candle', ['honey'], ['Small', 'Tall'], {
    blurb: 'Poured from pure beeswax with a cotton wick. Burns clean and slow, with a faint smell of honey.',
    details: ['Pure beeswax, cotton wick', 'Small burns 20 hours, tall 45 hours', 'Trim the wick before lighting'] }],
  ['Brass bookends', 'home', price('Brass bookends'), 'bookends', ['honey'], null, {
    blurb: 'A pair of solid brass bookends, heavy enough for a full shelf, that darken to a warm patina.',
    details: ['Solid brass, a pair', '12 cm tall, 1.1 kg each', 'Felt base, won’t scratch'] }],
  ['Linen tote', 'home', price('Linen tote'), 'tote', ['natural', 'ink', 'sage'], null, {
    blurb: 'A roomy tote in washed linen with long handles and an inside pocket for keys.',
    details: ['100% linen', '40 × 42 cm, 60 cm handles', 'Machine wash cold'] }],
  ['Linen cushion', 'home', 42, 'cushion', ['oat', 'clay', 'sage'], null, { badge: 'New',
    blurb: 'A plump cushion in the same linen as our napkins, with a feather insert and a hidden zip.',
    details: ['Linen cover, feather insert', '50 × 50 cm', 'Cover machine washable'] }],
  ['Glass vase', 'home', 36, 'vase', ['sage'], ['Short', 'Tall'], {
    blurb: 'Mouth-blown recycled glass with a faint green tint and tiny bubbles. Each one is a little different.',
    details: ['Recycled glass', 'Short 15 cm, tall 25 cm', 'Hand wash'] }],
  ['Woven basket', 'home', 54, 'basket', ['natural'], ['Small', 'Medium', 'Large'], { soldOut: true,
    blurb: 'Hand-woven seagrass with leather handles, for blankets, logs or laundry.',
    details: ['Seagrass and leather', 'Small 30 cm, medium 38 cm, large 46 cm across', 'Wipe clean'] }],
  ['Terracotta pot', 'garden', price('Terracotta pot'), 'pot', ['clay'], ['Small', 'Medium', 'Large'], {
    blurb: 'Classic unglazed terracotta that breathes, with a matching saucer. Frost resistant.',
    details: ['Frost-resistant terracotta', 'Small 12 cm, medium 18 cm, large 24 cm', 'Saucer included'] }],
  ['Watering can', 'garden', 48, 'can', ['moss', 'charcoal'], null, {
    blurb: 'A powder-coated steel can with a long spout and a brass rose, for a fine shower on seedlings.',
    details: ['Powder-coated steel, brass rose', '4.5 litres', 'Rust resistant'] }],
  ['Seed collection', 'garden', 14, 'packet', ['moss'], null, { badge: 'New',
    blurb: 'Eight easy herbs and flowers for a windowsill or a small bed, with sowing notes for each.',
    details: ['8 packets of seeds', 'Basil, chives, dill, parsley, thyme, nasturtium, calendula, sweet pea', 'Sow by the date on the back'] }],
  ['Pruning snips', 'garden', 39, 'snips', ['charcoal'], null, {
    blurb: 'Light, sharp snips for herbs, flowers and small stems, with a spring and a safety catch.',
    details: ['Carbon steel blades', '18 cm long', 'Wipe dry after use'] }],
  ['Herb planter', 'garden', 58, 'planter', ['clay'], null, {
    blurb: 'A long glazed planter that fits a windowsill, with drainage holes and a tray.',
    details: ['Glazed stoneware', '45 × 15 cm', 'Tray included'] }],
  ['Garden gloves', 'garden', 22, 'gloves', ['sage', 'clay'], ['S', 'M', 'L'], {
    blurb: 'Soft goatskin gloves that keep thorns out and still let you feel what you are doing.',
    details: ['Goatskin leather, cotton cuff', 'Sizes S, M and L', 'Let them dry naturally'] }],
  ['Notebook set', 'desk', price('Notebook set'), 'notebook', ['sage', 'clay', 'ink'], null, {
    blurb: 'Three A5 notebooks with lay-flat binding and thick paper that takes fountain pen ink.',
    details: ['Set of 3, A5', '96 pages, 100 gsm, dotted', 'Recycled card covers'] }],
  ['Pencil set', 'desk', 12, 'pencils', ['ink'], null, {
    blurb: 'Six cedar pencils from soft to hard, with a brass sharpener in a cloth roll.',
    details: ['6 pencils, 4H to 4B', 'Brass sharpener', 'Cotton roll'] }],
  ['Desk calendar', 'desk', 20, 'calendar', ['sand'], null, { badge: 'New',
    blurb: 'A month to a page on heavy card, on a wooden stand. Starts in January, ends in December.',
    details: ['12 cards, 15 × 10 cm', 'Oak stand', 'Printed on recycled card'] }],
  ['Recipe cards', 'desk', 15, 'cards', ['honey'], null, {
    blurb: 'Fifty blank recipe cards with ruled backs, in a box that stands up on the counter.',
    details: ['50 cards, 15 × 10 cm', 'Box with dividers', 'Recycled card'] }],
  ['Postcard set', 'desk', 10, 'cards', ['sage'], null, {
    blurb: 'Twelve postcards of the garden through the year, printed on uncoated card.',
    details: ['12 postcards', 'A6, uncoated card', 'Envelopes not included'] }],
];

/** Every product, in the shop's "featured" order (index = rank). */
export const products = RAW.map(([name, category, cost, art, colours, sizes, extra], i) => ({
  slug: slugOf(name),
  name,
  category,
  price: cost,
  art,
  colours: colours.map((id) => ({ id, name: COLOURS[id] })),
  sizes: sizes ?? [],
  badge: extra.badge ?? null,
  soldOut: extra.soldOut ?? false,
  blurb: extra.blurb,
  details: extra.details,
  rank: i,
  added: (i * 7) % RAW.length, // a made-up "newest first" order
}));
const bySlug = new Map(products.map((p) => [p.slug, p]));

/** What a grid card needs (no blurb or details). */
const summary = ({ blurb, details, ...p }) => p;

// ---------- The demo account and its orders ----------
const ADDRESS = { name: 'Ann Adams', address: '12 Alder Street', city: 'Portland, OR', postcode: '97214', country: 'US' };
const line = (slug, qty, colour = null, size = null) => {
  const p = bySlug.get(slug);
  return { slug, name: p.name, price: p.price, qty, colour, size, art: p.art, tint: colour ?? p.colours[0].id };
};
let nextOrder = 1040;
const makeOrder = (date, status, lines, delivery = 'standard', address = ADDRESS) => {
  const t = totals(lines, delivery);
  return { id: `FF-${++nextOrder}`, date, status, lines, address, delivery, payment: 'Test card ending 4242',
    subtotal: t.subtotal, shipping: t.shipping, total: t.total };
};
// Fixed dates, so screenshots and tests see the same list.
export const orders = [
  makeOrder('2026-08-14', 'delivered', [line('wool-throw', 1, 'moss'), line('beeswax-candle', 2, null, 'Tall')]),
  makeOrder('2026-09-22', 'delivered', [line('ceramic-mug', 2, 'sage'), line('tea-sampler', 1)]),
  makeOrder('2026-10-19', 'shipped', [line('terracotta-pot', 3, null, 'Medium'), line('seed-collection', 1)], 'express'),
].reverse(); // newest first

const COUNTRIES = ['US', 'CA', 'GB', 'AU'];

/** The address fields' errors (empty when fine). */
function addressErrors(a = {}) {
  const errors = {};
  if (!String(a.name ?? '').trim()) errors.name = 'Enter the name to deliver to';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.email ?? ''))) errors.email = 'Enter an email address for the receipt';
  if (!String(a.address ?? '').trim()) errors.address = 'Enter a street address';
  if (!String(a.city ?? '').trim()) errors.city = 'Enter a town or city';
  const postcode = String(a.postcode ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/.test(postcode)) errors.postcode = 'Enter a postcode';
  else if (postcode === '00000') errors.postcode = "We can't deliver to 00000. Check the postcode, or try another address.";
  if (!COUNTRIES.includes(a.country)) errors.country = 'Pick a country we deliver to';
  return errors;
}

export async function GET({ query }) {
  await delay(query.slug || query.order ? 200 : 300);
  if ('fail' in query) return Response.json({ message: 'The shop is not answering (500).' }, { status: 500 });
  if (query.slug) {
    const p = bySlug.get(query.slug);
    if (!p) return Response.json({ message: `There's no product called "${query.slug}".` }, { status: 404 });
    const related = products.filter((x) => x.category === p.category && x.slug !== p.slug).slice(0, 4).map(summary);
    return { product: p, related };
  }
  if (query.order) {
    const o = orders.find((x) => x.id === query.order);
    return o ?? Response.json({ message: `There's no order ${query.order}.` }, { status: 404 });
  }
  if (query.view === 'orders') return { orders };
  return {
    products: products.map(summary),
    categories: CATEGORIES.map((c) => ({ ...c, count: products.filter((p) => p.category === c.id).length })),
  };
}

export async function POST({ body }) {
  await delay(400);
  const action = body?.action;
  if (action === 'address') {
    const errors = addressErrors(body);
    return Object.keys(errors).length ? Response.json({ errors }, { status: 422 }) : { ok: true };
  }
  if (action === 'sign-in') {
    const email = String(body.email ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ errors: { email: 'Enter your email address' } }, { status: 422 });
    if (String(body.password ?? '').length < 6) return Response.json({ errors: { password: 'At least 6 characters' } }, { status: 422 });
    const first = email.split('@')[0].split(/[._-]/)[0];
    return { name: first.charAt(0).toUpperCase() + first.slice(1), email };
  }
  if (action !== 'order') return Response.json({ message: `Unknown action "${action}"` }, { status: 400 });

  // The order: priced from the catalogue, never from what the browser says things cost.
  const errors = addressErrors(body.address);
  if (Object.keys(errors).length) return Response.json({ message: 'The delivery address is incomplete. Go back to Shipping.', errors }, { status: 422 });
  if (!DELIVERY.some((d) => d.id === body.delivery)) return Response.json({ message: 'Pick a delivery option.' }, { status: 422 });
  const lines = [];
  for (const l of Array.isArray(body.lines) ? body.lines : []) {
    const p = bySlug.get(l.slug);
    const qty = Number(l.qty);
    if (!p) return Response.json({ message: `"${l.slug}" isn't sold here any more. Remove it from your cart.` }, { status: 422 });
    if (p.soldOut) return Response.json({ message: `${p.name} just sold out. Remove it from your cart.` }, { status: 422 });
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return Response.json({ message: `${p.name}: between 1 and ${MAX_QTY}.` }, { status: 422 });
    const colour = p.colours.length > 1 ? (p.colours.find((c) => c.id === l.colour)?.id ?? null) : null;
    const size = p.sizes.length ? (p.sizes.includes(l.size) ? l.size : null) : null;
    if (p.colours.length > 1 && !colour) return Response.json({ message: `${p.name}: pick a colour.` }, { status: 422 });
    if (p.sizes.length && !size) return Response.json({ message: `${p.name}: pick a size.` }, { status: 422 });
    lines.push({ slug: p.slug, name: p.name, price: p.price, qty, colour, size, art: p.art, tint: colour ?? p.colours[0].id });
  }
  if (!lines.length) return Response.json({ message: 'Your cart is empty.' }, { status: 422 });

  const pay = body.payment ?? {};
  const payErrors = {};
  const card = String(pay.card ?? '').replace(/[\s-]/g, '');
  if (!String(pay.cardName ?? '').trim()) payErrors.cardName = 'Enter the name on the card';
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(String(pay.expiry ?? ''))) payErrors.expiry = 'Use MM/YY';
  if (!/^\d{3}$/.test(String(pay.cvc ?? ''))) payErrors.cvc = '3 digits';
  if (card !== '4242424242424242' && card !== '4000000000000002') payErrors.card = 'This demo takes test numbers only: use 4242 4242 4242 4242';
  if (Object.keys(payErrors).length) return Response.json({ errors: payErrors }, { status: 422 });
  if (card === '4000000000000002') {
    return Response.json({ message: 'Your card was declined. Nothing was charged. (That is the test number for a decline: use 4242 4242 4242 4242 to pay.)' }, { status: 402 });
  }
  const { email, ...address } = body.address;
  const order = makeOrder(new Date().toISOString().slice(0, 10), 'processing', lines, body.delivery, address);
  orders.unshift(order);
  return order;
}
