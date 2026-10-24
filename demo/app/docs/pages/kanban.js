import { html } from 'pith';
import { code, note, c } from '../ui.js';

export default () => html`
  <p>A project board with four columns. Cards have a label, a person and a due date, and you move them by drag and
    drop, with buttons, or with the keyboard. The board is saved in your browser, so it survives a reload and
    follows changes you make in another tab. There's no server: the whole app is one page and a store.</p>

  <h2 id="try">What to try</h2>
  <ul>
    <li>Drag a card to another column, or between two cards in the same one. A line shows where it will land.</li>
    <li>Tab to a card and use its arrow buttons, or hold Alt and press an arrow key. Focus stays on the card, and a
      screen reader hears where it went ("now 2 of 5").</li>
    <li>Click "Add a card" and press Add card with no title: it says what's missing. Escape closes the form.</li>
    <li>Click a card's title to edit it in a dialog. Change its column there, or delete it (it asks first).</li>
    <li>Filter by a label or two and a person. The filters go into the URL (${c('?label=bug&label=docs&who=ada')}), so a
      reload or a shared link keeps them. Pick filters nothing matches to see "No cards match these filters".</li>
    <li>Reload the page: the board is as you left it. Open it in a second tab and move a card in one: the other follows.</li>
    <li>"Reset board" puts back the 14 cards it started with, after asking.</li>
  </ul>

  <h2 id="built">How it's built</h2>
  <ul>
    <li>${c('app/pages/kanban.js')}: the whole board. Filters from the URL, the columns, moving cards (by drag and drop,
      buttons and keys), the add form, the edit dialog and the announcements for screen readers.</li>
    <li>${c('app/kanban/state.js')}: the store, saved in localStorage. It lives here and not in ${c('app/store.js')}, so its
      seed cards download only with the board.</li>
    <li>${c('app/kanban/data.js')}: the columns, labels and people, the seed cards, due-date wording, and ${c('place()')},
      which returns the cards with one card moved. The order of the array is the order in each column.</li>
  </ul>

  <h2 id="pith">The Pith parts it uses</h2>
  <ul>
    <li><a href="/docs/store">Shared state</a>: ${c('createStore()')} with ${c('persist')}, saved and kept in step across tabs.</li>
    <li><a href="/docs/lists">Lists</a>: one ${c('repeat()')} per column, keyed by card id, so a move moves one row.</li>
    <li><a href="/docs/selector">Selecting a row</a>: ${c('selector()')} for the card being dragged and where it would drop.</li>
    <li><a href="/docs/animation">Animation</a>: ${c('transition()')} animates every move, add and delete.</li>
    <li><a href="/docs/forms">Forms</a>: ${c('form()')} for adding a card and for the edit dialog.</li>
    <li><a href="/docs/dialogs">Dialogs and toasts</a>: the edit ${c('dialog()')}, ${c('confirm()')} before deleting or resetting, and toasts.</li>
    <li><a href="/docs/router">Routing</a>: the filters in the ${c('?query')}, read with ${c('router.queryAll()')}.</li>
  </ul>

  <h2 id="code">The interesting parts</h2>
  <h3 id="code-store">A board that saves itself</h3>
  ${code(`
// The Kanban board, saved in localStorage: it survives a reload and follows changes made in other tabs.
// Here, not in app/store.js, so its seed cards download only with the board page.
export const board = createStore({ cards: seedCards() }, { persist: 'pith-kanban' });`, { file: 'app/kanban/state.js' })}

  <h3 id="code-filters">Filters in the URL</h3>
  <p>A repeated key (${c('?label=a&label=b')}) is read with ${c('router.queryAll()')} and written as an array. Values that
    aren't a real label or person are dropped, so a bad link shows the whole board.</p>
  ${code(`
const labels = computed(() => router.queryAll('label').filter((id) => LABELS.some((l) => l.id === id)));
const who = computed(() => (PEOPLE.some((p) => p.id === router.query.value.who) ? router.query.value.who : ''));
// …
const toggleLabel = (id) => {
  const now = labels.value;
  router.setQuery({ label: now.includes(id) ? now.filter((x) => x !== id) : [...now, id] });
};`, { file: 'app/pages/kanban.js' })}

  <h3 id="code-move">Every move, animated</h3>
  <p>Drag and drop, the buttons, the keys, adding and deleting all end in ${c('commit()')}: it sets the cards inside
    ${c('transition()')}, then focuses the moved card again. Each card has its own ${c('view-transition-name')}.</p>
  ${code(`
/** Put the cards in their new order, animated; then focus the moved card again (its row may be new). */
const commit = (/** @type {Card[]} */ next, focusId = '', dir = '') => transition(() => {
  board.cards.value = next;
  if (!focusId) return;
  // …
});`, { file: 'app/pages/kanban.js' })}
  ${note(html`Drag and drop alone leaves out keyboard and screen reader users. The Move buttons, Alt + arrow keys and the
    live region that says where a card went are what make the board usable without a mouse.`)}

  <h2 id="tests">Its tests</h2>
  <p>In ${c('tests/flows.js')}:</p>
  <ul>
    <li>kanban: the board shows its columns, counts, labels and overdue cards</li>
    <li>kanban: an empty title is refused, a new card is added to its column</li>
    <li>kanban: a card moves by keyboard, between and within columns</li>
    <li>kanban: edit a card in its dialog</li>
    <li>kanban: filter by label and person, kept in the URL, then clear</li>
    <li>kanban: delete a card, after confirming</li>
    <li>kanban: the board survives a reload</li>
    <li>kanban: drag and drop events move a card to the top of a column, or to the end of another</li>
  </ul>
`;
