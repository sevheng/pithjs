// The URLs of :param routes to prerender at build time (npm run build). Runs in Node, like api/*.mjs.
// Each page bakes in the data api/ returned during the build.
import { docs } from './app/docs/index.js';
import { rooms } from './api/chat.mjs';
import { folders } from './api/inbox.mjs'; // Inbox (/inbox)
import { products, orders } from './api/shop.mjs'; // Shop (/shop)

// Every docs page (/docs itself is a plain route, prerendered anyway).
const docPages = docs.filter((d) => d.name !== 'introduction').map((d) => `/docs/${d.name}`);

export default async function paths() {
  // Not #firehose: its thousands of messages would be baked into the page.
  return [...rooms.filter((r) => !r.huge).map((r) => `/chat/${r.id}`), ...docPages,
    ...folders.map((f) => `/inbox/${f}`), // Inbox (/inbox)
    '/trade/NWX', // Trading (/trade): one symbol, so every check also runs on it
    // ---------- Shop (/shop) ---------- every product page, so each is HTML on the first load (and found by search
    // engines); and one order, so every check also runs on the order page.
    ...products.map((p) => `/shop/p/${p.slug}`), `/shop/order/${orders.at(-1).id}`,
    // ---------- end Shop ----------
  ];
}
