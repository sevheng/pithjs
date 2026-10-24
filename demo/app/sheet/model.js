import { signal, computed, effect, batch, root, createStore } from 'pith';
import { parseInput, evaluate, format, analyse, parseId, cellId, ERR, SheetError, ROWS } from './formula.js';

// The sheet's cells as signals. Each cell that has something in it, or that a formula reads, gets:
//   raw    a signal: what was typed
//   value  a computed: its value. A formula's computed reads the value of each cell it uses, so it
//          subscribes to exactly those, and editing a cell recomputes only the cells that use it, each once,
//          in order (Pith runs a computed after everything it reads).
//   cycle  a signal: true while the cell is on a circular reference. Its value is then #CYCLE! and it reads
//          nothing, so the signals never go round in a loop.
// A blank cell nobody reads has no signals at all, so 26,000 cells cost only the ones in use.
//
// One sheet, made when the page first loads this file, and saved to localStorage (it follows other tabs).

/** @typedef {import('./formula.js').Value} Value */
/**
 * @typedef {{ id: string, raw: { value: string, peek(): string }, cycle: { value: boolean, peek(): boolean },
 *   value: { readonly value: Value, peek(): Value }, input: import('./formula.js').Input }} Cell
 */

/** @type {Map<string, Cell>} */
const cells = new Map();
/** id → the cells its formula reads (only formulas that read some) */
/** @type {Map<string, string[]>} */
const reads = new Map();
/** The cells on a circular reference now. */
let inCycle = new Set();
/** Counts every time a cell's value is worked out (the readout's "cells recomputed"). */
export const counter = { recomputed: 0 };
/** How many cells have something in them (for "the sheet is empty"). */
export const filled = signal(0);

// A row's view shows blank cells that have no signals yet; it reads this to hear when one is made.
// One per row, made here (not while a page draws, where they'd count as its state).
const births = Array.from({ length: ROWS }, () => signal(0));
const born = (/** @type {number} */ row) => births[row];

/** The text in a cell now. */
export const rawOf = (/** @type {string} */ id) => cells.get(id)?.raw.peek() ?? '';

/** The value another cell's formula asks for: a signal read, so the formula subscribes to it. */
const read = (/** @type {string} */ id) => (cells.get(id) ?? make(id, '', false)).value.value;

/**
 * A cell's signals. Made in a root of its own: cells can be made while another cell's formula is being worked out,
 * and they must not belong to (and be disposed with) that computed. @returns {Cell}
 */
function make(/** @type {string} */ id, /** @type {string} */ raw, /** @type {boolean} */ cyclic) {
  const cell = root(() => {
    /** @type {Cell} */
    const c = { id, raw: signal(raw), cycle: signal(cyclic), input: parseInput(raw), value: /** @type {any} */ (null) };
    let parsedFrom = raw;
    c.value = computed(() => {
      counter.recomputed++;
      const text = c.raw.value;
      if (c.cycle.value) return ERR.CYCLE;
      if (text !== parsedFrom) (parsedFrom = text), (c.input = parseInput(text));
      const input = c.input;
      if (input.kind !== 'formula') return input.value;
      return input.ast ? evaluate(input.ast, read) : input.value;
    });
    return c;
  });
  cells.set(id, cell);
  const row = /** @type {[number, number]} */ (parseId(id))[0];
  births[row].value++;
  return cell;
}

const same = (/** @type {string[] | undefined} */ a, /** @type {string[] | undefined} */ b) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));

/**
 * Find the cells on a cycle again after formulas changed. A new cycle goes through a changed cell, and a cycle
 * that's gone was in the old set, so only what those reach is looked at (an edit to a number looks at nothing).
 * @param {string[]} changed
 */
function recheckCycles(changed) {
  const found = analyse([...changed, ...inCycle], (id) => reads.get(id)).cyclic;
  inCycle = found; // a cell made after this (in write) starts with its flag
  for (const [id, c] of cells) if (c.cycle.peek() !== found.has(id)) c.cycle.value = found.has(id);
}

/**
 * Write cells (no undo; see edit()). Cells that don't exist are made with their text, in an order where each
 * comes after the cells it reads, so a formula is first worked out with its inputs already there.
 * @param {[string, string][]} changes [id, raw]
 */
function write(changes) {
  batch(() => {
    /** @type {Map<string, string>} */
    const next = new Map(changes);
    /** @type {string[]} */
    const changed = [];
    for (const [id, raw] of next) {
      const before = reads.get(id);
      const refs = raw.trim().startsWith('=') ? parseInput(raw).refs ?? [] : [];
      if (refs.length) reads.set(id, refs);
      else reads.delete(id);
      if (!same(before, refs.length ? refs : undefined)) changed.push(id);
    }
    if (changed.length) recheckCycles(changed);
    let count = filled.peek();
    // New cells in dependency order (what they read first). Existing ones just get their new text.
    const order = next.size > 1 ? analyse(next.keys(), (id) => (next.has(id) ? reads.get(id) : null)).order : [...next.keys()];
    for (const id of order) {
      if (!next.has(id)) continue;
      const raw = /** @type {string} */ (next.get(id));
      const cell = cells.get(id);
      const had = !!cell?.raw.peek();
      if (cell) cell.raw.value = raw;
      else if (raw) make(id, raw, inCycle.has(id));
      if (had !== !!raw) count += raw ? 1 : -1;
    }
    filled.value = count;
  });
  scheduleSave();
}

