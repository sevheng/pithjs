import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const warning = (id) => html`<a href=${`/docs/warnings#${id.toLowerCase()}`}>${id}</a>`;

const basics = `
import { html, signal, computed } from 'pith';

const count = signal(0);
const double = computed(() => count.value * 2);

count.value;    // 0: read it
count.value++;  // write it: everything that shows count updates
double.value;   // 2: computed values update by themselves

html\`<p>\${count} × 2 = \${double}</p>\`;`;

const holes = `
html\`<p>\${count}</p>\`;                  // ✓ the signal itself: updates
html\`<p>\${() => count.value * 2}</p>\`;  // ✓ a function: re-runs when count changes
html\`<p>\${count.value}</p>\`;            // ✗ a number, read once: never updates`;

const snapshot = `
// ✗ label is a plain string, made once
const label = \`\${count.value} items\`;
html\`<p>\${label}</p>\`;

// ✓ a function is read again whenever count changes
const label = () => \`\${count.value} items\`;
html\`<p>\${label}</p>\`;`;

const computedEx = `
const todos = signal([{ id: 1, text: 'Butter', done: true }, { id: 2, text: 'Jam', done: false }]);
const left = computed(() => todos.value.filter((t) => !t.done).length);

html\`<p>\${left} left</p>\`;`;

const effectEx = `
import { signal, effect } from 'pith';

const theme = signal(localStorage.theme ?? 'light');

const stop = effect(() => {
  document.documentElement.dataset.theme = theme.value; // runs now, then on every change
});
stop(); // later, if you need it to end`;

const effectCleanup = `
const room = signal('general');

effect(() => {
  const socket = new WebSocket(\`/chat/\${room.value}\`);
  return () => socket.close(); // runs before the next run, and when the effect stops
});`;

const loop = `
effect(() => { count.value = count.value + 1; }); // ✗ E003: writes what it reads, forever
const next = computed(() => count.value + 1);    // ✓ derive it instead`;

const batchEx = `
import { batch } from 'pith';

batch(() => {
  first.value = 'Ann';
  last.value = 'Lee';
}); // effects that read both run once, after the batch, not twice`;

const untrackEx = `
import { effect, untrack } from 'pith';

effect(() => {
  // Re-runs when query changes, but not when pageSize does.
  console.log('search', query.value, untrack(() => pageSize.value));
});

count.peek(); // the same for one signal: read without subscribing`;

const rootEx = `
import { root, effect } from 'pith';

const dispose = root((dispose) => {
  effect(() => console.log(count.value));
  effect(() => console.log(name.value));
  return dispose;
});
dispose(); // stops both effects`;

const cleanupEx = `
import { effect, onCleanup } from 'pith';

effect(() => {
  const id = setInterval(() => console.log(room.value), 1000);
  onCleanup(() => clearInterval(id)); // same as returning it
});`;

const catchEx = `
import { catchError, effect } from 'pith';

catchError(() => {
  effect(() => {
    if (price.value < 0) throw new Error('Bad price');
    total.value = price.value * qty.value;
  });
}, (err) => {
  problem.value = err.message; // instead of an uncaught error
});`;

export default () => html`
  <p>A <strong>signal</strong> holds a value. When you put it in a template, Pith remembers exactly which
    text or attribute shows it. Change the value and only that spot updates: no re-render of the page or
    the component, no diffing. Everything else in Pith (the store, data loading, forms, the router's
    <code>?query</code>) is built from signals, so this page is the base for the rest.</p>

  <h2 id="signal">Signals and computed values</h2>
  <p>${c('signal(initial)')} makes one. Read and write it through ${c('.value')}.
    ${c('computed(fn)')} derives a value from other signals and keeps it up to date.</p>
  ${code(basics)}
  <p>Use a computed for anything you can work out from other state: a count, a filtered list, a total.
    Storing it in its own signal means keeping two values in step by hand, which is how bugs start.</p>
  ${code(computedEx)}
  <p>Writing the same value again does nothing (it's compared with ${c('Object.is')}), so nothing re-runs.</p>

  <h2 id="holes">Putting a signal in a template</h2>
  <p>A hole updates only when it is <strong>the signal itself, or a function</strong>. Pith calls the function,
    notes which signals it read, and calls it again when one of them changes.</p>
  ${code(holes)}
  ${note(html`${c('${count.value}')} reads the value once, while the template is built. The page shows
    the number it had then and never changes. Pass ${c('count')}, or wrap the expression:
    ${c('${() => count.value + 1}')}.`, 'warn')}
  <p>The same goes for values you build in JavaScript before the template:</p>
  ${code(snapshot)}
  <p>A signal or function only updates when it's the <em>whole</em> hole. Inside an array, or returned from
    another function, it isn't rendered (${warning('W003')}): write ${c('${count} items')}, not
    ${c("${[count, ' items']}")}.</p>

  <h2 id="arrays">Arrays and objects</h2>
  <p>A signal notices a new value, not a change inside the old one. Replace arrays and objects instead of
    changing them:</p>
  ${code(`
