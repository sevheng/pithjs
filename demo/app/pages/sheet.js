import { html, signal, computed, effect, batch, onCleanup } from 'pith';
import { router } from '../router.js';
import { icon } from '../icons.js';
import { confirm, toast } from '../ui.js';
import { sheetView } from '../sheet/grid.js';
import { ROWS } from '../sheet/formula.js';
import { edit, rawOf, counter, filled, demoData, clearing, canUndo, canRedo } from '../sheet/model.js';

// /sheet: a 1,000-row spreadsheet, and the stress test for Pith's signals. Each cell is a signal (what's typed)
// and a computed (its value) that reads the cells its formula uses (app/sheet/model.js). The tools in the bar
// time what an edit costs: Edit A1 changes the top of a 1,000-deep chain of running totals, and Random edits
// changes cells many times a second.

/** How often Random edits edits: edits a second. */
const RATES = /** @type {const} */ ([10, 100, 1000]);

const n = (/** @type {number} */ x) => x.toLocaleString('en-US');
const ms = (/** @type {number} */ x) => (x < 0.1 ? '<0.1' : x < 10 ? x.toFixed(1) : String(Math.round(x)));
/** The next frame has been drawn (a frame, then a task after it). */
const painted = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));

export default function SheetPage() {
  const status = signal('');
  const view = sheetView({ onStatus: (text) => (status.value = text) });
  const empty = computed(() => filled.value === 0);

  // ---------- Edit A1: one edit at the top of the chain, timed ----------
  const lastEdit = signal(/** @type {{ cells: number, sync: number, screen: number | null } | null} */ (null));
  const editA1 = async () => {
    view.commit();
    const now = Number(rawOf('A1'));
    const next = String(Number.isFinite(now) && rawOf('A1') !== '' ? now + 100 : 1);
    const before = counter.recomputed;
    const t = performance.now();
    edit([['A1', next]], { undo: false });
    const sync = performance.now() - t;
    const cells = counter.recomputed - before;
    lastEdit.value = { cells, sync, screen: null };
    await painted(); // (a headless browser may never draw: then this line just stays as it is)
    if (lastEdit.peek()?.cells === cells) lastEdit.value = { cells, sync, screen: performance.now() - t };
  };

  // ---------- Random edits: many a second, one batch each frame ----------
  const rate = signal(/** @type {0 | typeof RATES[number]} */ (0));
  /** Measured over the last second. */
  const stats = signal(/** @type {{ edits: number, cells: number, avg: number, worst: number } | null} */ (null));
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647);
  effect(() => {
    const perSec = rate.value;
    if (!perSec) return;
    let owed = 0;
    let last = performance.now();
    let since = last;
    let edits = 0, cells = 0, spent = 0, ticks = 0, worst = 0;
    const id = setInterval(() => {
      const t = performance.now();
      owed += ((t - last) / 1000) * perSec;
      last = t;
      const k = Math.floor(owed);
      owed -= k;
      if (k) {
        /** @type {[string, string][]} */
        const changes = [];
        for (let i = 0; i < k; i++) {
          const row = 2 + Math.floor(rand() * (ROWS - 1)); // an income or a cost, in any month
          changes.push([`${rand() < 0.5 ? 'A' : 'B'}${row}`, String(Math.round(2600 + rand() * 3400))]);
        }
        const before = counter.recomputed;
        batch(() => edit(changes, { undo: false })); // all of this frame's edits, then each cell once
        const took = performance.now() - t;
        edits += k;
        cells += counter.recomputed - before;
        spent += took;
        ticks += 1;
        worst = Math.max(worst, took);
      }
      if (t - since >= 1000) {
        const secs = (t - since) / 1000;
        stats.value = { edits: Math.round(edits / secs), cells: Math.round(cells / secs), avg: ticks ? spent / ticks : 0, worst };
        since = t;
        edits = cells = spent = ticks = worst = 0;
      }
    }, 16);
    return () => {
      clearInterval(id);
      stats.value = null;
    };
  });
  // Hidden tab: stop (the timer would pile up edits for nobody).
  const onHide = () => document.hidden && (rate.value = 0);
  document.addEventListener('visibilitychange', onHide);
  onCleanup(() => document.removeEventListener('visibilitychange', onHide));

  const readout = () => {
    if (rate.value) {
      const s = stats.value;
      return s
        ? `${n(s.edits)} edits/s · ${n(s.cells)} cells recomputed/s · ${ms(s.avg)} ms a frame (worst ${ms(s.worst)})`
        : 'Measuring…';
    }
    const e = lastEdit.value;
    if (e) return `Edit A1: ${n(e.cells)} cells recomputed in ${ms(e.sync)} ms${e.screen === null ? '' : `, on screen in ${ms(e.screen)} ms`}`;
    return empty.value ? 'Fill demo data for a 1,000-row budget, then time an edit.' : 'Time an edit with Edit A1, or start Random edits.';
  };

  // ---------- Filling and clearing (one step of Undo each) ----------
  const fillNow = () => {
    rate.value = 0;
    const data = demoData();
    const before = counter.recomputed;
    const t = performance.now();
    edit([...new Map([...clearing(), ...data])]); // what's there now is cleared, unless the demo writes it
    const took = performance.now() - t;
    lastEdit.value = null;
    status.value = `Filled ${n(data.length)} cells (${n(counter.recomputed - before)} values worked out) in ${ms(took)} ms`;
    view.go(0, 0);
  };
  const fill = async () => {
    view.commit();
    if (!empty.peek() && !(await confirm('Replace the sheet with the demo budget?', { ok: 'Replace' }))) return;
    fillNow();
    view.focusGrid();
  };
  // /sheet?demo opens with the budget (a link from the docs), but never over a sheet that has something in it.
  if (router.query.value.demo !== undefined) {
    // After setup: cells made during it would be listed as this page's state (npm run see --state).
    if (empty.peek()) queueMicrotask(fillNow);
    router.setQuery({ demo: null });
  }
  const clear = async () => {
    view.commit();
    if (!(await confirm('Clear every cell?', { ok: 'Clear sheet', cancel: 'Keep cells', danger: true }))) return;
    rate.value = 0;
    edit(clearing());
    lastEdit.value = null;
    toast('Sheet cleared. Undo brings it back.');
    view.go(0, 0);
  };

  return html`
    <div class="sheet">
      <header class="sheet-bar card">
        <div class="sheet-title">
          <p class="eyebrow">Spreadsheet</p>
          <h1>Budget</h1>
        </div>
        <div class="sheet-tools" role="group" aria-label="Edit">
          <button class="icon-btn" type="button" aria-label="Undo" title="Undo (Ctrl+Z)" ?disabled=${() => !canUndo.value} @click=${view.undo}>${icon('undo')}</button>
          <button class="icon-btn" type="button" aria-label="Redo" title="Redo (Ctrl+Y)" ?disabled=${() => !canRedo.value} @click=${view.redo}>${icon('redo')}</button>
          <button class="btn ghost" type="button" ?disabled=${empty} @click=${clear}>${icon('trash')} Clear</button>
        </div>
        <div class="sheet-stress">
          <button class=${() => (empty.value ? 'btn primary' : 'btn')} type="button" @click=${fill}>Fill demo data</button>
          <button class="btn" type="button" @click=${editA1}>Edit A1</button>
          <div class="segmented" role="group" aria-label="Random edits a second">
            <button type="button" aria-pressed=${() => String(rate.value === 0)} @click=${() => (rate.value = 0)}>Off</button>
            ${RATES.map((r) => html`<button type="button" aria-pressed=${() => String(rate.value === r)} @click=${() => (rate.value = r)}>${n(r)}/s</button>`)}
          </div>
          <p class="muted note sheet-readout">${readout}</p>
        </div>
      </header>
      ${view.formulaBar}
      ${() => (empty.value ? html`<p class="notice sheet-empty">The sheet is empty. Click a cell and type a number, text, or a formula like
        <code>=A1*2</code>, or <strong>Fill demo data</strong> for a 1,000-row budget.</p>` : null)}
      <div class="sheet-frame card">${view.grid}</div>
      <p class="muted note sheet-help"><span role="status">${status}</span>
        <span class="sheet-keys">Arrows move, Shift+arrows select, Enter or F2 edits, Escape cancels, Tab saves and moves right.
        Ctrl+Z undoes, Ctrl+C and Ctrl+V copy and paste a range. Saved in this browser.</span></p>
    </div>
  `;
}
