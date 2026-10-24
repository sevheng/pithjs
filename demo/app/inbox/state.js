import { html, signal, form, rules, fetchJSON } from 'pith';
import { dialog, toast } from '../ui.js';
import { icon } from '../icons.js';

// Shared by the inbox layout (folders and their counts) and the folder page (the list and the preview).

/** @type {{ id: string, name: string, icon: string }[]} */
export const FOLDERS = [
  { id: 'inbox', name: 'Inbox', icon: 'inbox' },
  { id: 'starred', name: 'Starred', icon: 'star' },
  { id: 'sent', name: 'Sent', icon: 'send' },
  { id: 'archive', name: 'Archive', icon: 'archive' },
  { id: 'trash', name: 'Trash', icon: 'trash' },
];

// Bumped after anything that changes the counts (reading, starring, moving, sending): the layout refetches them.
export const countsVersion = signal(0);
// Bumped after sending: the Sent folder's list loads again, so the new message shows at the top.
export const sentVersion = signal(0);

/** "14:05" today, "Oct 21" this year, else "Oct 21, 2025". */
export function when(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], d.getFullYear() === now.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The full date and time, for the preview. */
export const fullDate = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const initials = (name) => name.split(/[\s.@]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// A stable color per sender, from a few that keep white initials readable (4.5:1) in both themes.
const COLORS = ['#1f5fd6', '#8e44ad', '#c0392b', '#127a63', '#b34700', '#2c3e50', '#a3195b'];
export const colorOf = (email) => COLORS[[...email].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];

const emails = (v) => {
  const list = String(v).split(',').map((s) => s.trim()).filter(Boolean);
  const bad = list.find((a) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
  return bad ? `"${bad}" isn't an email address` : null;
};

/**
 * The New message dialog. Resolves with the sent message, or undefined if it was closed.
 * @param {{ to?: string, subject?: string, body?: string }} [start] e.g. a reply
 */
export async function compose(start = {}) {
  /** @type {{ to: { email: string }[] } | undefined} */
  const sent = await dialog((close) => {
    const f = form({
      initial: { to: start.to ?? '', subject: start.subject ?? '', body: start.body ?? '' },
      validate: {
        to: [rules.required('Add at least one address'), emails],
        subject: [rules.required('Add a subject'), rules.maxLength(200)],
        body: rules.required('Write a message'),
      },
      // A 422 { errors } (e.g. an address at @blocked.test) shows under its field.
      onSubmit: async (values) => close(await fetchJSON('/api/inbox', { json: { action: 'send', ...values } })),
    });
    return html`
      <h2 class="compose-title">${start.subject ? 'Reply' : 'New message'}</h2>
      <form class="form compose" novalidate @submit=${f.submit}>
        ${f.input('to', { label: 'To', type: 'email', autocomplete: 'email', hint: 'Separate addresses with commas' })}
        ${f.input('subject', { label: 'Subject' })}
        ${f.textarea('body', { label: 'Message', rows: 7 })}
        ${() => (f.submitError.value ? html`<p class="form-error" role="alert">${f.submitError.value.message}</p>` : null)}
        <div class="pith-dialog-actions">
          <button class="btn" type="button" @click=${() => close()}>Cancel</button>
          <button class="btn primary" type="submit" ?disabled=${f.submitting}>
            ${() => (f.submitting.value ? 'Sending…' : html`${icon('send')} Send message`)}</button>
        </div>
      </form>`;
  });
  if (!sent) return undefined;
  toast(`Sent to ${sent.to.map((p) => p.email).join(', ')}`, { type: 'success' });
  countsVersion.value += 1;
  sentVersion.value += 1;
  return sent;
}
