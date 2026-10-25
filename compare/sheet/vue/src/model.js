import { shallowRef, computed, effectScope } from 'vue';
import { parseInput, evaluate, analyse, parseId, ERR, ROWS } from '../../../shared/sheet/formula.js';

// The sheet's cells, Vue's fine-grained way: each cell that has something in it, or that a formula reads, gets
//   raw    a shallowRef: what was typed
//   value  a computed: its value. A formula's computed reads the value of each cell it uses (evaluate's get),
//          so Vue tracks exactly those, and an edit marks only the cells that use it as changed.
//   cycle  a shallowRef: true while the cell is on a circular reference. Its value is then #CYCLE! and it
//          reads nothing, so the computeds never go round in a loop.
// A blank cell nobody reads has none. Cells are made lazily, in a detached effectScope of the sheet's own (a
// cell may be made while another cell's computed or a row's render runs, and must not belong to it).

/** @typedef {import('../../../shared/sheet/formula.js').Value} Value */

/** @type {Map<string, { raw: import('vue').ShallowRef<string>, cycle: import('vue').ShallowRef<boolean>, value: import('vue').ComputedRef<Value>, input: any }>} */
const cells = new Map();
/** id → the cells its formula reads (only formulas that read some) */
/** @type {Map<string, string[]>} */
const reads = new Map();
let inCycle = new Set();
const scope = effectScope(true);

// A row's view shows blank cells that have no refs yet; it reads this to hear when one is made.
const births = Array.from({ length: ROWS }, () => shallowRef(0));

/** The text in a cell now (not tracked). */
export const rawOf = (/** @type {string} */ id) => cells.get(id)?.raw.value ?? '';

/** The value another cell's formula asks for: a computed read, so Vue tracks it. */
const read = (/** @type {string} */ id) => (cells.get(id) ?? make(id, '', false)).value.value;

function make(/** @type {string} */ id, /** @type {string} */ raw, /** @type {boolean} */ cyclic) {
  const cell = scope.run(() => {
    const c = { raw: shallowRef(raw), cycle: shallowRef(cyclic), input: parseInput(raw), value: /** @type {any} */ (null) };
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
  cells.set(id, /** @type {any} */ (cell));
  births[/** @type {[number, number]} */ (parseId(id))[0]].value++;
  return /** @type {any} */ (cell);
}

const same = (/** @type {string[] | undefined} */ a, /** @type {string[] | undefined} */ b) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));

function recheckCycles(/** @type {string[]} */ changed) {
  const found = analyse([...changed, ...inCycle], (id) => reads.get(id)).cyclic;
  inCycle = found;
  for (const [id, c] of cells) if (c.cycle.value !== found.has(id)) c.cycle.value = found.has(id);
}

/**
 * Write cells. Vue re-renders once for all of them (its scheduler batches), and computeds are worked out when
 * read. New cells are made in an order where each comes after the cells it reads.
 * @param {[string, string][]} changes [id, raw]
 */
export function edit(changes) {
  const next = new Map(changes.filter(([id, raw]) => rawOf(id) !== raw));
  if (!next.size) return;
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
}

/** Every cell with something in it, as [id, ''] changes: what Clear writes. @returns {[string, string][]} */
export function clearing() {
  /** @type {[string, string][]} */
  const out = [];
  for (const [id, c] of cells) if (c.raw.value) out.push([id, '']);
  return out;
}

/** A cell's value, tracked: a blank cell without refs tracks its row's "born" counter instead. */
export function valueOf(/** @type {string} */ id, /** @type {number} */ row) {
  const c = cells.get(id);
  if (!c) {
    births[row].value;
    return null;
  }
  return c.value.value;
}

/** What's typed in a cell, tracked (the formula bar follows it). */
export function rawTracked(/** @type {string} */ id, /** @type {number} */ row) {
  const c = cells.get(id);
  if (!c) {
    births[row].value;
    return '';
  }
  return c.raw.value;
}