// ---------- Saving (and other tabs) ----------

const saved = createStore({ cells: /** @type {Record<string, string>} */ ({}) }, { persist: 'pith-sheet' });
/** @type {Record<string, string> | null} */
let lastSaved = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let saveTimer;
// Edits can come many times a second (Random edits), so the sheet is saved a moment after they stop.
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
function saveNow() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [id, c] of cells) {
    const raw = c.raw.peek();
    if (raw) out[id] = raw;
  }
  lastSaved = out;
  saved.cells.value = out;
}
/** Make the sheet match a saved one (on start, and when another tab saved). @param {Record<string, string>} data */
function adopt(data) {
  /** @type {[string, string][]} */
  const changes = [];
  for (const [id, c] of cells) if (c.raw.peek() && !Object.hasOwn(data, id)) changes.push([id, '']);
  for (const [id, raw] of Object.entries(data)) {
    const at = parseId(id);
    if (typeof raw === 'string' && at && at[0] >= 0 && rawOf(id) !== raw) changes.push([id, raw]);
  }
  if (changes.length) write(changes);
  clearTimeout(saveTimer);
}
root(() =>
  effect(() => {
    const data = saved.cells.value;
    if (data !== lastSaved) adopt(data ?? {});
  })
);

// ---------- Undo and redo ----------

/** @type {[string, string, string][][]} each step: [id, before, after] for every cell it changed */
const undoStack = [];
/** @type {[string, string, string][][]} */
const redoStack = [];
const history = signal(0); // bumps when either stack changes
export const canUndo = computed(() => (history.value, undoStack.length > 0));
export const canRedo = computed(() => (history.value, redoStack.length > 0));


/**
 * Change cells as one step of Undo. @param {[string, string][]} changes [id, raw] @param {{ undo?: boolean }} [options]
 *   undo: false for the stress tools, whose hundreds of edits a second would bury your own
 */
export function edit(changes, { undo = true } = {}) {
  const real = changes.filter(([id, raw]) => rawOf(id) !== raw);
  if (!real.length) return;
  if (undo) {
    undoStack.push(real.map(([id, raw]) => [id, rawOf(id), raw]));
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
    history.value++;
  }
  write(real);
}
export function undo() {
  const step = undoStack.pop();
  if (!step) return;
  redoStack.push(step);
  history.value++;
  write(step.map(([id, before]) => [id, before]));
  return step;
}
export function redo() {
  const step = redoStack.pop();
  if (!step) return;
  undoStack.push(step);
  history.value++;
  write(step.map(([id, , after]) => [id, after]));
  return step;
}

// ---------- Reading cells, for the view ----------

/**
 * How a cell looks: its text, and its kind (for alignment and color). A blank cell with no signals reads its
 * row's "born" signal instead, so it updates when it gets some. Read in an effect.
 * @param {string} id @param {number} row
 * @returns {{ text: string, kind: 'empty' | 'num' | 'text' | 'bool' | 'err' }}
 */
export function look(id, row) {
  const c = cells.get(id);
  if (!c) {
    born(row).value;
    return { text: '', kind: 'empty' };
  }
  const v = c.value.value;
  if (v instanceof SheetError) return { text: v.code, kind: 'err' };
  if (v === null) return { text: '', kind: 'empty' };
  const kind = typeof v === 'number' ? 'num' : typeof v === 'boolean' ? 'bool' : 'text';
  return { text: format(v), kind };
}

/** What's typed in a cell, as a signal read (the formula bar follows it). */
export function rawSignal(/** @type {string} */ id, /** @type {number} */ row) {
  const c = cells.get(id);
  if (!c) {
    born(row).value;
    return '';
  }
  return c.raw.value;
}


// ---------- The demo data: a budget ----------

/**
 * 1,000 rows: A1 the opening balance, then each month's income (A) and costs (B), the net (C = A − B), the running
 * balance (D = the balance above + this month's net) and a status (E). D1000 depends on D999, which depends on
 * D998, … back to A1: a chain 1,000 cells deep. G1:G4 sum the columns up.
 * @returns {[string, string][]}
 */
export function demoData() {
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  /** @type {[string, string][]} */
  const out = [
    ['A1', '2500'], ['B1', 'Start balance'], ['D1', '=A1'], ['E1', '=IF(D1<0,"Short","OK")'],
    ['F1', 'Min balance'], ['G1', `=MIN(D1:D${ROWS})`],
    ['F2', 'Average net'], ['G2', `=ROUND(AVERAGE(C2:C${ROWS}),2)`],
    ['F3', 'Total income'], ['G3', `=SUM(A2:A${ROWS})`],
    ['F4', 'Final balance'], ['G4', `=D${ROWS}`],
  ];
  for (let r = 2; r <= ROWS; r++) {
    out.push([`A${r}`, String(Math.round(3000 + rand() * 3000))]);
    out.push([`B${r}`, String(Math.round(2950 + rand() * 3100))]);
    out.push([`C${r}`, `=A${r}-B${r}`]);
    out.push([`D${r}`, `=D${r - 1}+C${r}`]);
    out.push([`E${r}`, `=IF(D${r}<0,"Short","OK")`]);
  }
  return out;
}

/** Every cell with something in it, as [id, ''] changes: what Clear writes. @returns {[string, string][]} */
export function clearing() {
  /** @type {[string, string][]} */
  const out = [];
  for (const [id, c] of cells) if (c.raw.peek()) out.push([id, '']);
  return out;
}

export { cellId };
