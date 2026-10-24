import { html, signal, computed, repeat, selector, untrack, onCleanup } from 'pith';
import { ROWS, COLS, cellId, colName } from './formula.js';
import { look, rawSignal, rawOf, edit, undo, redo } from './model.js';

// The grid: 1,000 rows × 26 columns in a scroll box of its own, drawn windowed (only the rows in view, plus a
// few above and below), with the keyboard, the mouse, editing, copy and paste. Pith has no virtual scrolling
// in its core: windowed() below is the whole of it, written in the app.

export const ROW_H = 32; // px: every row is this tall, so a row's place is its index × ROW_H
export const COL_W = 112;
export const HEAD_W = 52; // the row numbers
export const HEAD_H = 32; // the column letters (sticky, over the rows)

/**
 * Which of `count` rows, each `rowHeight` tall, are in view in a scroll box, plus `overscan` rows each side.
 * `offset`: what's above the first row inside the box (a sticky header). Give the box ref=${win.ref}.
 * @param {{ count: number, rowHeight: number, offset?: number, overscan?: number }} options
 */
export function windowed({ count, rowHeight, offset = 0, overscan = 6 }) {
  const top = signal(0);
  const height = signal(800); // until it's measured
  /** @type {HTMLElement | null} */
  let box = null;
  // A string, so scrolling within a row changes nothing downstream (a computed only passes on a new value).
  const span = computed(() => {
    const first = Math.max(0, Math.floor((top.value - offset) / rowHeight) - overscan);
    const last = Math.min(count - 1, Math.ceil((top.value + height.value - offset) / rowHeight) + overscan);
    return `${first}:${last}`;
  });
  const rows = computed(() => {
    const [first, last] = span.value.split(':').map(Number);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  });
  const ref = (/** @type {HTMLElement} */ el) => {
    box = el;
    const measure = () => ((height.value = el.clientHeight), (top.value = el.scrollTop));
    el.addEventListener('scroll', () => (top.value = el.scrollTop), { passive: true });
    const seen = new ResizeObserver(measure);
    seen.observe(el);
    onCleanup(() => seen.disconnect());
  };
  /** Is row i drawn now? */
  const drawn = (/** @type {number} */ i) => {
    const [first, last] = span.value.split(':').map(Number);
    return i >= first && i <= last;
  };
  /** Scroll the box (as little as possible) so row i is in full view below the header. */
  const reveal = (/** @type {number} */ i) => {
    if (!box) return;
    const y = i * rowHeight; // from the top of the rows
    if (y < box.scrollTop) box.scrollTop = y;
    else if (offset + y + rowHeight > box.scrollTop + box.clientHeight) box.scrollTop = offset + y + rowHeight - box.clientHeight;
    top.value = box.scrollTop; // draw the rows now, not when the scroll event comes (a frame later)
  };
  return { rows, ref, drawn, reveal, box: () => box };
}

/** @typedef {{ r: number, c: number }} At */

/**
 * The grid and its formula bar, sharing the active cell. `onStatus` gets short messages ("Pasted 3 × 2 cells").
 * @param {{ onStatus: (text: string) => void }} options
 */