todos.value = [...todos.value, newTodo];               // ✓ a new array
todos.value = todos.value.filter((t) => t.id !== id); // ✓
user.value = { ...user.value, name: 'Ann' };          // ✓ a new object

todos.value.push(newTodo);                            // ✗ the same array: nothing updates`)}

  <h2 id="effect">Effects</h2>
  <p>${c('effect(fn)')} runs ${c('fn')} now and again whenever a signal it read changes. Templates already do
    this for you, so you need an effect only to reach <em>outside</em> the page: ${c('document.title')},
    ${c('localStorage')}, a chart library, a log.</p>
  ${code(effectEx)}
  <p>An effect can return a cleanup function. It runs before the next run and when the effect is stopped,
    so timers, sockets and listeners don't pile up.</p>
  ${code(effectCleanup)}
  <p>Effects made inside a component (or a page) stop by themselves when it is removed. Only an effect
    made at the top level of a module lives until you call the function it returned.</p>
  ${note(html`Don't use an effect to copy one signal into another. Use ${c('computed')}. An effect that
    writes a signal it also reads runs itself again and again, and Pith stops it with
    ${warning('E003')}.`, 'warn')}
  ${code(loop)}

  <h2 id="batch">Batching writes</h2>
  <p>Each write runs its effects straight away. When you change several signals at once, wrap the writes in
    ${c('batch(fn)')} so effects that read more than one of them run once, with all the new values.</p>
  ${code(batchEx)}
  <p>Either way, the updates run in order: a computed or effect runs after everything it reads has, once per change,
    so it never sees half an update, and a chain of computeds can be any length. The
    <a href="/docs/spreadsheet">Spreadsheet</a> example leans on this: a chain of running totals 1,000 cells deep.</p>

  <h2 id="untrack">Reading without subscribing</h2>
  <p>${c('untrack(fn)')} reads signals without making the current effect depend on them. For one signal,
    ${c('signal.peek()')} does the same. Use it for a value you need but whose changes shouldn't re-run anything.</p>
  ${code(untrackEx)}

  <h2 id="scopes">Scopes and cleanup</h2>
  <h3>root</h3>
  <p>${c('root(fn)')} gives you a scope you stop yourself. Every effect made inside it stops when you call
    ${c('dispose')}. You rarely need it in app code: components, pages and list rows each have one already.</p>
  ${code(rootEx)}
  <h3>onCleanup</h3>
  <p>${c('onCleanup(fn)')} runs ${c('fn')} when the current effect re-runs, or when the scope it's in
    (a component, a page, a root) goes away. Inside a component, ${c('ctx.onCleanup')} is the same thing.</p>
  ${code(cleanupEx)}

  <h2 id="catch-error">Catching errors</h2>
  <p>${c('catchError(fn, handler)')} runs ${c('fn')} in a scope. Errors thrown by it, or later by effects
    and computed values made inside it, go to ${c('handler(err)')} instead of being thrown. This is what
    components and pages use for their error views; reach for it when you build a boundary of your own.
    A handler that throws passes the error to the next ${c('catchError')} out.</p>
  ${code(catchEx)}
  <p>See <a href="/docs/errors">Error boundaries</a> for what components and pages do with errors.</p>

  <h2 id="api">API</h2>
  ${api([
    ['signal(initial)', html`A value. Read and write ${c('.value')}; ${c('.peek()')} reads without subscribing.`],
    ['computed(fn)', html`A read-only value derived from other signals. ${c('.value')}, ${c('.peek()')}.`],
    ['effect(fn)', html`Runs ${c('fn')} now and when what it read changes. ${c('fn')} may return a cleanup. Returns a function that stops it.`],
    ['batch(fn)', 'Runs the writes in fn, then the affected effects once. Returns fn’s result.'],
    ['untrack(fn)', 'Runs fn and reads its signals without subscribing. Returns fn’s result.'],
    ['root(fn)', html`Runs ${c('fn(dispose)')} in a scope; ${c('dispose()')} stops every effect made inside.`],
    ['onCleanup(fn)', 'Runs fn when the current effect re-runs or its scope is disposed.'],
    ['catchError(fn, handler)', html`Runs ${c('fn(dispose)')}; errors in it or its later effects go to ${c('handler(err)')}.`],
    ['isSignal(x)', html`${c('true')} for a signal or computed.`],
  ])}
`;
