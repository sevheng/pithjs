// The URLs of :param routes to prerender at build time (npm run build). Runs in Node, like api/*.mjs.
// Each page bakes in the data api/ returned during the build.
import { docs } from './app/docs/index.js';
import { rooms } from './api/chat.mjs';
import { folders } from './api/inbox.mjs'; // Inbox (/inbox)

// Every docs page (/docs itself is a plain route, prerendered anyway).
const docPages = docs.filter((d) => d.name !== 'introduction').map((d) => `/docs/${d.name}`);

export default async function paths() {
  // Not #firehose: its thousands of messages would be baked into the page.
  return [...rooms.filter((r) => !r.huge).map((r) => `/chat/${r.id}`), ...docPages,
    ...folders.map((f) => `/inbox/${f}`)]; // Inbox (/inbox)
}
