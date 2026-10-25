import { html, signal, computed, repeat, selector, root } from 'pith';
import { ROWS, COLS, cellId, colName, parseId } from '../../../shared/sheet/formula.js';
import { demoData, nextA1, randomEdits } from '../../../shared/sheet/demo-data.js';
import { look, summaryText, SUMMARY, ROW_H, COL_W, HEAD_W, OVERSCAN } from '../../../shared/sheet/display.js';
import { edit, clearing, rawOf, valueOf, rawSignal } from './model.js';

// The Spreadsheet in Pith (spec/sheet.md). Each cell is a signal and a computed (model.js); the grid draws the
// rows in view, and each drawn cell's text and class follow its computed, so an edit updates just the cells
// whose values changed.

// ---------- The window: which rows are in view ----------
const top = signal(0);
const height = signal(600); // until it's measured
/** @type {HTMLElement | null} */
let box = null;
// A string, so scrolling within a row changes nothing downstream (a computed only passes on a new value).
const span = computed(() => {
  const first = Math.max(0, Math.floor(top.value / ROW_H) - OVERSCAN);
  const last = Math.min(ROWS - 1, Math.ceil((top.value + height.value) / ROW_H) + OVERSCAN);
  return `${first}:${last}`;
});
const rows = computed(() => {
  const [first, last] = span.value.split(':').map(Number);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
});
const measure = (/** @type {HTMLElement} */ el) => {
  box = el;
  new ResizeObserver(() => ((height.value = el.clientHeight), (top.value = el.scrollTop))).observe(el);
};
const scrollToRow = (/** @type {number} */ r) => {
  if (!box) return;
  box.scrollTop = r * ROW_H;
  top.value = box.scrollTop; // draw the rows now, not when the scroll event comes (a frame later)
};

// ---------- The selected cell and the formula bar ----------
const active = signal({ r: 0, c: 0 });
const activeId = computed(() => cellId(active.value.r, active.value.c));
const isRow = selector(() => active.value.r);
/** What's typed in the formula bar, or null while it shows the cell's own text. */
const draft = signal(/** @type {string | null} */ (null));

const select = (/** @type {MouseEvent} */ e) => {
  const cell = /** @type {HTMLElement} */ (e.target).closest('[data-c]');
  const row = cell?.closest('[data-r]');
  if (!cell || !row) return;
  active.value = { r: Number(row.getAttribute('data-r')), c: Number(cell.getAttribute('data-c')) };
  draft.value = null;
};
const submit = (/** @type {SubmitEvent} */ e) => {
  e.preventDefault();
  const { r, c } = active.peek();
  if (draft.peek() !== null) edit([[activeId.peek(), /** @type {string} */ (draft.peek())]]);
  draft.value = null;
  active.value = { r: Math.min(ROWS - 1, r + 1), c }; // Enter moves down, as in other spreadsheets
};

// ---------- The buttons ----------
const fill = () => edit([...new Map([...clearing(), ...demoData()])]); // what's there is cleared, unless the demo writes it
const editA1 = () => edit([['A1', nextA1(rawOf('A1'))]]);
const clear = () => edit(clearing());

// ---------- Drawing ----------
const colIds = Array.from({ length: COLS }, (_, c) => c);
const cellLook = (/** @type {string} */ id, /** @type {number} */ r) => look(valueOf(id, r));

/** One row, built when it scrolls into view and dropped when it leaves. Its cells update in place. */
const row = (/** @type {number} */ r) => html`
  <div class="sheet-row" role="row" aria-rowindex=${r + 2} data-r=${r} style=${`top: ${r * ROW_H}px`}>
    <div class=${() => (isRow(r) ? 'sheet-rh on' : 'sheet-rh')} role="rowheader">${r + 1}</div>
    ${colIds.map((c) => {
      const id = cellId(r, c);
      return html`<div class=${() => `sheet-cell ${cellLook(id, r).kind}`} role="gridcell" id=${`cell-${id}`} data-c=${c}>${() => cellLook(id, r).text}</div>`;
    })}
  </div>`;

root(() => {
  document.getElementById('app')?.replaceChildren(html`
    <main class="page sheet-page">
      <header class="sheet-bar">
        <div>
          <p class="sheet-eyebrow">Spreadsheet</p>
          <h1>Budget</h1>
        </div>
        <div class="sheet-actions">
          <button id="fill" class="btn primary" type="button" @click=${fill}>Fill demo data</button>
          <button id="edit-a1" class="btn" type="button" @click=${editA1}>Edit A1</button>
          <button id="clear" class="btn ghost" type="button" @click=${clear}>Clear</button>
        </div>
      </header>
      <dl class="sheet-summary">
        ${SUMMARY.map(([id, label]) => {
          const r = /** @type {[number, number]} */ (parseId(id))[0];
          return html`<div class="card"><dt>${label}</dt><dd id=${`sum-${id}`}>${() => summaryText(valueOf(id, r))}</dd></div>`;
        })}
      </dl>
      <form class="sheet-formula card" @submit=${submit}>
        <output class="sheet-name" aria-label="Selected cell">${activeId}</output>
        <span class="sheet-fx" aria-hidden="true">fx</span>
        <label class="sr-only" for="sheet-input">Cell contents</label>
        <input id="sheet-input" class="input" autocomplete="off" spellcheck="false" placeholder="Number, text or =SUM(A1:A3)"
          .value=${() => draft.value ?? rawSignal(activeId.value, active.value.r)}
          @input=${(/** @type {Event} */ e) => (draft.value = /** @type {HTMLInputElement} */ (e.target).value)}>
      </form>
      <div class="sheet-frame card">
        <div class="sheet-scroll" ref=${measure} @scroll=${(/** @type {Event} */ e) => (top.value = /** @type {HTMLElement} */ (e.currentTarget).scrollTop)}>
          <div class="sheet-grid" role="grid" aria-label="Sheet" aria-rowcount=${ROWS + 1} aria-colcount=${COLS + 1}
            style=${`width: ${HEAD_W + COLS * COL_W}px`} @click=${select}>
            <div class="sheet-head" role="rowgroup">
              <div class="sheet-row" role="row" aria-rowindex="1">
                <div class="sheet-corner" role="columnheader"></div>
                ${colIds.map((c) => html`<div class="sheet-ch" role="columnheader">${colName(c)}</div>`)}
              </div>
            </div>
            <div class="sheet-body" role="rowgroup" style=${`height: ${ROWS * ROW_H}px`}>
              ${repeat(rows, (r) => r, row)}
              <div class="sheet-active" aria-hidden="true"
                style=${() => `top: ${active.value.r * ROW_H}px; left: ${HEAD_W + active.value.c * COL_W}px`}></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  `);
});

// For measure.js and the flows (spec/sheet.md).
/** @type {any} */ (window).bench = {
  set: (/** @type {string} */ id, /** @type {string} */ raw) => edit([[id, raw]]),
  fill,
  clear,
  scrollToRow,
  /** @type {(() => void) | null} */
  stopEdits: null,
  start(/** @type {number} */ perSecond) {
    this.stop();
    this.stopEdits = randomEdits(perSecond, edit);
  },
  stop() {
    this.stopEdits?.();
    this.stopEdits = null;
  },
};
