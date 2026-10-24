import { html, signal, computed, resource, paginated, fetchJSON, repeat, selector, untrack } from 'pith';
import { router } from '../router.js';
import { confirm, toast } from '../ui.js';
import { icon } from '../icons.js';
import { FOLDERS, countsVersion, sentVersion, compose, when, fullDate, initials, colorOf } from '../inbox/state.js';

const ABOUT = {
  inbox: 'Mail sent to you',
  starred: 'Messages you starred, from every folder but Trash',
  sent: 'Mail you sent',
  archive: 'Out of the inbox, kept for later',
  trash: 'Deleted messages: delete them forever, or move them back',
};
const EMPTY = {
  inbox: ["You're all caught up.", 'New mail shows up here.'],
  starred: ['Nothing starred yet.', 'Star a message to find it here later.'],
  sent: ['Nothing sent yet.', 'Messages you send show up here.'],
  archive: ['The archive is empty.', 'Archive a message to keep it out of the inbox.'],
  trash: ['Trash is empty.', 'Deleted messages wait here until you delete them forever.'],
};

const post = (body) => fetchJSON('/api/inbox', { json: body });

/** @param {{ folder: string }} params */
export default function InboxPage({ folder }) {
  const meta = FOLDERS.find((f) => f.id === folder);
  if (!meta) {
    return html`<section class="inbox-missing">
      <span class="icon-tile">${icon('inbox')}</span>
      <h1>No such folder</h1>
      <p class="muted">There's no folder called "${folder}".</p>
      <a class="btn primary" href="/inbox/inbox">Go to Inbox</a></section>`;
  }

  const q = computed(() => router.query.value.q ?? '');
  const selectedId = computed(() => router.query.value.m ?? null);
  const isSelected = selector(selectedId);

  const list = paginated(({ page, signal }) => {
    if (folder === 'sent') sentVersion.value; // a sent message: load Sent again
    return fetchJSON(`/api/inbox?folder=${folder}&q=${encodeURIComponent(q.value)}&page=${page}`, { signal });
  });

  // Local changes (star, read, moved away) go into the loaded list with list.mutate(). The rows are keyed by
  // id and read their message from byId, so a changed message updates its row in place (focus stays put).
  const ids = computed(() => list.items.value.map((m) => m.id));
  const byId = computed(() => new Map(list.items.value.map((m) => [m.id, m])));
  /** @param {string[]} these @param {object} change */
  const patch = (these, change) => list.mutate((items) => items.map((m) => (these.includes(m.id) ? { ...m, ...change } : m)));

  // Checked rows, for the bulk actions.
  const checked = signal(/** @type {Set<string>} */ (new Set()));
  const checkedIds = computed(() => ids.value.filter((id) => checked.value.has(id)));
  const anyChecked = computed(() => checkedIds.value.length > 0);
  const allChecked = computed(() => ids.value.length > 0 && checkedIds.value.length === ids.value.length);
  const toggleCheck = (id, on) => {
    const next = new Set(checked.value);
    if (on) next.add(id);
    else next.delete(id);
    checked.value = next;
  };
  const without = (set, ids) => new Set([...set].filter((id) => !ids.includes(id)));

  // Out of the list (moved or deleted), with what it takes to put them back if the save fails or on Undo.
  const takeOut = (these) => {
    const out = list.items.peek().filter((m) => these.includes(m.id));
    list.mutate((items) => items.filter((m) => !these.includes(m.id)));
    checked.value = without(checked.value, these);
    if (these.includes(selectedId.peek())) router.setQuery({ m: null });
    return out;
  };
  const putBack = (out) => list.mutate((items) => [...items, ...out].sort((a, b) => b.at.localeCompare(a.at)));

  // ---------- Actions ----------

  // `own`: the preview's star when the message isn't in the loaded list.
  const starOf = (id, own) => byId.value.get(id)?.starred ?? own?.value;
  async function toggleStar(id, own) {
    const set = (on) => {
      patch([id], { starred: on });
      if (own) own.value = on;
    };
    const next = !untrack(() => starOf(id, own));
    set(next);
    try {
      await post({ action: 'star', id, starred: next });
      countsVersion.value += 1;
    } catch (err) {
      set(!next);
      toast(`Couldn't change the star: ${err.message}`, { type: 'error' });
    }
  }

  const DONE = { trash: ['Moved to Trash', 'to Trash'], archive: ['Archived', 'archived'], inbox: ['Moved to Inbox', 'to Inbox'] };
  async function move(ids, to) {
    const out = takeOut(ids);
    try {
      await post({ action: 'move', ids, to });
    } catch (err) {
      putBack(out);
      toast(`Couldn't move ${ids.length === 1 ? 'the message' : 'the messages'}: ${err.message}`, { type: 'error' });
      return;
    }
    countsVersion.value += 1;
    const [one, many] = DONE[to];
    const text = ids.length === 1 ? one : to === 'archive' ? `Archived ${ids.length} messages` : `Moved ${ids.length} messages ${many}`;
    const dismiss = toast(html`${text}
      <button class="toast-undo" type="button" @click=${() => { dismiss(); undo(ids, out); }}>Undo</button>`, { timeout: 8000 });
  }

  async function undo(ids, out) {
    putBack(out);
    try {
      await post({ action: 'undo', ids });
      countsVersion.value += 1;
      toast(ids.length === 1 ? 'Message restored' : `${ids.length} messages restored`, { type: 'success' });
    } catch (err) {
      takeOut(ids);
      toast(`Couldn't undo: ${err.message}`, { type: 'error' });
    }
  }

  const named = (ids) => (ids.length === 1 ? `"${byId.peek().get(ids[0])?.subject ?? 'this message'}"` : `${ids.length} messages`);

  async function remove(ids) {
    if (!ids.length) return;
    if (folder !== 'trash') {
      if (await confirm(`Move ${named(ids)} to Trash?`, { ok: 'Move to Trash', danger: true })) move(ids, 'trash');
      return;
    }
    if (!(await confirm(`Delete ${named(ids)} forever? This can't be undone.`, { ok: 'Delete forever', danger: true }))) return;
    const out = takeOut(ids);
    try {
      await post({ action: 'destroy', ids });
      countsVersion.value += 1;
      toast(ids.length === 1 ? 'Deleted forever' : `${ids.length} messages deleted forever`, { type: 'success' });
    } catch (err) {
      putBack(out);
      toast(`Couldn't delete: ${err.message}`, { type: 'error' });
    }
  }

  // The other way out of this folder: Archive from the inbox and Sent, back to the Inbox from Archive and Trash.
  // (Not in Starred: an archived message stays starred, so it would stay in this list.)
  const second = folder === 'archive' || folder === 'trash' ? { label: 'Move to Inbox', icon: 'inbox', to: 'inbox' }
    : folder === 'starred' ? null : { label: 'Archive', icon: 'archive', to: 'archive' };

  const open = (r) => router.setQuery({ m: r.id }, { replace: false }); // Back closes it again
  const search = (e) => {
    checked.value = new Set();
    router.setQuery({ q: e.target.value });
  };

  // ---------- The preview ----------

  const hasSelection = computed(() => !!selectedId.value);
  const detail = resource(({ signal }) => {
    const id = selectedId.value;
    if (!id) return null;
    return fetchJSON(`/api/inbox?id=${encodeURIComponent(id)}`, { signal })
      .then((m) => {
        if (m.wasUnread) {
          patch([m.id], { read: true });
          countsVersion.value += 1;
        }
        return m;
      })
      .catch((err) => {
        if (err.status === 404) return { missing: true };
        throw err;
      });
  });

  const reply = (m) => {
    const other = folder === 'sent' ? m.to[0] : m.from;
    compose({
      to: other.email,
      subject: m.subject.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`,
      body: `\n\nOn ${fullDate(m.at)}, ${m.from.name} wrote:\n> ${m.body.join('\n> ')}`,
    });
  };

  const backToList = html`<button class="icon-btn mail-back" type="button" aria-label=${`Back to ${meta.name}`}
    @click=${() => router.setQuery({ m: null })}>${icon('back')}</button>`;

  const previewSkeleton = () => html`<div class="mail-view-skeleton" aria-busy="true">
    <span class="sk sk-title"></span><span class="sk sk-meta"></span>
    <span class="sk"></span><span class="sk"></span><span class="sk sk-short"></span>
    <p class="sr-only">Loading the message…</p></div>`;

  const messageView = (m) => {
    const other = m.from.email === 'you@pith.dev' ? m.to[0] : m.from;
    return html`
      <article class="mail-view">
        <div class="mail-view-bar">
          ${backToList}
          <div class="mail-view-actions">
            ${starButton(m.id, 'Star this message', signal(m.starred))}
            ${second ? html`<button class="icon-btn" type="button" aria-label=${second.label} @click=${() => move([m.id], second.to)}>${icon(second.icon)}</button>` : null}
            <button class="icon-btn danger" type="button" aria-label=${folder === 'trash' ? 'Delete forever' : 'Delete'} @click=${() => remove([m.id])}>${icon('trash')}</button>
          </div>
        </div>
        <h2 class="mail-view-subject">${m.subject}</h2>
        <div class="mail-view-meta">
          <span class="avatar" style=${`--avatar: ${colorOf(other.email)}`} aria-hidden="true">${initials(other.name)}</span>
          <div class="mail-view-people">
            <p><strong>${m.from.name}</strong> <span class="muted">&lt;${m.from.email}&gt;</span></p>
            <p class="muted note">To ${m.to.map((p) => p.name).join(', ')}</p>
          </div>
          <time class="muted note" datetime=${m.at}>${fullDate(m.at)}</time>
        </div>
        <div class="mail-view-body">${m.body.map((p) => html`<p>${p}</p>`)}</div>
        <div class="row mail-view-foot">
          <button class="btn" type="button" @click=${() => reply(m)}>${icon('reply')} Reply</button>
        </div>
      </article>`;
  };

  const preview = () => (hasSelection.value ? untrack(() => html`${detail.render({
    loading: previewSkeleton,
    error: (err, retry) => html`<div class="mail-view-state">${backToList}
      <div class="load-error" role="alert"><p>Couldn't open this message. ${err.message}</p>
      <button class="btn" type="button" @click=${retry}>Try again</button></div></div>`,
    ready: (m) => (!m ? previewSkeleton()
      : m.missing ? html`<div class="mail-view-state">${backToList}<div class="inbox-empty">
          <span class="icon-tile">${icon('trash')}</span><p><strong>This message is gone.</strong></p>
          <p class="muted">It was deleted forever, or the link is wrong.</p></div></div>`
      : messageView(m)),
  })}`) : html`<div class="inbox-empty">
      <span class="icon-tile">${icon('inbox')}</span>
      <p><strong>No message selected</strong></p>
      <p class="muted">Pick a message from the list to read it here.</p></div>`);

  // ---------- The list ----------

  /** @param {string} id @param {string} label @param {{ value: boolean }} [own] */
  function starButton(id, label, own) {
    return html`<button type="button" class=${() => (starOf(id, own) ? 'icon-btn star-btn on' : 'icon-btn star-btn')}
      aria-pressed=${() => String(!!starOf(id, own))} aria-label=${label} @click=${() => toggleStar(id, own)}>${icon('star')}</button>`;
  }

  // One element per row (a repeat() row must not start with a hole). Built once per id; `read` follows the list.
  const row = (id) => {
    const r = byId.peek().get(id);
    const read = () => byId.value.get(id)?.read;
    const other = folder === 'sent' ? r.to[0] : r.from;
    return html`
      <li class=${() => `mail-row${read() ? '' : ' unread'}${isSelected(r.id) ? ' selected' : ''}`}>
        <label class="mail-check"><input type="checkbox" class="check" aria-label=${`Select: ${r.subject}`}
          .checked=${() => checked.value.has(r.id)} @change=${(e) => toggleCheck(r.id, e.target.checked)}></label>
        <button type="button" class="mail-open" aria-current=${() => (isSelected(r.id) ? 'true' : null)} @click=${() => open(r)}>
          <span class="avatar" style=${`--avatar: ${colorOf(other.email)}`} aria-hidden="true">${initials(other.name)}</span>
          <span class="mail-from">${folder === 'sent' ? `To: ${other.name}` : other.name}${() => (read() ? null : html`<span class="sr-only">, unread</span>`)}</span>
          <time class="mail-time" datetime=${r.at}>${when(r.at)}</time>
          <span class="mail-subject">${r.subject}</span>
          <span class="mail-snippet">${r.snippet}</span>
        </button>
        ${starButton(id, `Star: ${r.subject}`)}
      </li>`;
  };

  const skeleton = () => html`<div class="mail-skeleton" aria-busy="true">
    ${[1, 2, 3, 4, 5, 6].map(() => html`<div class="mail-skeleton-row"><span class="avatar sk"></span>
      <span class="mail-skeleton-lines"><span class="sk"></span><span class="sk"></span><span class="sk"></span></span></div>`)}
    <p class="sr-only">Loading ${meta.name}…</p></div>`;

  // What the loaded list shows. It changes only between these, so starring or removing a row never rebuilds it.
  const shows = computed(() => (ids.value.length ? 'list' : list.loading.value ? 'loading' : q.value ? 'no-results' : 'empty'));
  const views = {
    loading: skeleton,
    'no-results': () => html`<div class="inbox-empty"><span class="icon-tile">${icon('search')}</span>
      <p><strong>No messages match "${q}"</strong></p>
      <p class="muted">Try other words, or look in another folder.</p>
      <button class="btn" type="button" @click=${() => router.setQuery({ q: null })}>Clear search</button></div>`,
    empty: () => html`<div class="inbox-empty"><span class="icon-tile">${icon(meta.icon)}</span>
      <p><strong>${EMPTY[folder][0]}</strong></p><p class="muted">${EMPTY[folder][1]}</p></div>`,
    list: () => html`
      <ul class="mail-list" aria-label=${`Messages in ${meta.name}`}>${repeat(ids, (id) => id, row)}</ul>
      <div class="mail-more">${() => {
        if (list.moreError.value) {
          return html`<p class="form-error" role="alert">Couldn't load more. ${list.moreError.value.message}</p>
            <button class="btn" type="button" @click=${list.loadMore}>Try again</button>`;
        }
        if (list.hasMore.value) {
          return html`<button class="btn" type="button" ?disabled=${list.loadingMore} @click=${list.loadMore}>
            ${() => (list.loadingMore.value ? 'Loading…' : 'Load more')}</button>`;
        }
        return html`<p class="muted note">${() => (ids.value.length === 1 ? 'That’s the only message.' : `That’s all ${ids.value.length} messages.`)}</p>`;
      }}</div>`,
  };

  return html`
    <section class="inbox-list" aria-labelledby="folder-title">
      <header class="inbox-head">
        <div>
          <h1 id="folder-title">${meta.name}</h1>
          <p class="muted note" aria-live="polite">${() => (list.loading.value && ids.value.length ? 'Updating…'
            : q.value ? `Search results for "${q.value}"` : ABOUT[folder])}</p>
        </div>
        <div class="mail-search">
          ${icon('search')}
          <label class="sr-only" for="mail-search">Search mail</label>
          <input id="mail-search" class="input" type="search" placeholder=${`Search ${meta.name}`} autocomplete="off"
                 .value=${() => q.value} @input=${search}>
        </div>
      </header>
      <div class="inbox-toolbar" role="toolbar" aria-label="Selected messages">
        <label class="mail-check"><input type="checkbox" class="check" aria-label="Select all"
          ?disabled=${() => !ids.value.length}
          .checked=${allChecked} .indeterminate=${() => anyChecked.value && !allChecked.value}
          @change=${(e) => (checked.value = e.target.checked ? new Set(ids.peek()) : new Set())}></label>
        ${() => (anyChecked.value ? untrack(() => html`
          <span class="toolbar-count">${() => checkedIds.value.length} selected</span>
          ${second ? html`<button class="btn" type="button" @click=${() => move(checkedIds.peek(), second.to)}>${icon(second.icon)} ${second.label}</button>` : null}
          <button class="btn danger-text" type="button" @click=${() => remove(checkedIds.peek())}>${icon('trash')} ${folder === 'trash' ? 'Delete forever' : 'Delete'}</button>`)
          : html`<span class="muted note">Select to ${second ? `${second.label.toLowerCase()} or ` : ''}delete</span>`)}
        <button class="icon-btn toolbar-refresh" type="button" aria-label="Refresh" @click=${() => { checked.value = new Set(); list.refetch(); }}>${icon('refresh')}</button>
      </div>
      <div class="inbox-scroll">${list.live({
        loading: skeleton,
        error: (err, retry) => html`<div class="inbox-empty"><div class="load-error" role="alert">
          <p>Couldn't load ${meta.name}. ${err.message}</p>
          <button class="btn" type="button" @click=${retry}>Try again</button></div></div>`,
        ready: () => html`${() => untrack(views[shows.value])}`,
      })}</div>
    </section>
    <section class=${() => (detail.loading.value && hasSelection.value ? 'inbox-preview updating' : 'inbox-preview')} aria-label="Message">${preview}</section>
  `;
}
