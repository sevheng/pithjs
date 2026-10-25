// How the Spreadsheet looks, the same in every implementation: a cell's text and kind, the grid's sizes, and
// the summary line. No framework in here.

import { format, SheetError } from './formula.js';

export const ROW_H = 32; // px: every row is this tall, so row r sits at r × ROW_H
export const COL_W = 104; // px: every column is this wide
export const HEAD_W = 52; // px: the row numbers
export const OVERSCAN = 6; // rows drawn above and below the ones in view

/** The summary line above the grid: cells of the demo budget, shown with a label. */
export const SUMMARY = /** @type {const} */ ([
  ['G1', 'Min balance'],
  ['G2', 'Average net'],
  ['G3', 'Total income'],
  ['G4', 'Final balance'],
]);

const EMPTY = Object.freeze({ text: '', kind: 'empty' });

/**
 * A cell's text and kind (its class: 'num' aligns right, 'err' is red).
 * @param {import('./formula.js').Value | undefined} v
 * @returns {{ text: string, kind: 'empty' | 'num' | 'text' | 'bool' | 'err' }}
 */
export function look(v) {
  if (v === null || v === undefined) return EMPTY;
  if (v instanceof SheetError) return { text: v.code, kind: 'err' };
  const kind = typeof v === 'number' ? 'num' : typeof v === 'boolean' ? 'bool' : 'text';
  return { text: format(v), kind };
}

/** The summary's text for a value: '—' while the cell is empty. */
export const summaryText = (/** @type {import('./formula.js').Value | undefined} */ v) => look(v).text || '—';
