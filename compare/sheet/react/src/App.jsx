import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ROWS, COLS, cellId, colName } from '../../../shared/sheet/formula.js';
import { demoData, nextA1, randomEdits } from '../../../shared/sheet/demo-data.js';
import { look, summaryText, SUMMARY, ROW_H, COL_W, HEAD_W, OVERSCAN } from '../../../shared/sheet/display.js';
import { EMPTY, apply, order, values } from './sheet.js';

// The Spreadsheet in React (spec/sheet.md). The cells are state, replaced on each edit; their values are one
// useMemo over them (sheet.js); the grid draws the rows in view, each a memo'd Row that gets its row's texts,
// so a row whose texts didn't change skips rendering.

const colIds = Array.from({ length: COLS }, (_, c) => c);

/** Rows are equal when their texts and kinds are (each render makes new objects for them). */
const sameRow = (a, b) =>
  a.r === b.r && a.on === b.on && a.cells.every((x, i) => x.text === b.cells[i].text && x.kind === b.cells[i].kind);

const Row = memo(function Row({ r, on, cells }) {
  return (
    <div className="sheet-row" role="row" aria-rowindex={r + 2} data-r={r} style={{ top: r * ROW_H }}>
      <div className={on ? 'sheet-rh on' : 'sheet-rh'} role="rowheader">{r + 1}</div>
      {cells.map((cell, c) => (
        <div key={c} className={`sheet-cell ${cell.kind}`} role="gridcell" id={`cell-${cell.id}`} data-c={c}>{cell.text}</div>
      ))}
    </div>
  );
}, sameRow);

export default function App() {
  const [sheet, setSheet] = useState(EMPTY);
  // The dependency order changes only when a formula's references do; the values on every edit.
  const graph = useMemo(() => order(sheet.refs), [sheet.refs]);
  const vals = useMemo(() => values(sheet.cells, graph), [sheet.cells, graph]);
  const edit = (changes) => setSheet((s) => apply(s, changes));

  // ---------- The window: which rows are in view ----------
  const box = useRef(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(600); // until it's measured
  useLayoutEffect(() => {
    const el = box.current;
    const seen = new ResizeObserver(() => (setHeight(el.clientHeight), setTop(el.scrollTop)));
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  const first = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN);
  const last = Math.min(ROWS - 1, Math.ceil((top + height) / ROW_H) + OVERSCAN);

  // ---------- The selected cell and the formula bar ----------
  const [active, setActive] = useState({ r: 0, c: 0 });
  const activeId = cellId(active.r, active.c);
  /** What's typed in the formula bar, or null while it shows the cell's own text. */
  const [draft, setDraft] = useState(null);

  const select = (e) => {
    const cell = e.target.closest('[data-c]');
    const row = cell?.closest('[data-r]');
    if (!cell || !row) return;
    setActive({ r: Number(row.dataset.r), c: Number(cell.dataset.c) });
    setDraft(null);
  };
  const submit = (e) => {
    e.preventDefault();
    if (draft !== null) edit([[activeId, draft]]);
    setDraft(null);
    setActive({ r: Math.min(ROWS - 1, active.r + 1), c: active.c }); // Enter moves down, as in other spreadsheets
  };

  // ---------- The buttons ----------
  const fill = () => setSheet(apply(EMPTY, demoData()));
  const editA1 = () => setSheet((s) => apply(s, [['A1', nextA1(s.cells.get('A1')?.raw ?? '')]]));
  const clear = () => setSheet(EMPTY);

  // For measure.js and the flows (spec/sheet.md).
  useEffect(() => {
    let stopEdits = null;
    window.bench = {
      set: (id, raw) => setSheet((s) => apply(s, [[id, raw]])),
      fill: () => setSheet(apply(EMPTY, demoData())),
      clear: () => setSheet(EMPTY),
      scrollToRow(r) {
        box.current.scrollTop = r * ROW_H;
        setTop(box.current.scrollTop); // draw the rows now, not when the scroll event comes (a frame later)
      },
      start(perSecond) {
        this.stop();
        stopEdits = randomEdits(perSecond, (changes) => setSheet((s) => apply(s, changes)));
      },
      stop() {
        stopEdits?.();
        stopEdits = null;
      },
    };
  }, []);

  const rows = [];
  for (let r = first; r <= last; r++) {
    const cells = colIds.map((c) => {
      const id = cellId(r, c);
      return { id, ...look(vals.get(id)) };
    });
    rows.push(<Row key={r} r={r} on={r === active.r} cells={cells} />);
  }

  return (
    <main className="page sheet-page">
      <header className="sheet-bar">
        <div>
          <p className="sheet-eyebrow">Spreadsheet</p>
          <h1>Budget</h1>
        </div>
        <div className="sheet-actions">
          <button id="fill" className="btn primary" type="button" onClick={fill}>Fill demo data</button>
          <button id="edit-a1" className="btn" type="button" onClick={editA1}>Edit A1</button>
          <button id="clear" className="btn ghost" type="button" onClick={clear}>Clear</button>
        </div>
      </header>
      <dl className="sheet-summary">
        {SUMMARY.map(([id, label]) => (
          <div key={id} className="card">
            <dt>{label}</dt>
            <dd id={`sum-${id}`}>{summaryText(vals.get(id))}</dd>
          </div>
        ))}
      </dl>
      <form className="sheet-formula card" onSubmit={submit}>
        <output className="sheet-name" aria-label="Selected cell">{activeId}</output>
        <span className="sheet-fx" aria-hidden="true">fx</span>
        <label className="sr-only" htmlFor="sheet-input">Cell contents</label>
        <input id="sheet-input" className="input" autoComplete="off" spellCheck="false" placeholder="Number, text or =SUM(A1:A3)"
          value={draft ?? sheet.cells.get(activeId)?.raw ?? ''} onChange={(e) => setDraft(e.target.value)} />
      </form>
      <div className="sheet-frame card">
        <div ref={box} className="sheet-scroll" onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
          <div className="sheet-grid" role="grid" aria-label="Sheet" aria-rowcount={ROWS + 1} aria-colcount={COLS + 1}
            style={{ width: HEAD_W + COLS * COL_W }} onClick={select}>
            <div className="sheet-head" role="rowgroup">
              <div className="sheet-row" role="row" aria-rowindex="1">
                <div className="sheet-corner" role="columnheader"></div>
                {colIds.map((c) => <div key={c} className="sheet-ch" role="columnheader">{colName(c)}</div>)}
              </div>
            </div>
            <div className="sheet-body" role="rowgroup" style={{ height: ROWS * ROW_H }}>
              {rows}
              <div className="sheet-active" aria-hidden="true" style={{ top: active.r * ROW_H, left: HEAD_W + active.c * COL_W }}></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
