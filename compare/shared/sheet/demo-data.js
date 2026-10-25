// The Spreadsheet's data and edits, the same for every implementation (no framework in here):
//   demoData()       the demo budget ("Fill demo data"), seeded, so every implementation gets the same cells
//   finalBalance()   what D1000 (and G4) should show, worked out directly, for the flows and measure.js
//   nextA1(raw)      what "Edit A1" writes
//   randomEdits()    seeded random edits to the budget's inputs, on a timer (window.bench.start)
// The same budget as the Pith demo's /sheet (demo/app/sheet/model.js).

import { ROWS } from './formula.js';

/** A seeded random number generator (Park–Miller), 0 ≤ x < 1. */
function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/**
 * 1,000 rows: A1 the opening balance, then each month's income (A) and costs (B), the net (C = A − B), the
 * running balance (D = the balance above + this month's net) and a status (E). D1000 depends on D999, which
 * depends on D998, … back to A1: a chain 1,000 cells deep. G1:G4 sum the columns up. 5,007 cells.
 * @returns {[string, string][]} [id, raw]
 */
export function demoData() {
  const rand = seeded(11);
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

/** The demo budget's final balance (D1000) when A1 is `a1`, worked out without the formulas. */
export function finalBalance(a1 = 2500) {
  const raw = new Map(demoData());
  let balance = a1;
  for (let r = 2; r <= ROWS; r++) balance += Number(raw.get(`A${r}`)) - Number(raw.get(`B${r}`));
  return balance;
}

/** What Edit A1 writes: A1 + 100 (1 when A1 isn't a number). */
export function nextA1(raw) {
  const n = Number(raw);
  return String(raw.trim() !== '' && Number.isFinite(n) ? n + 100 : 1);
}

/**
 * Random edits to the budget's inputs (an income or a cost in any month), `perSecond` of them, on a 16 ms timer:
 * each tick gives `apply` the edits it owes as one list, which the app applies as one update.
 * @param {number} perSecond
 * @param {(changes: [string, string][]) => void} apply
 * @returns {() => void} stop
 */
export function randomEdits(perSecond, apply) {
  const rand = seeded(7);
  let owed = 0;
  let last = performance.now();
  const id = setInterval(() => {
    const now = performance.now();
    owed += ((now - last) / 1000) * perSecond;
    last = now;
    const k = Math.floor(owed);
    owed -= k;
    if (!k) return;
    /** @type {[string, string][]} */
    const changes = [];
    for (let i = 0; i < k; i++) {
      const row = 2 + Math.floor(rand() * (ROWS - 1));
      changes.push([`${rand() < 0.5 ? 'A' : 'B'}${row}`, String(Math.round(2600 + rand() * 3400))]);
    }
    apply(changes);
  }, 16);
  return () => clearInterval(id);
}
