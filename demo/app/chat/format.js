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

/**
 * Messages → days → runs by one sender (within 5 minutes), so the avatar and name show once per run.
 * @param {any[]} messages
 */
export function groupMessages(messages) {
  const days = [];
  for (const m of messages) {
    const label = day(m.at);
    let d = days.at(-1);
    if (!d || d.label !== label) days.push((d = { label, runs: [] }));
    const run = d.runs.at(-1);
    const last = run?.messages.at(-1);
    if (run && run.author === m.author && !m.replyTo && new Date(m.at).getTime() - new Date(last.at).getTime() < 5 * 60_000) run.messages.push(m);
    else d.runs.push({ author: m.author, messages: [m] });
  }
  return days;
}

// Text with web addresses turned into links. Only http(s): user text never becomes another kind of URL.
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/;
export const linkParts = (text) => text.split(URL_RE).map((piece, i) => (i % 2 ? { href: piece } : { text: piece }));
