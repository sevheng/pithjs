// Times, days, sizes and people for the chat (app/layouts/chat.js, app/pages/chat-room.js).

export const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** "Today", "Yesterday", or "Mon, 21 Oct" */
export function day(iso) {
  const d = new Date(iso);
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

export const size = (bytes) => (bytes < 1_000_000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`);

export const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// The calendar day of a time, as a number, cheap enough to compare for 100,000 messages.
const OFFSET = new Date().getTimezoneOffset() * 60_000;
export const dayKey = (iso) => Math.floor((Date.parse(iso) - OFFSET) / 86_400_000);

/**
 * For each message (once, kept in a WeakMap): does it start a new day, and does it start a run of messages
 * by one sender (within 5 minutes)? Then the day line, avatar and name show only there.
 * @param {any[]} messages
 * @param {WeakMap<object, { newDay: boolean, head: boolean }>} meta
 */
export function annotate(messages, meta) {
  let prev = null;
  for (const m of messages) {
    if (!meta.has(m)) {
      const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
      const head = newDay || !!m.replyTo || prev.author !== m.author || Date.parse(m.at) - Date.parse(prev.at) >= 5 * 60_000;
      meta.set(m, { newDay, head });
    }
    prev = m;
  }
}

// Text with web addresses turned into links. Only http(s): user text never becomes another kind of URL.
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/;
export const linkParts = (text) => text.split(URL_RE).map((piece, i) => (i % 2 ? { href: piece } : { text: piece }));
