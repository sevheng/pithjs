import { html, signal, selector } from 'pith';

// Marking the selected row: with selector(), a click re-runs only the 2 rows whose answer changed.
// Comparing in every row (selected.value === id) re-runs all of them. The counter shows how many ran.
export default function SelectorExample() {
  const ids = Array.from({ length: 100 }, (_, i) => i + 1);
  const selected = signal(0);
  const isSelected = selector(selected);
  const naive = signal(false);
  const reran = signal(0);
  let runs = 0;

  const rowClass = (id) => () => {
    runs++;
    const on = naive.value ? selected.value === id : isSelected(id);
    return on ? 'grid-cell selected' : 'grid-cell';
  };
  const pick = (id) => {
    runs = 0;
    selected.value = id;
    reran.value = runs;
  };

  return html`
    <div class="row">
      <label class="check-label"><input type="checkbox" .checked=${naive}
        @change=${(e) => (naive.value = e.target.checked)}> Compare in every row instead</label>
      <p class="muted" aria-live="polite">Rows re-run by the last click: <strong>${reran}</strong> of ${ids.length}</p>
    </div>
    <div class="cell-grid">
      ${ids.map((id) => html`<button type="button" class=${rowClass(id)} @click=${() => pick(id)}>${id}</button>`)}
    </div>
  `;
}
