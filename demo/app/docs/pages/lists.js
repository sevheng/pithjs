import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const warning = (id) => html`<a href=${`/docs/warnings#${id.toLowerCase()}`}>${id}</a>`;

const basic = `
import { html, signal, repeat } from 'pith';

const todos = signal([
  { id: 'a1', text: 'Butter', done: false },
  { id: 'b2', text: 'Jam', done: true },
]);

html\`<ul>
  \${repeat(todos, (t) => t.id, (t) => html\`<li>\${t.text}</li>\`)}
</ul>\`;`;

const immutable = `
// Add, remove, reorder: give the signal a new array
todos.value = [...todos.value, { id: crypto.randomUUID(), text, done: false }];
todos.value = todos.value.filter((t) => t.id !== id);
todos.value = [...todos.value].sort((a, b) => a.text.localeCompare(b.text));

// Change one item: a new object for it (its row is rebuilt), the others stay
todos.value = todos.value.map((t) => (t.id === id ? { ...t, done: !t.done } : t));

todos.value.push(item);   // ✗ same array: nothing updates
todos.value[0].done = true; // ✗ same object: nothing updates`;

const keys = `
repeat(todos, (t) => t.id, row)          // ✓ an id from your data
repeat(todos, (t) => todos.value.indexOf(t), row) // ✗ the position: rows get mixed up when one is removed
repeat(todos, (t) => t.text, row)  // ✗ two items can have the same text (W005)
repeat(tags, (tag) => tag, row)    // ✓ for a list of unique strings`;

const oneElement = `
// ✗ W017: a reactive hole at the top of the row, outside any element
(t) => html\`\${() => (t.done ? '✓' : '')}<span>\${t.text}</span>\`

// ✓ one element around the row
(t) => html\`<li>\${() => (t.done ? '✓' : '')}<span>\${t.text}</span></li>\``;

const wrapper = `
html\`<ul>\${() => repeat(todos, …)}</ul>\`;  // ✗ W004: repeat must be the whole hole
html\`<ul>\${repeat(todos, …)}</ul>\`;        // ✓ it already follows the signal

// To hide the whole list, wrap the <ul>:
html\`\${() => (todos.value.length ? html\`<ul>\${repeat(todos, …)}</ul>\` : html\`<p class="empty">Nothing yet</p>\`)}\`;`;

const fine = `
import { signal, batch, repeat, html } from 'pith';

// Each row keeps its label in a signal, so it can change without rebuilding the row.
const rows = signal(data.map((r) => ({ id: r.id, label: signal(r.label) })));

html\`<tbody>\${repeat(rows, (r) => r.id, (r) => html\`<tr><td>\${r.id}</td><td>\${r.label}</td></tr>\`)}</tbody>\`;

// A live update: only those cells change
batch(() => rows.value.forEach((r, i) => i % 10 === 0 && (r.label.value += ' !!!')));

// Adding and removing rows still replaces the array
rows.value = [...rows.value, { id: next++, label: signal('New') }];`;

const animated = `
import { transition } from 'pith';

const remove = (id) => transition(() => (todos.value = todos.value.filter((t) => t.id !== id)));
const shuffle = () => transition(() => (todos.value = [...todos.value].sort(() => Math.random() - 0.5)));

// class="motion" on the list: rows fade in and out, and slide to their new places
html\`<ul class="motion">\${repeat(todos, (t) => t.id, (t) => html\`<li>\${t.text}</li>\`)}</ul>\``;

export default () => html`
  <p>${c('repeat(items, key, row)')} renders a list that changes. It remembers each row's DOM by its key.
    When the list changes, rows whose item is still there are kept, new ones are built, and gone ones are
    removed. Rows that moved are moved, not rebuilt, so focus, text being typed and scroll positions survive.</p>

  <h2 id="repeat">Rendering a list</h2>
  <p>Pass the list (a signal, a function, or a plain array), a function that gives each item's key, and a
    function that builds one row.</p>
  ${code(basic)}
  <p>${c('repeat()')} must be the whole hole, and it already follows the signal. Don't wrap it in a function
    (${warning('W004')}):</p>
  ${code(wrapper)}

  <h2 id="keys">Keys</h2>
  <p>The key tells Pith which row is which. It must be <strong>unique</strong> and <strong>stable</strong>:
    the same item gets the same key every time. Use an id from your data, or make one when the item is
    created with ${c('crypto.randomUUID()')}.</p>
  ${code(keys)}
  ${note(html`Two items with the same key: the second one is skipped and its row goes missing
    (${warning('W005')}). Don't use the array index either; when a row is removed, every row after it
    gets another item's key.`, 'warn')}

  <h2 id="updates">Updating the list</h2>
  <p>Write a new array to the signal. A signal only notices a new value, so changing the array (or an item)
    in place updates nothing.</p>
  ${code(immutable)}
  <p>A row is built once from its item. When an item is replaced by a new object (${c('{ ...t, done: true }')}),
    its row is rebuilt from the new one. The other rows are kept untouched. That's right for most lists.</p>

  <h2 id="moves">How rows move</h2>
  <p>When the order changes, Pith finds the longest run of rows that are already in the right order and
    leaves those where they are; only the others move. Swapping two rows of 1,000 moves 2 rows. Where the
    browser has it, Pith moves rows with ${c('moveBefore')}, so a focused input in a moved row stays focused.
</p>

  <h2 id="one-element">A row is one element</h2>
  <p>Give each row a single outer element (${c('<li>')}, ${c('<tr>')}, a card). A reactive hole at the
    top of a row, outside any element, adds its content next to the row's own nodes, and that content would
    stay on the page after the row is removed (${warning('W017')}).</p>
  ${code(oneElement)}

  <h2 id="fine-grained">Rows that change often</h2>
  <p>For a <strong>big list whose rows change often</strong> (a live table, a feed of prices), rebuilding a
    row for each change adds up. Make the field that changes a signal, and write to it in place:</p>
  ${code(fine)}
  <p>The <a href="/docs/trading">Trading</a> example's watchlist is written this way. Measured against the same
    screen in React and Vue (<a href="/docs/benchmarks?view=trade">Benchmarks</a>), when 10 of 1,000 prices tick
    Pith updates the page in 2.8 ms, React in 8.1 and Vue in 3.2. But each row now holds its signals and effects:
    the 1,000-row watchlist takes 8.4 MB, against React's 5.6.</p>
  ${note(html`Don't make every field a signal by default. Use it for the fields that change, in lists that are
    big and busy. For everything else, replace the item and let its row be rebuilt.`)}

  <h2 id="transitions">Animating changes</h2>
  <p>Put ${c('class="motion"')} on the list and wrap the change in ${c('transition()')}. The browser fades in
    rows that arrived, fades out rows that left and slides rows that moved. With reduced motion, or in a browser
    without View Transitions, the change just happens. Try "Shuffle" above.</p>
  ${code(animated)}
  <p>More in <a href="/docs/animation">Animation</a>.</p>

  <h2 id="api">API</h2>
  ${api([
    ['repeat(items, key, row)', html`A keyed list. ${c('items')}: a signal, a function or an array. Must be the whole ${c('${}')} hole (W004).`],
    ['key(item)', 'A unique, stable string or number per item (W005). Not the index.'],
    ['row(item)', 'Builds one row, once per key. One outer element (W017). A new item object rebuilds its row.'],
    ['transition(update)', 'Runs update with a View Transition, so removed rows fade and moved rows slide.'],
  ])}
`;