export function sheetView({ onStatus }) {
  const active = signal(/** @type {At} */ ({ r: 0, c: 0 }));
  const anchor = signal(/** @type {At} */ ({ r: 0, c: 0 })); // the other corner of a selected range
  /** Where an edit is being typed: in the cell, in the formula bar, or nowhere. */
  const editing = signal(/** @type {'cell' | 'bar' | null} */ (null));
  const draft = signal('');
  const activeId = computed(() => cellId(active.value.r, active.value.c));
  const win = windowed({ count: ROWS, rowHeight: ROW_H, offset: HEAD_H, overscan: 8 });
  const isRow = selector(() => active.value.r);
  const isCol = selector(() => active.value.c);
  /** @type {HTMLElement | null} */
  let gridEl = null;
  /** @type {HTMLInputElement | null} */
  let editorEl = null;

  const range = computed(() => {
    const a = active.value;
    const b = anchor.value;
    return { r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) };
  });

  // ---------- Moving ----------
  const clamp = (/** @type {number} */ n, /** @type {number} */ max) => Math.max(0, Math.min(max - 1, n));
  /** Make (r, c) the active cell, scrolled into view. extend: keep the anchor (Shift), for a range. */
  const go = (/** @type {number} */ r, /** @type {number} */ c, extend = false) => {
    const at = { r: clamp(r, ROWS), c: clamp(c, COLS) };
    active.value = at;
    if (!extend) anchor.value = at;
    win.reveal(at.r);
    const box = win.box();
    if (box) {
      const x = at.c * COL_W; // from the first column, right of the row numbers
      if (x < box.scrollLeft) box.scrollLeft = x;
      else if (HEAD_W + x + COL_W > box.scrollLeft + box.clientWidth) box.scrollLeft = HEAD_W + x + COL_W - box.clientWidth;
    }
  };
  /** Select the cells a step changed (after Undo, Redo or a paste). @param {[string, ...unknown[]][] | undefined} step */
  const selectChanged = (step) => {
    if (!step?.length) return;
    const at = step.map(([id]) => ({ r: Number(id.slice(1)) - 1, c: id.charCodeAt(0) - 65 }));
    const r0 = Math.min(...at.map((a) => a.r));
    const c0 = Math.min(...at.map((a) => a.c));
    go(Math.max(...at.map((a) => a.r)), Math.max(...at.map((a) => a.c)));
    anchor.value = { r: r0, c: c0 };
  };

  // ---------- Editing ----------
  const focusGrid = () => gridEl?.focus({ preventScroll: true });
  /** Start typing in the active cell: with what's there (Enter, F2, double-click) or a first key (replaces it). */
  const startEdit = (/** @type {string} */ text) => {
    draft.value = text;
    editing.value = 'cell';
  };
  const commit = () => {
    if (!editing.value) return;
    editing.value = null;
    edit([[activeId.peek(), draft.peek()]]);
  };
  const cancel = () => {
    editing.value = null;
    focusGrid();
  };
  /** Commit, then move (Enter goes down, Tab right, with Shift the other way). */
  const commitAndMove = (/** @type {number} */ dr, /** @type {number} */ dc) => {
    commit();
    const a = active.peek();
    go(a.r + dr, a.c + dc);
    focusGrid();
  };
  const clearRange = () => {
    const { r0, r1, c0, c1 } = range.peek();
    /** @type {[string, string][]} */
    const changes = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) changes.push([cellId(r, c), '']);
    edit(changes);
  };
  const doUndo = () => {
    commit();
    const step = undo();
    if (step) (selectChanged(step), onStatus(step.length > 1 ? `Undid a change to ${step.length} cells` : `Undid ${step[0][0]}`));
  };
  const doRedo = () => {
    commit();
    const step = redo();
    if (step) (selectChanged(step), onStatus(step.length > 1 ? `Redid a change to ${step.length} cells` : `Redid ${step[0][0]}`));
  };

  // ---------- Keyboard (on the grid) ----------
  const onKey = (/** @type {KeyboardEvent} */ e) => {
    if (e.target !== gridEl) return; // the cell editor handles its own keys
    const a = active.peek();
    const mod = e.ctrlKey || e.metaKey;
    const page = Math.max(1, Math.floor(((win.box()?.clientHeight ?? 600) - HEAD_H) / ROW_H) - 1);
    /** @type {Record<string, () => void>} */
    const moves = {
      ArrowUp: () => go(mod ? 0 : a.r - 1, a.c, e.shiftKey),
      ArrowDown: () => go(mod ? ROWS - 1 : a.r + 1, a.c, e.shiftKey),
      ArrowLeft: () => go(a.r, mod ? 0 : a.c - 1, e.shiftKey),
      ArrowRight: () => go(a.r, mod ? COLS - 1 : a.c + 1, e.shiftKey),
      PageUp: () => go(a.r - page, a.c, e.shiftKey),
      PageDown: () => go(a.r + page, a.c, e.shiftKey),
      Home: () => go(mod ? 0 : a.r, 0, e.shiftKey),
      End: () => go(mod ? ROWS - 1 : a.r, COLS - 1, e.shiftKey),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moves[e.key]();
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startEdit(rawOf(activeId.peek()));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      clearRange();
    } else if (e.key === 'Escape') {
      anchor.value = active.peek();
    } else if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      doRedo();
    } else if (e.key.length === 1 && !mod && !e.altKey) {
      e.preventDefault(); // the key goes into the editor as its first character
      startEdit(e.key);
    }
  };

  // ---------- Mouse ----------
  let dragging = false;
  /** The cell under a pointer event, from the row's data-r and the cell's data-c. @param {Event} e @returns {At | null} */
  const cellAt = (e) => {
    const el = /** @type {HTMLElement} */ (e.target).closest?.('[data-c]');
    const row = el?.closest('[data-r]');
    return el && row ? { r: Number(row.getAttribute('data-r')), c: Number(el.getAttribute('data-c')) } : null;
  };
  const onDown = (/** @type {PointerEvent} */ e) => {
    const at = cellAt(e);
    if (!at || e.button !== 0) return;
    if (editing.value) commit();
    e.preventDefault(); // keep focus on the grid, not on a cell
    go(at.r, at.c, e.shiftKey);
    focusGrid();
    dragging = true;
  };
  const onOver = (/** @type {PointerEvent} */ e) => {
    if (!dragging) return;
    const at = cellAt(e);
    if (at) active.value = at;
  };
  const stopDrag = () => (dragging = false);
  addEventListener('pointerup', stopDrag);
  onCleanup(() => removeEventListener('pointerup', stopDrag));

  // ---------- Copy and paste, as tab-separated text ----------
  const onCopy = (/** @type {ClipboardEvent} */ e) => {
    if (e.target !== gridEl || !e.clipboardData) return;
    const { r0, r1, c0, c1 } = range.peek();
    const lines = [];
    for (let r = r0; r <= r1; r++) {
      const line = [];
      for (let c = c0; c <= c1; c++) line.push(rawOf(cellId(r, c)));
      lines.push(line.join('\t'));
    }
    e.clipboardData.setData('text/plain', lines.join('\n'));
    e.preventDefault();
    const n = (r1 - r0 + 1) * (c1 - c0 + 1);
    onStatus(n > 1 ? `Copied ${r1 - r0 + 1} × ${c1 - c0 + 1} cells` : `Copied ${cellId(r0, c0)}`);
  };
  const onPaste = (/** @type {ClipboardEvent} */ e) => {
    if (e.target !== gridEl || !e.clipboardData) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n').replace(/\n$/, '');
    if (!text) return;
    const { r0, c0 } = range.peek();
    /** @type {[string, string][]} */
    const changes = [];
    const lines = text.split('\n');
    lines.forEach((line, i) => line.split('\t').forEach((raw, j) => {
      if (r0 + i < ROWS && c0 + j < COLS) changes.push([cellId(r0 + i, c0 + j), raw]);
    }));
    edit(changes);
    const rows = Math.min(lines.length, ROWS - r0);
    const cols = Math.min(Math.max(...lines.map((l) => l.split('\t').length)), COLS - c0);
    anchor.value = { r: r0, c: c0 };
    go(r0 + rows - 1, c0 + cols - 1, true);
    onStatus(changes.length > 1 ? `Pasted ${rows} × ${cols} cells` : `Pasted into ${cellId(r0, c0)}`);
  };

  // ---------- Drawing ----------
  const colIds = Array.from({ length: COLS }, (_, c) => c);
  const width = HEAD_W + COLS * COL_W;

  /** One row, built when it scrolls into view and dropped when it leaves. Its cells update in place. */
  const row = (/** @type {number} */ r) => html`
    <div class="sheet-row" role="row" aria-rowindex=${r + 2} data-r=${r} style=${`top: ${r * ROW_H}px`}>
      <div class=${() => (isRow(r) ? 'sheet-rh on' : 'sheet-rh')} role="rowheader" aria-colindex="1">${r + 1}</div>
      ${colIds.map((c) => {
        const id = cellId(r, c);
        return html`<div class=${() => `sheet-cell ${look(id, r).kind}`} role="gridcell" id=${`cell-${id}`} aria-colindex=${c + 2} data-c=${c}>${() => look(id, r).text}</div>`;
      })}
    </div>`;

  // The selection: one box drawn over the cells (instead of a class on each of them).
  const selStyle = () => {
    const { r0, r1, c0, c1 } = range.value;
    return `top: ${r0 * ROW_H}px; left: ${HEAD_W + c0 * COL_W}px; width: ${(c1 - c0 + 1) * COL_W}px; height: ${(r1 - r0 + 1) * ROW_H}px`;
  };
  const activeStyle = () => `top: ${active.value.r * ROW_H}px; left: ${HEAD_W + active.value.c * COL_W}px; width: ${COL_W}px; height: ${ROW_H}px`;
  const multi = computed(() => {
    const { r0, r1, c0, c1 } = range.value;
    return r0 !== r1 || c0 !== c1;
  });

  const editor = () => (editing.value !== 'cell' ? null : untrack(() => html`
    <input class="sheet-editor" style=${() => `top: ${active.value.r * ROW_H}px; left: ${HEAD_W + active.value.c * COL_W}px; min-width: ${COL_W}px; width: ${Math.max(COL_W, (draft.value.length + 2) * 8)}px`}
      aria-label=${`Edit ${activeId.value}`} autocomplete="off" spellcheck="false"
      ref=${(/** @type {HTMLInputElement} */ el) => {
        editorEl = el;
        queueMicrotask(() => {
          el.focus({ preventScroll: true });
          el.setSelectionRange(el.value.length, el.value.length);
        });
      }}
      .value=${draft} @input=${(/** @type {Event} */ e) => (draft.value = /** @type {HTMLInputElement} */ (e.target).value)}
      @keydown=${(/** @type {KeyboardEvent} */ e) => {
        if (e.key === 'Enter') (e.preventDefault(), commitAndMove(e.shiftKey ? -1 : 1, 0));
        else if (e.key === 'Tab') (e.preventDefault(), commitAndMove(0, e.shiftKey ? -1 : 1));
        else if (e.key === 'Escape') (e.preventDefault(), cancel());
      }}
      @blur=${() => {
        if (editing.peek() === 'cell') commit();
      }}>`));

  // The active cell, for screen readers: its id while its row is drawn.
  const activeDescendant = () => (win.drawn(active.value.r) ? `cell-${activeId.value}` : null);

  const grid = html`
    <div class="sheet-scroll" ref=${win.ref}>
      <div class="sheet-grid" role="grid" tabindex="0" aria-label="Sheet, 1,000 rows by 26 columns" aria-rowcount=${ROWS + 1}
        aria-colcount=${COLS + 1} aria-multiselectable="true" aria-activedescendant=${activeDescendant} style=${`width: ${width}px`}
        ref=${(/** @type {HTMLElement} */ el) => (gridEl = el)} @keydown=${onKey} @pointerdown=${onDown} @pointerover=${onOver}
        @dblclick=${(/** @type {MouseEvent} */ e) => cellAt(e) && startEdit(rawOf(activeId.peek()))} @copy=${onCopy} @paste=${onPaste}>
        <div class="sheet-head" role="rowgroup">
          <div class="sheet-row head" role="row" aria-rowindex="1">
            <div class="sheet-corner" role="columnheader" aria-colindex="1"><span class="sr-only">Row</span></div>
            ${colIds.map((c) => html`<div class=${() => (isCol(c) ? 'sheet-ch on' : 'sheet-ch')} role="columnheader" aria-colindex=${c + 2}>${colName(c)}</div>`)}
          </div>
        </div>
        <div class="sheet-body" role="rowgroup" style=${`height: ${ROWS * ROW_H}px`}>
          <div class=${() => (multi.value ? 'sheet-range' : 'sheet-range single')} aria-hidden="true" style=${selStyle}></div>
          ${repeat(win.rows, (r) => r, row)}
          <div class="sheet-active" aria-hidden="true" style=${activeStyle}></div>
          ${editor}
        </div>
      </div>
    </div>`;

  // ---------- The formula bar: the active cell's name and what's typed in it ----------
  const barValue = () => (editing.value ? draft.value : rawSignal(activeId.value, active.value.r));
  const formulaBar = html`
    <form class="sheet-formula card" @submit=${(/** @type {SubmitEvent} */ e) => (e.preventDefault(), commitAndMove(1, 0))}>
      <output class="sheet-name" aria-label="Active cell">${activeId}</output>
      <span class="sheet-fx" aria-hidden="true">fx</span>
      <label class="sr-only" for="sheet-input">Cell contents</label>
      <input id="sheet-input" class="input" autocomplete="off" spellcheck="false" placeholder="Number, text or =SUM(A1:A3)"
        .value=${barValue}
        @input=${(/** @type {Event} */ e) => {
          draft.value = /** @type {HTMLInputElement} */ (e.target).value;
          editing.value = 'bar';
        }}
        @keydown=${(/** @type {KeyboardEvent} */ e) => {
          if (e.key === 'Escape') (e.preventDefault(), cancel());
        }}
        @blur=${() => {
          if (editing.peek() === 'bar') commit();
        }}>
    </form>`;

  return {
    grid, formulaBar, active, activeId, go, focusGrid, commit, undo: doUndo, redo: doRedo,
    /** The cell editor, if it's open (for tests of focus). */
    editor: () => editorEl,
  };
}
