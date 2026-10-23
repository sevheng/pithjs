// "Mini, fine-grained rows": the same app, but each row's label is a signal, so "update every 10th row"
// writes 100 labels in place (100 text nodes change) instead of replacing 100 row objects (which repeat()
// rebuilds). The pattern for a big list whose rows change often; see framework/README.md, Lists.
import { html, repeat, signal, root, selector, batch } from 'mini';
import { buildData } from './data.js'; // the same file as bench/mini (tools/server.mjs serves it)

const rowsOf = (n) => buildData(n).map((r) => ({ id: r.id, label: signal(r.label) }));

const rows = signal([]);
const selected = signal(0);
const isSelected = selector(selected); // a click re-renders the 2 rows that changed, not all 1,000

const run = () => {
  rows.value = rowsOf(1000);
  selected.value = 0;
};
const runLots = () => {
  rows.value = rowsOf(10000);
  selected.value = 0;
};
const add = () => (rows.value = [...rows.value, ...rowsOf(1000)]);
const update = () => batch(() => rows.value.forEach((r, i) => i % 10 === 0 && (r.label.value += ' !!!')));
const clear = () => {
  rows.value = [];
  selected.value = 0;
};
const swapRows = () => {
  if (rows.value.length <= 998) return;
  const next = rows.value.slice();
  [next[1], next[998]] = [next[998], next[1]];
  rows.value = next;
};
const remove = (id) => (rows.value = rows.value.filter((r) => r.id !== id));

root(() => {
  document.getElementById('app').replaceChildren(html`
    <main class="page">
      <section class="section">
        <h1>Benchmark</h1>
        <div class="bench-buttons">
          <button id="run" class="btn" type="button" @click=${run}>Create 1,000 rows</button>
          <button id="runlots" class="btn" type="button" @click=${runLots}>Create 10,000 rows</button>
          <button id="add" class="btn" type="button" @click=${add}>Append 1,000 rows</button>
          <button id="update" class="btn" type="button" @click=${update}>Update every 10th row</button>
          <button id="clear" class="btn" type="button" @click=${clear}>Clear</button>
          <button id="swaprows" class="btn" type="button" @click=${swapRows}>Swap rows</button>
        </div>
        <table class="bench-table">
          <tbody>
            ${repeat(rows, (r) => r.id, (r) => html`
              <tr class=${() => (isSelected(r.id) ? 'selected' : '')}>
                <td class="col-id">${r.id}</td>
                <td class="col-label"><a class="lbl" @click=${() => (selected.value = r.id)}>${r.label}</a></td>
                <td><a class="remove" aria-label="Remove" @click=${() => remove(r.id)}>×</a></td>
              </tr>
            `)}
          </tbody>
        </table>
      </section>
    </main>
  `);
});
