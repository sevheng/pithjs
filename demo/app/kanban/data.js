// The Kanban board's columns, labels, people and first cards (app/pages/kanban.js).

/** @typedef {{ id: string, title: string, description: string, label: string, assignee: string, due: string, column: string }} Card */

export const COLUMNS = [
  { id: 'todo', name: 'To do', empty: 'Nothing waiting. Add the next thing to pick up.' },
  { id: 'doing', name: 'In progress', empty: 'Nobody is on anything. Drag a card here to start it.' },
  { id: 'review', name: 'Review', empty: 'Nothing to review right now.' },
  { id: 'done', name: 'Done', empty: 'Finished cards land here.' },
];

// Each label's color is a token (--label-<id>) in styles/main.css, with a dark-theme value.
export const LABELS = [
  { id: 'bug', name: 'Bug' },
  { id: 'feature', name: 'Feature' },
  { id: 'design', name: 'Design' },
  { id: 'docs', name: 'Docs' },
  { id: 'chore', name: 'Chore' },
];

export const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', color: '#8e44ad' },
  { id: 'grace', name: 'Grace Hopper', color: '#c0392b' },
  { id: 'linus', name: 'Linus Park', color: '#117a65' },
  { id: 'mia', name: 'Mia Chen', color: '#b34700' },
];

export const columnName = (id) => COLUMNS.find((c) => c.id === id)?.name ?? id;
export const labelName = (id) => LABELS.find((l) => l.id === id)?.name ?? id;
export const person = (id) => PEOPLE.find((p) => p.id === id) ?? null;
export const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** A local calendar day as YYYY-MM-DD (what <input type="date"> uses), `offset` days from today. */
export function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** How a due date reads on a card, and whether it's late (a done card is never late). */
export function dueInfo(due, column) {
  if (!due) return null;
  const today = isoDay();
  const [y, m, d] = due.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const short = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (column === 'done') return { text: short, state: 'done' };
  if (due < today) return { text: `Overdue · ${short}`, state: 'overdue' };
  if (due === today) return { text: 'Due today', state: 'soon' };
  if (due === isoDay(1)) return { text: 'Due tomorrow', state: 'soon' };
  return { text: `Due ${short}`, state: 'later' };
}

let made = 0;
/** A new card id: also used in view-transition-name, so letters, digits and dashes only. */
export const newId = () => `k${Date.now().toString(36)}${(made++).toString(36)}`;

/** The board a first visit starts with (due dates relative to that day, so some are late). */
export function seedCards() {
  /** @type {[string, string, string, string, string, number | null, string][]} */
  const rows = [
    ['todo', 'Dark mode for the docs site', 'Follow the system setting, with a toggle in the header. Code blocks need their own palette.', 'design', 'mia', 6, 'c1'],
    ['todo', 'Write the migration guide from 0.x', 'Cover the renamed exports and the new form() helpers. Link every warning code to errors.md.', 'docs', 'ada', 9, 'c2'],
    ['todo', 'Router drops the hash on redirect', 'Going to /old#install lands on /new without #install. Expected: keep the hash.', 'bug', 'linus', -2, 'c3'],
    ['todo', 'Keyboard shortcuts cheat sheet', '', 'feature', '', null, 'c4'],
    ['todo', 'Update the CI Node version to 24', 'Node 22 leaves maintenance soon.', 'chore', 'grace', 12, 'c5'],
    ['doing', 'Paginated tables with sticky headers', 'Header row stays put while the body scrolls; works on phones too.', 'feature', 'ada', 3, 'c6'],
    ['doing', 'Focus jumps to the top after a dialog closes', 'Reported on Safari 18 only. Focus should go back to the button that opened it.', 'bug', 'grace', -1, 'c7'],
    ['doing', 'New empty-state illustrations', 'Five scenes in the line style of the icons, light and dark.', 'design', 'mia', 0, 'c8'],
    ['review', 'Drag and drop on the Kanban demo', 'Native HTML5 drag and drop plus keyboard moves, animated with transition().', 'feature', 'linus', 1, 'c9'],
    ['review', 'Explain fine-grained rows in the README', 'When a row signal is worth its memory, with the benchmark numbers.', 'docs', 'ada', 4, 'c10'],
    ['review', 'Toast colors fail contrast in dark mode', '', 'bug', 'mia', -4, 'c11'],
    ['done', 'Rename Mini to Pith', 'Package, docs, warnings and the demo.', 'chore', 'grace', -6, 'c12'],
    ['done', 'Prerender chat rooms at build time', '', 'feature', 'linus', -3, 'c13'],
    ['done', 'Pricing page layout', 'Three plans, the middle one featured.', 'design', '', -8, 'c14'],
  ];
  return rows.map(([column, title, description, label, assignee, due, id]) => ({
    id, title, description, label, assignee, due: due === null ? '' : isoDay(due), column,
  }));
}

/**
 * The cards with one card moved: to `column`, just before the card `before` (or after `after`), or to the
 * end of that column. The order of the array is the order in each column.
 * @param {Card[]} cards @param {string} id @param {string} column
 * @param {{ before?: string | null, after?: string | null }} [at]
 */
export function place(cards, id, column, { before = null, after = null } = {}) {
  const card = cards.find((c) => c.id === id);
  if (!card || id === before || id === after) return cards;
  const rest = cards.filter((c) => c.id !== id);
  const moved = card.column === column ? card : { ...card, column };
  let index;
  if (before) index = rest.findIndex((c) => c.id === before);
  else if (after) index = rest.findIndex((c) => c.id === after) + 1;
  else {
    const last = rest.findLastIndex((c) => c.column === column);
    index = last === -1 ? rest.length : last + 1;
  }
  if (index < 0) index = rest.length;
  return [...rest.slice(0, index), moved, ...rest.slice(index)];
}
