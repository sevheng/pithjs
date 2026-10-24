import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

export default () => html`
  <section aria-labelledby="make-a-store">
    <h2 id="make-a-store">Make a store</h2>
    <p>
      A store is a set of signals that several pages or components share. ${c('createStore(initial)')} turns
      each key of ${c('initial')} into a signal holding that starting value. Put it in ${c('app/store.js')} and
      import it wherever it's needed.
    </p>
    ${code(`import { createStore } from 'pith';

// Saved to localStorage under "todos-app", and restored on the next visit.
export const todos = createStore({ items: [], filter: 'all' }, { persist: 'todos-app' });

// Not saved: a reload starts it again. \`name\` labels it in npm run see --state.
export const session = createStore({ user: null }, { name: 'session' });`, { file: 'app/store.js' })}
    <p>
      Why a store and not a module-level ${c('signal()')}: you get saving, tab syncing and a readable name in
      ${c('--state')} output in one call, and every shared value lives in one file.
    </p>
  </section>

  <section aria-labelledby="read-and-write">
    <h2 id="read-and-write">Read and write</h2>
    <p>
      Each key is an ordinary signal. Read ${c('store.key.value')} (in a template hole it updates in place)
      and assign to it to change it. Everything that shows it updates.
    </p>
    ${code(`import { html } from 'pith';
import { todos } from '../store.js';

const add = (text) => {
  todos.items.value = [...todos.items.value, { id: crypto.randomUUID(), text, done: false }];
};
const clearDone = () => {
  todos.items.value = todos.items.value.filter((t) => !t.done);
};

html\`<p>\${() => todos.items.value.length} to do</p>
  <button class="btn" @click=\${clearDone}>Clear finished</button>\`;`)}
    ${note(html`Changing an array or object in place (${c('todos.items.value.push(item)')}) changes nothing on
      screen and isn't saved: a signal only notices a new value. Build a new array or object and assign it.`, 'warn')}
  </section>

  <section aria-labelledby="saving">
    <h2 id="saving">Saving to localStorage</h2>
    <p>
      With ${c("{ persist: 'key' }")} the whole store is written to ${c('localStorage')} under that key every
      time one of its signals changes, and read back when the store is made. A key the saved data doesn't have
      starts at its initial value, so adding a key to ${c('initial')} later is safe. If storage is full or
      blocked (some private windows), the store keeps working in memory.
    </p>
    <h3>Plain JSON only</h3>
    <p>
      The saved copy is ${c('JSON.stringify')}'d, so only strings, numbers, booleans, null, arrays and plain
      objects come back as they went in. Store a date as an ISO string and a Map or Set as an array.
    </p>
    ${code(`createStore({ lastSeen: new Date() }, { persist: 'app' });                // ✗ W014: comes back as a string
createStore({ lastSeen: new Date().toISOString() }, { persist: 'app' });  // ✓
createStore({ tags: new Set(['a']) }, { persist: 'app' });                // ✗ W014: comes back as {}
createStore({ tags: ['a'] }, { persist: 'app' });                          // ✓`)}
    ${note(html`Dev mode warns with ${c('W014')} when an initial value is a ${c('Date')}, ${c('Map')}, ${c('Set')},
      function or BigInt. It can't see one you assign later, so keep to plain data there too.`, 'warn')}
    ${note(html`Saved values come back as they were, even if your code now expects another shape. When you change
      what a key holds, change the ${c('persist')} key too (${c("'todos-app-v2'")}), so old data is left behind.`)}
  </section>

  <section aria-labelledby="tabs">
    <h2 id="tabs">Kept in step across tabs</h2>
    <p>
      A persisted store follows the user's other tabs of the same site by itself. When another tab saves the
      store, this tab's signals take the new values and the page updates, with no reload and no code from you.
      Keys missing from the other tab's save go back to their initial values, and clearing ${c('localStorage')}
      resets the store. Try it above: open this page in a second tab and type in the note.
    </p>
    <p>
      There is no loop between tabs: the browser only tells the <em>other</em> tabs about a save, and a save
      that changes nothing tells no one.
    </p>
  </section>

  <section aria-labelledby="which">
    <h2 id="which">Store, signal or URL?</h2>
    <p>Put each piece of state where it's used, and no wider:</p>
    <ul>
      <li><strong>A signal in the component or page</strong> for state only that view needs: a draft, an open
        menu, the selected tab. It goes away with the view, which is what you want.</li>
      <li><strong>The URL</strong> (${c('router.query')}, ${c('router.setQuery()')}) for what a person would
        expect a link or a reload to keep: a search, filters, sorting, the page number.</li>
      <li><strong>A store</strong> for state several pages share (who is signed in, a cart), or that should
        survive a reload but doesn't belong in a link (a theme, a board's cards). Add ${c('persist')} only when it
        should outlive the tab.</li>
      <li><strong>The server</strong>, through ${c('resource()')}, for data the server owns. Don't copy it into a
        store; load it where it's shown.</li>
    </ul>
  </section>

  <section aria-labelledby="store-api">
    <h2 id="store-api">API</h2>
    ${api([
      ['createStore(initial, options?)', html`Returns an object with a signal for each key of ${c('initial')}.`],
      ["options.persist: 'key'", html`Save to ${c('localStorage')} under this key, restore on load, and follow other tabs. Default: not saved.`],
      ["options.name: 'label'", html`What ${c('npm run see --state')} calls the store. Default: the persist key, else "store".`],
      ['store.key.value', 'Read or assign the value. Assign a new array or object; changes in place are missed.'],
      ['store.key.peek()', 'Read without subscribing (it is an ordinary signal).'],
    ])}
  </section>
`;
