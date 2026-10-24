import { html, signal, computed, resource, fetchJSON, effect, onCleanup, repeat, selector, untrack } from 'pith';
import { router } from '../router.js';
import { toast } from '../ui.js';
import { icon } from '../icons.js';
import { roomsVersion } from '../chat/state.js';
import { time, day, size, initials, annotate, linkParts } from '../chat/format.js';

const EMOJIS = ['👍', '🎉', '🚀', '😍', '👀', '🙏'];
const FIRST_SCREEN = 200; // messages put on screen when a room opens; "Show older" adds OLDER_STEP more
const OLDER_STEP = 500;
const COUNTS = [1_000, 10_000, 100_000]; // #firehose sizes
const FLOOD_PHRASES = ['Incoming!', 'Another one.', 'Still fast?', 'Keep them coming.', 'Message number', 'Scrolling fine here.'];

/** @param {{ room: string }} params */
export default function ChatRoomPage({ room }) {
  const huge = room === 'firehose';
  const count = computed(() => Number(router.query.value.count) || 10_000); // #firehose size, kept in ?count=
  let received = 0; // when the last response arrived, to time putting it on screen
  let fresh = false; // a new load arrived (not a local change): put its newest messages on screen again

  // null when the room doesn't exist (404); other errors show the error view with Try again.
  const conv = resource(({ signal }) =>
    fetchJSON(`/api/chat?room=${encodeURIComponent(room)}${huge ? `&count=${count.value}` : ''}`, { signal })
      .then((data) => ((roomsVersion.value += 1), (received = performance.now()), (fresh = true), data))
      .catch((err) => {
        if (err.status === 404) return null;
        throw err;
      })
  );
  const draft = signal('');
  const replyTo = signal(/** @type {{ author: string, text: string } | null} */ (null));
  const failed = signal(/** @type {{ id: string, text: string, replyTo: any, error: string }[]} */ ([]));
  const typing = signal(/** @type {string | null} */ (null));
  const atBottom = signal(true);
  const hasRoom = computed(() => !!conv.data.value); // the composer appears once, not on every new message

  // Only the newest messages go on screen, so huge rooms stay fast; "Show older" moves the start back.
  // The start stays put while new messages arrive: they're added at the end and nothing above them moves.
  const start = signal(/** @type {number | null} */ (null));
  const all = computed(() => conv.data.value?.messages ?? []);
  // Every new load (a size change through the URL or Back included) starts at its newest messages again;
  // local changes (sends, reactions, the flood) keep the window where it is.
  effect(() => {
    const n = all.value.length;
    if (conv.data.value && (fresh || untrack(() => start.value) === null)) {
      fresh = false;
      start.value = Math.max(0, n - FIRST_SCREEN);
    }
  });
  const meta = new WeakMap(); // message → { newDay, head }, worked out once per message
  const visible = computed(() => {
    const from = start.value;
    if (from === null) return []; // not decided yet (a new load): never "everything", which could be 100,000 rows
    annotate(all.value.slice(Math.max(0, from - 1)), meta);
    return all.value.slice(from);
  });
  const isFirst = selector(() => visible.value[0]?.id); // the first message on screen always shows its day and sender
  const older = computed(() => start.value ?? 0);

  const stats = signal(/** @type {{ ms: number, what: string } | null} */ (null));
  const flooding = signal(false);
  /** @type {HTMLElement | undefined} */
  let scroller;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let botTimer;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let floodTimer;
  onCleanup(() => { clearTimeout(botTimer); clearInterval(floodTimer); });

  const person = (id) => conv.data.peek()?.people[id] ?? { name: id, color: '#666' };
  const scrollToEnd = (smooth = false) => scroller?.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  // Local changes are functions of the confirmed messages, so a message still on its way (optimistic) isn't
  // copied into them and then added again on top.
  const change = (fn) => conv.mutate((data) => ({ ...data, messages: fn(data.messages) }));

  let sent = 0; // temporary ids for messages on their way (not time-based: two can start in one millisecond)
  async function send(text, reply) {
    const temp = { id: `temp-${++sent}`, author: 'you', at: new Date().toISOString(), parts: [{ type: 'text', text }], reactions: [], replyTo: reply ?? undefined, sending: true };
    let saved;
    atBottom.value = true;
    try {
      // Shown at once; rolled back (and rethrown) if the server says no.
      await conv.optimistic(
        (data) => ({ ...data, messages: [...data.messages, temp] }),
        async () => { saved = await fetchJSON(`/api/chat?room=${encodeURIComponent(room)}`, { json: { text, replyTo: reply } }); }
      );
      change((messages) => messages.map((m) => (m.id === temp.id ? saved : m)));
      if (room === 'help') {
        typing.value = 'Pith bot';
        botTimer = setTimeout(() => { conv.refetch(); typing.value = null; }, 1700);
      }
    } catch (err) {
      failed.value = [...failed.value, { id: temp.id, text, replyTo: reply, error: err.message }];
    }
  }

  const submit = (e) => {
    e.preventDefault();
    const text = draft.value.trim();
    if (!text) return;
    const reply = replyTo.value;
    draft.value = '';
    replyTo.value = null;
    send(text, reply);
  };
  const keydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      e.target.form.requestSubmit();
    }
  };
  const retry = (f) => {
    failed.value = failed.value.filter((x) => x !== f);
    send(f.text, f.replyTo);
  };

  // Reactions are kept in this page only (the dev API doesn't store them).
  const react = (message, emoji) => change((messages) => messages.map((m) => {
    if (m.id !== message.id) return m;
    const has = m.reactions.find((r) => r.emoji === emoji);
    const reactions = !has ? [...m.reactions, { emoji, count: 1, mine: true }]
      : m.reactions.map((r) => (r.emoji !== emoji ? r : { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) })).filter((r) => r.count > 0);
    return { ...m, reactions };
  }));

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Copied', { type: 'success' });
    } catch {
      toast("Couldn't copy: the browser blocked it", { type: 'error' });
    }
  };

  // "Show older": earlier messages go in above, and what's on screen stays where it is.
  const showOlder = () => {
    const fromBottom = scroller ? scroller.scrollHeight - scroller.scrollTop : 0;
    const t = performance.now();
    start.value = Math.max(0, (start.value ?? 0) - OLDER_STEP);
    if (scroller) scroller.scrollTop = scroller.scrollHeight - fromBottom;
    requestAnimationFrame(() => (stats.value = { ms: performance.now() - t, what: `added ${OLDER_STEP} older messages` }));
  };

  // #firehose Flood: 20 new messages every 200 ms (about 100 a second), each update timed.
  let live = 0;
  const stopFlood = () => { flooding.value = false; clearInterval(floodTimer); };
  const flood = () => {
    if (flooding.value) return stopFlood();
    flooding.value = true;
    floodTimer = setInterval(() => {
      const batch = Array.from({ length: 20 }, () => {
        live++;
        return { id: `live-${live}`, author: ['ada', 'grace', 'linus', 'mia'][live % 4], at: new Date().toISOString(),
          parts: [{ type: 'text', text: `${FLOOD_PHRASES[live % FLOOD_PHRASES.length]} ${live}` }], reactions: [] };
      });
      const t = performance.now();
      change((messages) => [...messages, ...batch]);
      requestAnimationFrame(() => (stats.value = { ms: performance.now() - t, what: 'added 20 messages' }));
    }, 200);
  };

  const part = (p) => {
    if (p.type === 'text') return html`<p class="msg-text">${linkParts(p.text).map((x) => (x.href ? html`<a href=${x.href} target="_blank" rel="noopener">${x.href}</a>` : x.text))}</p>`;
    if (p.type === 'code') {
      return html`<figure class="msg-code">
        <figcaption><span>${p.lang}</span>
          <button class="icon-btn" type="button" aria-label="Copy code" @click=${() => copy(p.code)}>${icon('copy')}</button></figcaption>
        <pre tabindex="0"><code>${p.code}</code></pre></figure>`;
    }
    if (p.type === 'image') return html`<img class="msg-image" src=${p.src} alt=${p.alt} width=${p.width} height=${p.height} loading="lazy">`;
    if (p.type === 'file') {
      return html`<div class="msg-file">
        <span class="icon-tile">${icon('file')}</span>
        <span class="msg-file-name">${p.name}<span class="muted note">${p.kind} · ${size(p.size)}</span></span>
        <button class="btn" type="button" @click=${() => toast('This is a demo: there is no real file')}>Download</button></div>`;
    }
    if (p.type === 'link') {
      return html`<a class="msg-link card" href=${p.url} target="_blank" rel="noopener">
        <span class="muted note">${p.site}</span><strong>${p.title}</strong><span class="muted">${p.description}</span></a>`;
    }
    return null;
  };

  const message = (m) => html`
    <div class=${m.sending ? 'msg sending' : 'msg'} tabindex="-1">
      ${m.replyTo ? html`<blockquote class="msg-quote"><strong>${person(m.replyTo.author).name}</strong> ${m.replyTo.text}</blockquote>` : null}
      ${m.parts.map(part)}
      ${m.sending ? html`<span class="muted note">Sending…</span>` : null}
      ${m.reactions.length ? html`<div class="reactions">
        ${m.reactions.map((r) => html`<button type="button" class="reaction" aria-pressed=${String(r.mine)}
          aria-label=${`${r.emoji} ${r.count}, ${r.mine ? 'remove your reaction' : 'react'}`} @click=${() => react(m, r.emoji)}>${r.emoji} ${r.count}</button>`)}
      </div>` : null}
      ${m.sending ? null : html`<div class="msg-actions">
        <button class="icon-btn" type="button" aria-label="Reply" @click=${() => { replyTo.value = { author: m.author, text: m.parts.find((p) => p.type === 'text')?.text ?? 'an attachment' }; document.getElementById('composer')?.focus(); }}>${icon('reply')}</button>
        <button class="icon-btn" type="button" aria-label="Add reaction" popovertarget=${`react-${m.id}`}>${icon('smile')}</button>
        <div class="emoji-picker" id=${`react-${m.id}`} popover>
          ${EMOJIS.map((e) => html`<button type="button" aria-label=${`React with ${e}`} @click=${(ev) => { react(m, e); ev.target.closest('[popover]').hidePopover(); }}>${e}</button>`)}
        </div>
      </div>`}
    </div>`;

  // One message per row, inside one wrapper element: a repeat() row must not start with a hole that fills in later.
  const row = (m) => {
    const head = () => meta.get(m)?.head || isFirst(m.id);
    const author = person(m.author);
    const mine = m.author === 'you';
    return html`
      <div class=${mine ? 'msg-row mine' : 'msg-row'}>
        ${() => (meta.get(m)?.newDay || isFirst(m.id) ? html`<div class="day" role="separator" aria-label=${day(m.at)}><span>${day(m.at)}</span></div>` : null)}
        <article class=${() => (head() ? 'msg-run' : 'msg-run cont')}>
          ${mine ? null : () => (head()
            ? html`<span class="avatar" style=${`--avatar: ${author.color}`} aria-hidden="true">${initials(author.name)}</span>`
            : html`<span class="avatar-gap"></span>`)}
          <div class="msg-body">
            ${() => (head() ? html`<header class="msg-head">${mine ? null : html`<strong>${author.name}</strong>`}
              <time datetime=${m.at}>${time(m.at)}</time></header>` : null)}
            ${message(m)}
          </div>
        </article>
      </div>`;
  };

  // The log: conv.live() builds its ready view once (render() would build it again for every message,
  // reaction and flood batch), and the list inside patches as the data changes.
  const kind = computed(() => (!conv.data.value ? 'missing' : all.value.length ? 'list' : 'empty'));
  const log = conv.live({
    loading: () => html`<div class="chat-skeleton" aria-busy="true">
      ${[1, 2, 3].map(() => html`<div class="skeleton-run"><span class="avatar skeleton"></span><span class="skeleton-lines"><span></span><span></span></span></div>`)}
      <p class="sr-only">Loading messages…</p></div>`,
    error: (err, retry) => html`<div class="load-error" role="alert"><p>Couldn't load the messages. ${err.message}</p>
      <button class="btn" type="button" @click=${retry}>Try again</button></div>`,
    ready: () => html`${() => {
      const k = kind.value;
      if (k === 'missing') {
        return html`<div class="chat-empty"><p><strong>No such room.</strong></p>
          <p class="muted">There's no room called <code>#${room}</code>.</p><a class="btn primary" href="/chat">All rooms</a></div>`;
      }
      if (k === 'empty') {
        return html`<div class="chat-empty"><span class="icon-tile">${icon('chat')}</span>
          <p><strong>No messages yet.</strong></p><p class="muted">Say hi to #${room}.</p></div>`;
      }
      return html`
        <div class="older">${() => (older.value ? html`<button class="btn show-older" type="button" @click=${showOlder}>
          Show older (${older.value.toLocaleString()} more)</button>` : null)}</div>
        <div class="msg-list">${repeat(visible, (m) => m.id, row)}</div>`;
    }}`,
  });

  const view = html`
    <header class="chat-head">
      <a class="chat-back icon-btn" href="/chat" aria-label="All rooms">${icon('back')}</a>
      <div><h1># ${room}</h1><p class="muted note">${() => conv.data.value?.room.topic ?? ''}</p></div>
    </header>
    ${huge ? html`
      <div class="firehose-bar">
        <div class="segmented" role="group" aria-label="How many messages">
          ${COUNTS.map((n) => html`<button type="button" aria-pressed=${() => String(count.value === n)}
            @click=${() => { stopFlood(); start.value = null; router.setQuery({ count: n === 10_000 ? null : n }); }}>${n.toLocaleString()}</button>`)}
        </div>
        <button class="btn" type="button" aria-pressed=${() => String(flooding.value)} @click=${flood}>
          ${() => (flooding.value ? 'Stop flood' : 'Flood · 100/s')}</button>
        <p class="muted note firehose-stats" aria-live="polite">${() => (conv.loading.value ? 'Loading…'
          : `${all.value.length.toLocaleString()} messages · ${visible.value.length.toLocaleString()} on screen${stats.value ? ` · ${stats.value.what} in ${stats.value.ms.toFixed(1)} ms` : ''}`)}</p>
      </div>` : null}
    <div class="chat-log" role="log" aria-label=${`Messages in #${room}`} tabindex="0"
         ref=${(el) => (scroller = el)}
         @scroll=${(e) => { const el = e.target; atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      <div class="log-body">${log}</div>
      <div class="log-end">
        ${() => failed.value.map((f) => html`
          <div class="msg-row mine"><article class="msg-run">
            <div class="msg-body"><div class="msg failed">
              <p class="msg-text">${f.text}</p>
              <p class="msg-failed-note" role="alert">Not sent: ${f.error}</p>
              <div class="row"><button class="btn" type="button" @click=${() => retry(f)}>${icon('refresh')} Retry</button>
              <button class="btn ghost" type="button" @click=${() => (failed.value = failed.value.filter((x) => x !== f))}>Delete</button></div>
            </div></div>
          </article></div>`)}
        ${() => (typing.value ? html`<p class="typing" aria-live="polite">${typing.value} is typing<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></p>` : null)}
      </div>
    </div>
    <div class="jump-slot">${() => (atBottom.value ? null : html`<button class="btn jump" type="button" @click=${() => { atBottom.value = true; scrollToEnd(true); }}>${icon('down')} Jump to latest</button>`)}</div>
    <div class="composer-slot">${() => (hasRoom.value && !huge ? html`
      <form class="composer" @submit=${submit}>
        ${() => (replyTo.value ? html`<div class="replying">${icon('reply')}<span>Replying to <strong>${person(replyTo.value.author).name}</strong>: ${replyTo.value.text}</span>
          <button class="icon-btn" type="button" aria-label="Cancel reply" @click=${() => (replyTo.value = null)}>${icon('close')}</button></div>` : null)}
        <div class="composer-row">
          <label class="sr-only" for="composer">Message #${room}</label>
          <textarea id="composer" class="input" rows="1" placeholder=${`Message #${room}`} .value=${draft}
                    @input=${(e) => (draft.value = e.target.value)} @keydown=${keydown}></textarea>
          <button class="btn primary send" type="submit" aria-label="Send" ?disabled=${() => !draft.value.trim()}>${icon('send')}</button>
        </div>
        <p class="muted note composer-hint">Enter to send, Shift+Enter for a new line. Try a message with <code>/fail</code>.</p>
      </form>` : null)}</div>
  `;

  // Made after the view, so it runs after the list has updated: how long a load took to put on screen,
  // and stay at the latest message if the reader was there.
  effect(() => {
    visible.value;
    failed.value;
    typing.value;
    if (received && visible.peek().length) {
      // At the next frame the rows are built, styled and laid out: that's "on screen".
      const since = received;
      received = 0;
      requestAnimationFrame(() => (stats.value = { ms: performance.now() - since, what: `put ${visible.peek().length.toLocaleString()} on screen` }));
    }
    if (untrack(() => atBottom.value)) requestAnimationFrame(() => scrollToEnd());
  });

  return view;
}
