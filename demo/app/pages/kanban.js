import { html, signal, computed, repeat, selector, transition, form, rules } from 'pith';
import { router } from '../router.js';
import { confirm, dialog, toast } from '../ui.js';
import { icon } from '../icons.js';
import { board } from '../kanban/state.js';
import { COLUMNS, LABELS, PEOPLE, columnName, labelName, person, initials, dueInfo, newId, place, seedCards } from '../kanban/data.js';

/** @typedef {import('../kanban/data.js').Card} Card */

const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const MOVE_ICONS = { left: 'arrow-left', up: 'arrow-up', down: 'down', right: 'arrow-right' };

export default function KanbanPage() {
  // ---- Filters, kept in the URL: ?label=bug&label=docs&who=ada ----
  const labels = computed(() => router.queryAll('label').filter((id) => LABELS.some((l) => l.id === id)));
  const who = computed(() => (PEOPLE.some((p) => p.id === router.query.value.who) ? router.query.value.who : ''));
  const filtering = computed(() => labels.value.length > 0 || !!who.value);
  const matches = (/** @type {Card} */ c) => (!labels.value.length || labels.value.includes(c.label)) && (!who.value || c.assignee === who.value);
  const visible = computed(() => board.cards.value.filter(matches));
  const noMatch = computed(() => filtering.value && visible.value.length === 0);
  const overdue = computed(() => board.cards.value.filter((c) => dueInfo(c.due, c.column)?.state === 'overdue').length);

  const toggleLabel = (id) => {
    const now = labels.value;
    router.setQuery({ label: now.includes(id) ? now.filter((x) => x !== id) : [...now, id] });
  };
  const toggleWho = (id) => router.setQuery({ who: who.value === id ? null : id });
  const clearFilters = () => router.setQuery({ label: [], who: null });

  // Each column's cards (as filtered), in board order. The lists patch on change: a move moves one row.
  const lists = Object.fromEntries(COLUMNS.map((col) => [col.id, computed(() => visible.value.filter((c) => c.column === col.id))]));
  const counts = Object.fromEntries(COLUMNS.map((col) => [col.id, computed(() => lists[col.id].value.length)]));

  // ---- Moving cards ----
  const said = signal(''); // read out by screen readers after a move, add or delete
  const announce = (text) => (said.value = text);

  /** Put the cards in their new order, animated; then focus the moved card again (its row may be new). */
  const commit = (/** @type {Card[]} */ next, focusId = '', dir = '') => transition(() => {
    board.cards.value = next;
    if (!focusId) return;
    const el = document.getElementById(`kcard-${focusId}`);
    const button = /** @type {HTMLButtonElement | null | undefined} */ (el?.querySelector(`[data-move="${dir}"]`));
    /** @type {HTMLElement | null | undefined} */ (button && !button.disabled ? button : el?.querySelector('.kcard-title'))?.focus();
  });

  const canMove = (/** @type {Card} */ c, dir) => {
    const list = lists[c.column].value;
    const col = COLUMNS.findIndex((x) => x.id === c.column);
    if (dir === 'left') return col > 0;
    if (dir === 'right') return col < COLUMNS.length - 1;
    if (dir === 'up') return list[0]?.id !== c.id;
    return list[list.length - 1]?.id !== c.id;
  };

  const move = (/** @type {Card} */ c, dir) => {
    if (!canMove(c, dir)) return;
    const cards = board.cards.value;
    const list = lists[c.column].value;
    const i = list.findIndex((x) => x.id === c.id);
    const col = COLUMNS.findIndex((x) => x.id === c.column);
    let next;
    if (dir === 'up') next = place(cards, c.id, c.column, { before: list[i - 1].id });
    else if (dir === 'down') next = place(cards, c.id, c.column, { after: list[i + 1].id });
    else next = place(cards, c.id, COLUMNS[col + (dir === 'left' ? -1 : 1)].id);
    commit(next, c.id, dir);
    const to = next.find((x) => x.id === c.id);
    announce(dir === 'up' || dir === 'down'
      ? `Moved "${c.title}" ${dir}, now ${lists[c.column].value.findIndex((x) => x.id === c.id) + 1} of ${lists[c.column].value.length}`
      : `Moved "${c.title}" to ${columnName(to?.column)}`);
  };

  // ---- Drag and drop (native HTML5) ----
  const dragging = signal(/** @type {string | null} */ (null));
  const drop = signal(/** @type {{ column: string, before: string | null } | null} */ (null));
  const isDragging = selector(dragging);
  const dropBefore = selector(() => drop.value?.before ?? null);
  const dropColumn = selector(() => drop.value?.column ?? null);

  const dragStart = (e, /** @type {Card} */ c) => {
    e.dataTransfer.setData('text/plain', c.id);
    e.dataTransfer.effectAllowed = 'move';
    // Next frame: the browser has already taken its picture of the card, so dimming it doesn't dim that.
    setTimeout(() => (dragging.value = c.id), 0);
  };
  const dragEnd = () => { dragging.value = null; drop.value = null; };
  // Where would a drop land? Before the first card whose middle is below the pointer, else at the end.
  const dragOver = (e, column) => {
    if (!dragging.value) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const cards = [...e.currentTarget.querySelectorAll('.kcard')].filter((el) => el.dataset.id !== dragging.value);
    const hit = cards.find((el) => { const r = el.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    const before = hit?.dataset.id ?? null;
    if (drop.value?.column !== column || drop.value?.before !== before) drop.value = { column, before };
  };
  const dragLeave = (e, column) => {
    if (!e.currentTarget.contains(e.relatedTarget) && drop.value?.column === column) drop.value = null;
  };
  const dropCard = (e, column) => {
    e.preventDefault();
    const id = dragging.value ?? e.dataTransfer.getData('text/plain');
    const before = drop.value?.column === column ? drop.value.before : null;
    dragEnd();
    const card = board.cards.value.find((c) => c.id === id);
    if (!card) return;
    commit(place(board.cards.value, id, column, { before }));
    if (card.column !== column) announce(`Moved "${card.title}" to ${columnName(column)}`);
  };

  // ---- Adding, editing, deleting ----
  const adding = signal(/** @type {string | null} */ (null)); // the column whose add form is open

  const addForm = (col) => {
    const f = form({
      initial: { title: '' },
      validate: { title: [rules.required('Give the card a title'), rules.maxLength(120)] },
      onSubmit: ({ title }) => {
        // A card added while filtering gets the filter's label and person, so it stays in view.
        const card = { id: newId(), title: title.trim(), description: '', label: labels.value[0] ?? '', assignee: who.value, due: '', column: col.id };
        commit(place([...board.cards.value, card], card.id, col.id));
        announce(`Added "${card.title}" to ${col.name}`);
        f.reset();
        document.getElementById(`kadd-input-${col.id}`)?.focus();
      },
    });
    const cancel = () => {
      adding.value = null;
      document.getElementById(`kadd-${col.id}`)?.focus();
    };
    return html`
      <form class="kadd" novalidate @submit=${f.submit} @keydown=${(e) => e.key === 'Escape' && (e.preventDefault(), cancel())}
            ref=${(el) => queueMicrotask(() => el.querySelector("input")?.focus())}>
        ${f.input('title', { label: `New card in ${col.name}`, placeholder: 'What needs doing?' })}
        <div class="kadd-actions">
          <button class="btn primary" type="submit">Add card</button>
          <button class="btn ghost" type="button" @click=${cancel}>Cancel</button>
        </div>
      </form>`;
  };

  const remove = async (/** @type {Card} */ c) => {
    if (!(await confirm(`Delete "${c.title}"?`, { ok: 'Delete', cancel: 'Keep card', danger: true }))) return false;
    commit(board.cards.value.filter((x) => x.id !== c.id));
    announce(`Deleted "${c.title}"`);
    toast('Card deleted', { type: 'success' });
    return true;
  };

  const openCard = (/** @type {Card} */ c) => dialog((close) => {
    const f = form({
      initial: { title: c.title, description: c.description, column: c.column, label: c.label, assignee: c.assignee, due: c.due },
      validate: { title: [rules.required('Give the card a title'), rules.maxLength(120)], description: rules.maxLength(1000) },
      onSubmit: (v) => {
        const cards = board.cards.value;
        if (!cards.some((x) => x.id === c.id)) throw new Error('This card was deleted, maybe in another tab.');
        const edited = { ...v, id: c.id, title: v.title.trim(), description: v.description.trim() };
        const moved = edited.column !== cards.find((x) => x.id === c.id)?.column;
        const next = cards.map((x) => (x.id === c.id ? edited : x));
        commit(moved ? place(next, c.id, edited.column) : next);
        close(true);
        toast('Card saved', { type: 'success' });
      },
    });
    const del = async () => { if (await remove(c)) close(false); };
    return html`
      <h2 class="kdialog-title">Edit card</h2>
      <form class="form kdialog" novalidate @submit=${f.submit}>
        ${f.input('title', { label: 'Title' })}
        ${f.textarea('description', { label: 'Description', rows: 3, hint: () => `${f.fields.description.value.length}/1000` })}
        <div class="kdialog-grid">
          ${f.select('column', { label: 'Column', options: COLUMNS.map((x) => [x.id, x.name]) })}
          ${f.select('label', { label: 'Label', options: [['', 'No label'], ...LABELS.map((l) => [l.id, l.name])] })}
          ${f.select('assignee', { label: 'Assignee', options: [['', 'Nobody yet'], ...PEOPLE.map((p) => [p.id, p.name])] })}
          ${f.input('due', { label: 'Due date', type: 'date' })}
        </div>
        ${() => (f.submitError.value ? html`<p class="form-error" role="alert">${f.submitError.value.message}</p>` : null)}
        <div class="kdialog-actions">
          <button class="btn ghost kdelete" type="button" @click=${del}>${icon('trash')} Delete card</button>
          <button class="btn" type="button" @click=${() => close(false)}>Cancel</button>
          <button class="btn primary" type="submit" ?disabled=${f.submitting}>Save changes</button>
        </div>
      </form>`;
  });

  const resetBoard = async () => {
    if (!(await confirm('Reset the board to its 14 starting cards? Your changes are lost.', { ok: 'Reset board', danger: true }))) return;
    commit(seedCards());
    clearFilters();
    toast('Board reset');
  };

  // ---- Views ----
  const avatar = (p, cls = 'avatar sm') => html`<span class=${cls} style=${`--avatar: ${p.color}`} aria-hidden="true">${initials(p.name)}</span>`;

  /** One card. Rebuilt when its card object changes (an edit, a column change); moved when only its place does. */
  const cardRow = (/** @type {Card} */ c) => {
    const due = dueInfo(c.due, c.column);
    const p = person(c.assignee);
    return html`
      <li class=${() => `kcard${isDragging(c.id) ? ' dragging' : ''}${dropBefore(c.id) ? ' drop-before' : ''}`}
          id=${`kcard-${c.id}`} data-id=${c.id} draggable="true" style=${`view-transition-name: kcard-${c.id}`}
          @dragstart=${(e) => dragStart(e, c)} @dragend=${dragEnd}
          @keydown=${(e) => { if (e.altKey && ARROWS[e.key]) { e.preventDefault(); move(c, ARROWS[e.key]); } }}>
        ${c.label ? html`<span class="klabel" style=${`--label: var(--label-${c.label})`}>${labelName(c.label)}</span>` : null}
        <button class="kcard-title" type="button" @click=${() => openCard(c)}>${c.title}</button>
        ${c.description ? html`<p class="kcard-desc">${c.description}</p>` : null}
        ${due || p ? html`
          <div class="kcard-meta">
            ${due ? html`<span class=${`kdue ${due.state}`}>${icon('calendar')}${due.text}</span>` : html`<span></span>`}
            ${p ? html`<span class="kwho" title=${p.name}>${avatar(p)}<span class="sr-only">Assigned to ${p.name}</span></span>` : null}
          </div>` : null}
        <div class="kcard-moves" role="group" aria-label=${`Move "${c.title}"`}>
          ${['left', 'up', 'down', 'right'].map((dir) => html`
            <button class="icon-btn" type="button" data-move=${dir} aria-label=${`Move "${c.title}" ${dir}`}
                    ?disabled=${() => !canMove(c, dir)} @click=${() => move(c, dir)}>${icon(MOVE_ICONS[dir])}</button>`)}
        </div>
      </li>`;
  };

  const column = (col) => html`
    <section class="kcol" aria-labelledby=${`kcol-${col.id}`} data-col=${col.id}
             data-drop=${() => (dropColumn(col.id) ? 'true' : null)}
             @dragover=${(e) => dragOver(e, col.id)} @dragleave=${(e) => dragLeave(e, col.id)} @drop=${(e) => dropCard(e, col.id)}>
      <header class="kcol-head">
        <span class="kcol-dot" aria-hidden="true"></span>
        <h2 id=${`kcol-${col.id}`}>${col.name}</h2>
        <span class="kcol-count" aria-label=${() => `${counts[col.id].value} ${counts[col.id].value === 1 ? 'card' : 'cards'}`}>${counts[col.id]}</span>
      </header>
      <ol class="kcol-list">${repeat(lists[col.id], (c) => c.id, cardRow)}</ol>
      ${() => (counts[col.id].value ? null : html`
        <p class=${() => `kcol-empty${dropColumn(col.id) ? ' over' : ''}`}>${filtering.value ? 'No cards here match the filters.' : col.empty}</p>`)}
      <div class="kcol-foot">${() => (adding.value === col.id ? addForm(col) : html`
        <button class="kcol-add" type="button" id=${`kadd-${col.id}`} aria-label=${`Add a card to ${col.name}`}
                @click=${() => (adding.value = col.id)}>${icon('plus')} Add a card</button>`)}</div>
    </section>`;

  return html`
    <section class="kanban">
      <header class="kanban-head">
        <div>
          <h1>Kanban</h1>
          <p class="muted kanban-sub">Pith 1.0 launch · <span class="tabular">${() => board.cards.value.length}</span> cards${() => (overdue.value ? html` · <span class="kdue-count">${overdue.value} overdue</span>` : null)}</p>
        </div>
        <button class="btn ghost" type="button" @click=${resetBoard}>${icon('refresh')} Reset board</button>
      </header>

      <div class="kfilters">
        <div class="kfilter-group" role="group" aria-labelledby="kf-labels">
          <span class="kfilter-title" id="kf-labels">Label</span>
          ${LABELS.map((l) => html`
            <button class="chip kchip" type="button" style=${`--label: var(--label-${l.id})`}
                    aria-pressed=${() => String(labels.value.includes(l.id))} @click=${() => toggleLabel(l.id)}>
              <span class="kchip-dot" aria-hidden="true"></span>${l.name}</button>`)}
        </div>
        <div class="kfilter-group" role="group" aria-labelledby="kf-people">
          <span class="kfilter-title" id="kf-people">Person</span>
          ${PEOPLE.map((p) => html`
            <button class="chip kchip person" type="button" aria-label=${p.name} aria-pressed=${() => String(who.value === p.id)} @click=${() => toggleWho(p.id)}>
              ${avatar(p, 'avatar xs')}${p.name.split(' ')[0]}</button>`)}
        </div>
        <div class="kfilter-status">${() => (filtering.value && !noMatch.value ? html`
          <p class="muted note" aria-live="polite">${() => `Showing ${visible.value.length} of ${board.cards.value.length} cards`}</p>
          <button class="btn ghost kclear" type="button" @click=${clearFilters}>${icon('close')} Clear filters</button>` : null)}</div>
      </div>

      ${() => (noMatch.value ? html`
        <div class="kanban-none card">
          <span class="icon-tile">${icon('filter')}</span>
          <h2>No cards match these filters</h2>
          <p class="muted">Nothing has ${labels.value.length ? `the label${labels.value.length > 1 ? 's' : ''} ${labels.value.map(labelName).join(' or ')}` : 'that'}${who.value ? `${labels.value.length ? ' and is' : ''} assigned to ${person(who.value)?.name}` : ''}.</p>
          <button class="btn primary" type="button" @click=${clearFilters}>Clear filters</button>
        </div>` : null)}

      <div class="board" ?hidden=${noMatch}>${COLUMNS.map(column)}</div>
      <p class="muted note kanban-tip" ?hidden=${noMatch}>Drag cards between columns, or tab to a card and use its arrow buttons (Alt + arrow keys work too). Click a title to edit it.</p>
      <p class="sr-only" role="status" aria-live="polite">${said}</p>
    </section>
  `;
}
