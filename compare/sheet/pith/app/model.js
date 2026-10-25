import { signal, computed, batch, root } from 'pith';
import { parseInput, evaluate, analyse, parseId, ERR, ROWS } from '../../../shared/sheet/formula.js';

// The sheet's cells as signals, as in the Pith demo (demo/app/sheet/model.js). Each cell that has something
// in it, or that a formula reads, gets:
//   raw    a signal: what was typed
//   value  a computed: its value. A formula's computed reads the value of each cell it uses (evaluate's get),
//          so it subscribes to exactly those, and an edit recomputes only the cells that use it, each once, in
//          order.
//   cycle  a signal: true while the cell is on a circular reference. Its value is then #CYCLE! and it reads
//          nothing, so the signals never go round in a loop.
// A blank cell nobody reads has no signals at all.

/** @typedef {import('../../../shared/sheet/formula.js').Value} Value */
/** @typedef {{ raw: ReturnType<typeof signal<string>>, cycle: ReturnType<typeof signal<boolean>>, value: { readonly value: Value }, input: any }} Cell */

/** @type {Map<string, Cell>} */
const cells = new Map();
/** id → the cells its formula reads (only formulas that read some) */
/** @type {Map<string, string[]>} */
const reads = new Map();
/** The cells on a circular reference now. */
let inCycle = new Set();

// A row's view shows blank cells that have no signals yet; it reads this to hear when one is made.
const births = Array.from({ length: ROWS }, () => signal(0));

/** The text in a cell now. */
export const rawOf = (/** @type {string} */ id) => cells.get(id)?.raw.peek() ?? '';

/** The value another cell's formula asks for: a computed read, so the formula subscribes to it. */
const read = (/** @type {string} */ id) => (cells.get(id) ?? make(id, '', false)).value.value;

/** A cell's signals, made in a root of its own (it may be made while another cell's formula runs). */
function make(/** @type {string} */ id, /** @type {string} */ raw, /** @type {boolean} */ cyclic) {
  const cell = root(() => {
    /** @type {Cell} */
    const c = { raw: signal(raw), cycle: signal(cyclic), input: parseInput(raw), value: /** @type {any} */ (null) };
    let parsedFrom = raw;
    c.value = computed(() => {
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
  births[/** @type {[number, number]} */ (parseId(id))[0]].value++;
  return cell;
}

const same = (/** @type {string[] | undefined} */ a, /** @type {string[] | undefined} */ b) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));

/** Find the cells on a cycle again after formulas changed (only what the changed cells reach is looked at). */
function recheckCycles(/** @type {string[]} */ changed) {
  const found = analyse([...changed, ...inCycle], (id) => reads.get(id)).cyclic;
  inCycle = found;
  for (const [id, c] of cells) if (c.cycle.peek() !== found.has(id)) c.cycle.value = found.has(id);
}

/**
 * Write cells, as one update. New cells are made in an order where each comes after the cells it reads.
 * @param {[string, string][]} changes [id, raw]
 */
export function edit(changes) {
  const next = new Map(changes.filter(([id, raw]) => rawOf(id) !== raw));
  if (!next.size) return;
  batch(() => {
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
    const order = next.size > 1 ? analyse(next.keys(), (id) => (next.has(id) ? reads.get(id) : null)).order : [...next.keys()];
    for (const id of order) {
      if (!next.has(id)) continue;
      const raw = /** @type {string} */ (next.get(id));
      const cell = cells.get(id);
      if (cell) cell.raw.value = raw;
      else if (raw) make(id, raw, inCycle.has(id));
    }
  });
}

/** Every cell with something in it, as [id, ''] changes: what Clear writes. @returns {[string, string][]} */
export function clearing() {
  /** @type {[string, string][]} */
  const out = [];
  for (const [id, c] of cells) if (c.raw.peek()) out.push([id, '']);
  return out;
}

/** A cell's value, read in an effect: a blank cell without signals reads its row's "born" signal instead. */
export function valueOf(/** @type {string} */ id, /** @type {number} */ row) {
  const c = cells.get(id);
  if (!c) {
    births[row].value;
    return null;
  }
  return c.value.value;
}

/** What's typed in a cell, read in an effect (the formula bar follows it). */
export function rawSignal(/** @type {string} */ id, /** @type {number} */ row) {
  const c = cells.get(id);
  if (!c) {
    births[row].value;
    return '';
  }
  return c.raw.value;
}
