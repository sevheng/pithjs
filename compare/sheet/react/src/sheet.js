import { parseInput, evaluate, analyse, ERR } from '../../../shared/sheet/formula.js';

// The sheet as React state, and its values: what a React developer writes without a signals library.
//   state   { cells, refs }, replaced on every edit (never changed in place):
//           cells: id → { raw, input }, every cell with something in it (input: what parseInput() made of raw)
//           refs:  id → the cells its formula reads. The same Map until an edit changes some formula's
//                  references, so the dependency order below is worked out again only then.
//   order(refs)          the formulas in dependency order (each after what it reads), and the cells on a cycle
//   values(cells, order) every cell's value, each formula evaluated once, in that order
// The App wraps the last two in useMemo. Nothing here tracks which values an edit changed: every edit
// evaluates every formula again (see spec/sheet.md, "React").

/** @typedef {import('../../../shared/sheet/formula.js').Value} Value */
/** @typedef {{ cells: Map<string, { raw: string, input: any }>, refs: Map<string, string[]> }} Sheet */

/** @type {Sheet} */
export const EMPTY = { cells: new Map(), refs: new Map() };

const same = (/** @type {string[] | undefined} */ a, /** @type {string[] | undefined} */ b) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));

/**
 * The sheet after some edits (a new object; `sheet` itself is unchanged). The same object when nothing changed.
 * @param {Sheet} sheet @param {[string, string][]} changes [id, raw] @returns {Sheet}
 */
export function apply(sheet, changes) {
  let cells = null;
  let refs = sheet.refs;
  for (const [id, raw] of changes) {
    if (((cells ?? sheet.cells).get(id)?.raw ?? '') === raw) continue;
    cells ??= new Map(sheet.cells);
    const input = parseInput(raw);
    if (raw) cells.set(id, { raw, input });
    else cells.delete(id);
    const reads = input.kind === 'formula' && input.refs.length ? input.refs : undefined;
    if (!same(refs.get(id), reads)) {
      if (refs === sheet.refs) refs = new Map(refs);
      if (reads) refs.set(id, reads);
      else refs.delete(id);
    }
  }
  return cells ? { cells, refs } : sheet;
}

/** The formulas that read other cells, in dependency order, and the cells on a cycle. @param {Sheet['refs']} refs */
export const order = (refs) => analyse(refs.keys(), (id) => refs.get(id));

/**
 * Every cell's value. Plain values and formulas that read nothing first, then the other formulas in dependency
 * order, so each reads values that are already worked out: each formula is evaluated once.
 * @param {Sheet['cells']} cells @param {{ order: string[], cyclic: Set<string> }} graph
 * @returns {Map<string, Value>}
 */
export function values(cells, { order, cyclic }) {
  /** @type {Map<string, Value>} */
  const out = new Map();
  const get = (/** @type {string} */ id) => out.get(id) ?? null;
  for (const [id, { input }] of cells) {
    if (input.kind !== 'formula' || !input.ast) out.set(id, input.value);
    else if (!input.refs.length) out.set(id, evaluate(input.ast, get));
  }
  for (const id of order) {
    const input = cells.get(id)?.input;
    if (!input || input.kind !== 'formula' || !input.ast || !input.refs.length) continue;
    out.set(id, cyclic.has(id) ? ERR.CYCLE : evaluate(input.ast, get));
  }
  return out;
}
