// GET  /api/chat              → the rooms, with unread counts and the last message
// GET  /api/chat?room=general → { room, messages } (marks the room read); 404 for an unknown room
// POST /api/chat?room=general { text, replyTo? } → the new message. A text containing "/fail" answers 500,
//      so the "Failed · Retry" state can be tried. In #help a bot answers: its reply arrives with the next GET
//      (the page waits a moment first, showing "Pith bot is typing").
// Messages are made of typed parts (text, code, image, file, link) that the page renders as cards.
// Dev-only demo data, kept in memory.

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

export const people = {
  you: { name: 'You', color: '#1f5fd6' },
  ada: { name: 'Ada Lovelace', color: '#8e44ad' },
  grace: { name: 'Grace Hopper', color: '#c0392b' },
  linus: { name: 'Linus Park', color: '#16a085' },
  mia: { name: 'Mia Chen', color: '#d35400' },
  bot: { name: 'Pith bot', color: '#2c3e50' },
};

// A small illustration as an SVG data URL, so the demo has images without files or a CDN.
const picture = (from, to, label) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><circle cx="470" cy="120" r="60" fill="#fff" opacity=".25"/><path d="M0 300 L160 190 L280 270 L420 160 L640 300 V360 H0 Z" fill="#fff" opacity=".22"/><text x="40" y="320" font-family="sans-serif" font-size="28" fill="#fff">${label}</text></svg>`)}`;

let nextId = 100;
const msg = (author, minutes, parts, extra = {}) => ({ id: String(nextId++), author, at: minutesAgo(minutes), parts, reactions: [], ...extra });

export const rooms = [
  { id: 'general', name: 'general', topic: 'Anything about the project', unread: 3 },
  { id: 'design', name: 'design', topic: 'Screens, colors, and the new mark', unread: 1 },
  { id: 'help', name: 'help', topic: 'Ask the bot about Pith', unread: 0 },
  { id: 'random', name: 'random', topic: 'Off topic', unread: 0 },
];

const messages = {
  general: [
    msg('grace', 60 * 26, [{ type: 'text', text: 'Morning! The release checklist is in the wiki: https://example.com/wiki/release' }]),
    msg('linus', 60 * 26 - 3, [{ type: 'text', text: 'Thanks, starting on the changelog now.' }]),
    msg('ada', 42, [{ type: 'text', text: 'The list rendering got faster again. Here is the core of the change:' },
      { type: 'code', lang: 'js', code: "const isSelected = selector(selected);\nhtml`<tr class=${() => (isSelected(row.id) ? 'selected' : '')}>`" }],
      { reactions: [{ emoji: '🚀', count: 3, mine: false }, { emoji: '👀', count: 1, mine: false }] }),
    msg('ada', 41, [{ type: 'text', text: 'Selecting a row now re-runs 2 rows instead of all 1,000.' }]),
    msg('mia', 30, [{ type: 'link', url: 'https://example.com/blog/benchmarks', site: 'example.com', title: 'How we measured load speed on a slow phone',
      description: 'Slow 4G, 4x CPU slowdown, medians of 9 runs, in rotated order.' }]),
    msg('grace', 12, [{ type: 'text', text: 'Nice write-up. Can someone review the docs PR before lunch?' }]),
    msg('linus', 8, [{ type: 'text', text: 'On it.' }], { replyTo: { author: 'grace', text: 'Can someone review the docs PR before lunch?' } }),
    msg('linus', 7, [{ type: 'file', name: 'docs-review-notes.pdf', size: 248_000, kind: 'PDF' }]),
  ],
  design: [
    msg('mia', 95, [{ type: 'text', text: 'New mark, light and dark. The ring is the shell, the dot is the pith.' },
      { type: 'image', src: picture('#1f5fd6', '#8e44ad', 'Pith · mark exploration'), alt: 'A blue-to-purple gradient poster for the mark exploration', width: 640, height: 360 }],
      { reactions: [{ emoji: '😍', count: 2, mine: false }] }),
    msg('ada', 80, [{ type: 'text', text: 'Love it. Does it hold up at 16px in the tab?' }]),
    msg('mia', 78, [{ type: 'text', text: 'Yes, the dot stays 4px. Checked on a phone too.' }], { replyTo: { author: 'ada', text: 'Does it hold up at 16px in the tab?' } }),
    msg('mia', 20, [{ type: 'file', name: 'brand-colors.fig', size: 1_840_000, kind: 'Figma' }]),
  ],
  help: [
    msg('bot', 300, [{ type: 'text', text: 'Hi! Ask me anything about Pith. I answer in a moment, so you can see the typing indicator.' }]),
  ],
  random: [],
};

const BOT_ANSWERS = [
  [/form|valid/i, 'Use form(): it handles values, validation, accessible errors and errors from the server. See https://example.com/docs/forms'],
  [/list|repeat|row/i, 'Lists use repeat(items, key, row). For a selected row, selector() re-runs just 2 rows.'],
  [/fast|speed|size/i, 'The whole core is under 10 KB gzipped, and it loads faster than Vue and React in the benchmarks.'],
];

// Bot replies wait here until the room is fetched again, so they arrive after the typing indicator. (Not by time:
// the page decides how long the bot "types", so the server doesn't depend on the browser's clock.)
const pending = [];

export async function GET({ query }) {
  await delay(200);
  for (const p of pending.splice(0)) messages[p.room].push({ ...p.message, at: new Date().toISOString() });
  if (query.room == null) {
    return rooms.map((r) => {
      const last = messages[r.id].at(-1);
      return { ...r, last: last ? { ...last, authorName: people[last.author].name } : null };
    });
  }
  const room = rooms.find((r) => r.id === query.room);
  if (!room) return Response.json({ message: 'No such room' }, { status: 404 });
  room.unread = 0;
  return { room, messages: messages[room.id], people };
}

export async function POST({ query, body }) {
  await delay(350);
  const room = rooms.find((r) => r.id === query.room);
  if (!room) return Response.json({ message: 'No such room' }, { status: 404 });
  const text = String(body?.text ?? '').trim();
  if (!text) return Response.json({ message: 'A message needs some text' }, { status: 422 });
  if (text.includes('/fail')) return Response.json({ message: 'The server failed on purpose ("/fail")' }, { status: 500 });
  const message = { id: String(nextId++), author: 'you', at: new Date().toISOString(), parts: [{ type: 'text', text }], reactions: [] };
  if (body?.replyTo) message.replyTo = { author: body.replyTo.author, text: String(body.replyTo.text).slice(0, 140) };
  messages[room.id].push(message);
  if (room.id === 'help') {
    const answer = BOT_ANSWERS.find(([re]) => re.test(text))?.[1] ?? 'Good question! The README has the full API, and AGENTS.md has the rules.';
    pending.push({ room: room.id, message: { id: String(nextId++), author: 'bot', parts: [{ type: 'text', text: answer }], reactions: [] } });
  }
  return message;
}
