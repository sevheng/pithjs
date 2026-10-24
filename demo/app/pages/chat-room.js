import { html, signal, computed, resource, fetchJSON, effect, onCleanup } from 'pith';
import { toast } from '../ui.js';
import { icon } from '../icons.js';
import { roomsVersion } from '../chat/state.js';
import { time, size, initials, groupMessages, linkParts } from '../chat/format.js';

const EMOJIS = ['👍', '🎉', '🚀', '😍', '👀', '🙏'];

/** @param {{ room: string }} params */
export default function ChatRoomPage({ room }) {
  // null when the room doesn't exist (404); other errors show the error view with Try again.
  const conv = resource(({ signal }) =>
    fetchJSON(`/api/chat?room=${encodeURIComponent(room)}`, { signal })
      .then((data) => ((roomsVersion.value += 1), data))
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
  /** @type {HTMLElement | undefined} */
  let scroller;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let botTimer;
  onCleanup(() => clearTimeout(botTimer));

  const person = (id) => conv.data.peek()?.people[id] ?? { name: id, color: '#666' };
  const scrollToEnd = (smooth = false) => scroller?.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

  // New messages: stay at the latest one if the reader was there; otherwise "Jump to latest" appears.
  effect(() => {
    conv.data.value;
    failed.value;
    typing.value;
    if (atBottom.peek()) requestAnimationFrame(() => scrollToEnd());
  });

  async function send(text, reply) {
    const temp = { id: `temp-${Date.now()}`, author: 'you', at: new Date().toISOString(), parts: [{ type: 'text', text }], reactions: [], replyTo: reply ?? undefined, sending: true };
    let saved;
    atBottom.value = true;
    try {
      // Shown at once; rolled back (and rethrown) if the server says no.
      await conv.optimistic(
        (data) => ({ ...data, messages: [...data.messages, temp] }),
        async () => { saved = await fetchJSON(`/api/chat?room=${encodeURIComponent(room)}`, { json: { text, replyTo: reply } }); }
      );
      const data = conv.data.peek();
      conv.mutate({ ...data, messages: data.messages.map((m) => (m.id === temp.id ? saved : m)) });
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
  const react = (message, emoji) => {
    const data = conv.data.peek();
    conv.mutate({ ...data, messages: data.messages.map((m) => {
      if (m.id !== message.id) return m;
      const has = m.reactions.find((r) => r.emoji === emoji);
      const reactions = !has ? [...m.reactions, { emoji, count: 1, mine: true }]
        : m.reactions.map((r) => (r.emoji !== emoji ? r : { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) })).filter((r) => r.count > 0);
      return { ...m, reactions };
    }) });
  };

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Copied', { type: 'success' });
    } catch {
      toast("Couldn't copy: the browser blocked it", { type: 'error' });
    }
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

  const thread = (data) => {
    if (!data.messages.length) {
      return html`<div class="chat-empty"><span class="icon-tile">${icon('chat')}</span>
        <p><strong>No messages yet.</strong></p><p class="muted">Say hi to #${data.room.name}.</p></div>`;
    }
    return groupMessages(data.messages).map((d) => html`
      <div class="day" role="separator" aria-label=${d.label}><span>${d.label}</span></div>
      ${d.runs.map((run) => html`
        <article class="msg-run">
          <span class="avatar" style=${`--avatar: ${person(run.author).color}`} aria-hidden="true">${initials(person(run.author).name)}</span>
          <div class="msg-body">
            <header class="msg-head"><strong>${person(run.author).name}</strong> <time datetime=${run.messages[0].at}>${time(run.messages[0].at)}</time></header>
            ${run.messages.map(message)}
          </div>
        </article>`)}`);
  };

  return html`
    <header class="chat-head">
      <a class="chat-back icon-btn" href="/chat" aria-label="All rooms">${icon('back')}</a>
      <div><h1># ${room}</h1><p class="muted note">${() => conv.data.value?.room.topic ?? ''}</p></div>
    </header>
    <div class="chat-log" role="log" aria-label=${`Messages in #${room}`} tabindex="0"
         ref=${(el) => (scroller = el)}
         @scroll=${(e) => { const el = e.target; atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      ${conv.render({
        loading: () => html`<div class="chat-skeleton" aria-busy="true">
          ${[1, 2, 3].map(() => html`<div class="skeleton-run"><span class="avatar skeleton"></span><span class="skeleton-lines"><span></span><span></span></span></div>`)}
          <p class="sr-only">Loading messages…</p></div>`,
        error: (err, retry) => html`<div class="load-error" role="alert"><p>Couldn't load the messages. ${err.message}</p>
          <button class="btn" type="button" @click=${retry}>Try again</button></div>`,
        ready: (data) => (data ? thread(data) : html`<div class="chat-empty"><p><strong>No such room.</strong></p>
          <p class="muted">There's no room called <code>#${room}</code>.</p><a class="btn primary" href="/chat">All rooms</a></div>`),
      })}
      ${() => failed.value.map((f) => html`
        <div class="msg-run mine">
          <div class="msg-body"><div class="msg failed">
            <p class="msg-text">${f.text}</p>
            <p class="form-error" role="alert">Not sent: ${f.error}</p>
            <div class="row"><button class="btn" type="button" @click=${() => retry(f)}>${icon('refresh')} Retry</button>
            <button class="btn ghost" type="button" @click=${() => (failed.value = failed.value.filter((x) => x !== f))}>Delete</button></div>
          </div></div>
        </div>`)}
      ${() => (typing.value ? html`<p class="typing" aria-live="polite">${typing.value} is typing<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></p>` : null)}
    </div>
    ${() => (atBottom.value ? null : html`<button class="btn jump" type="button" @click=${() => scrollToEnd(true)}>${icon('down')} Jump to latest</button>`)}
    ${() => (hasRoom.value ? html`
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
      </form>` : null)}
  `;
}
