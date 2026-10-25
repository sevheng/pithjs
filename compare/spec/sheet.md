# Spreadsheet: long chains of dependent values

A 1,000-row × 26-column spreadsheet with formulas, built three times (`sheet/pith`, `sheet/react`, `sheet/vue`).
It measures how each framework handles many derived values that depend on each other: the demo budget has a
column of running totals, each row reading the one above, so changing A1 changes a chain 1,000 cells deep.
It's a smaller version of the Pith demo's `/sheet` (`demo/app/sheet/*`): no undo, no keyboard moves, no copy
and paste, no saving. One screen, no router, no API. Every implementation draws the same DOM (below), so the same
flows (`flows/sheet.js`) test all of them, and `sheet/measure.js` measures them.

## Shared code (`shared/sheet/`, used unchanged by all three)

| File | What |
|---|---|
| `formula.js` | the parser, evaluator, error values and cycle finder (Tarjan's, without recursion): a copy of the demo's `demo/app/sheet/formula.js`. `evaluate(ast, get)` asks for each cell it reads through `get(id)`, so each framework decides what a read is. |
| `demo-data.js` | `demoData()`, the seeded budget (5,007 cells); `finalBalance(a1)`, what D1000 should show, worked out without formulas (for flows and measure.js); `nextA1(raw)`, what Edit A1 writes (A1 + 100); `randomEdits(perSecond, apply)`, seeded random edits on a 16 ms timer, each tick's edits as one list. |
| `display.js` | `look(value)`: a cell's text and kind (numbers as `format()` writes them, text, `TRUE`/`FALSE`, error codes); the grid's sizes (32 px rows, 104 px columns, 6 rows of overscan); the summary's cells. |
| `sheet.css` | the styles, on top of `/styles.css` and its tokens. |

So only the reactive wiring and the rendering differ.

### The demo budget
A1 is the opening balance (2500). Rows 2–1,000: income (A) and costs (B), random but seeded, the net
`=A2-B2` (C), the balance `=D1+C2` (D, the one above plus this month's net) and a status
`=IF(D2<0,"Short","OK")` (E). F1:G4 sum it up: `=MIN(D1:D1000)`, `=ROUND(AVERAGE(C2:C1000),2)`,
`=SUM(A2:A1000)` and `=D1000`. Edit A1 makes A1 + 100: A1, every balance, every status, G1 and G4 change
(2,003 cells).

## The DOM (the same in all three)
```
<main class="page sheet-page">
  <header class="sheet-bar">
    <div><p class="sheet-eyebrow">Spreadsheet</p><h1>Budget</h1></div>
    <div class="sheet-actions">
      <button id="fill" class="btn primary" type="button">Fill demo data</button>   the budget, replacing what's there
      <button id="edit-a1" class="btn" type="button">Edit A1</button>             A1 = A1 + 100 (1 if A1 isn't a number)
      <button id="clear" class="btn ghost" type="button">Clear</button>           every cell empty
  <dl class="sheet-summary">  four of <div class="card"><dt>{label}</dt><dd id="sum-{G1..G4}">{text, or — when empty}</dd></div>
                              labels: Min balance, Average net, Total income, Final balance
  <form class="sheet-formula card">                                  Enter (submit) sets the selected cell
    <output class="sheet-name" aria-label="Selected cell">{A1}</output>   and selects the cell below it
    <span class="sheet-fx" aria-hidden="true">fx</span>
    <label class="sr-only" for="sheet-input">Cell contents</label>
    <input id="sheet-input" class="input">              shows the selected cell's raw text until you type
  <div class="sheet-frame card">
    <div class="sheet-scroll">                          the grid's own scroll box
      <div class="sheet-grid" role="grid" aria-label="Sheet" aria-rowcount="1001" aria-colcount="27">
                                                        a click on a cell selects it
        <div class="sheet-head" role="rowgroup"><div class="sheet-row" role="row">
          <div class="sheet-corner" role="columnheader"></div> + 26 × <div class="sheet-ch" role="columnheader">A…Z</div>
        <div class="sheet-body" role="rowgroup" style="height: 32000px">
          per row in view (+ 6 above and below), keyed by its index r:
          <div class="sheet-row" role="row" aria-rowindex="{r+2}" data-r="{r}" style="top: {r × 32}px">
            <div class="sheet-rh[ on]" role="rowheader">{r+1}</div>              "on": the selected row
            26 × <div class="sheet-cell {empty|num|text|bool|err}" role="gridcell" id="cell-{B2}" data-c="{c}">{text}</div>
          <div class="sheet-active" aria-hidden="true" style="top: …; left: …">   the selected cell's border
```

**Windowing.** Every row is 32 px, so the rows in view follow from the box's `scrollTop` and `clientHeight`
(a `ResizeObserver` measures it). Each implementation writes its own (about 15 lines): a scroll listener sets
the top, and the rows `floor(top / 32) − 6` to `ceil((top + height) / 32) + 6` are drawn, absolutely placed in
a body as tall as all 1,000 rows. No virtualization library.

## `window.bench` (for measure.js)
`{ set(id, raw), fill(), clear(), scrollToRow(r), start(editsPerSecond), stop() }`. Each goes through the
framework's normal state update (the same functions the buttons call). `start` runs `randomEdits()` (an
income or a cost in a random month, 100 a second in the stress test) and applies each tick's edits as one update.

## How each framework is written, and why that's fair
Each is written as its own docs recommend, with no extra libraries (no signals library for React, no state
manager, no virtualization).

**Pith** (`sheet/pith/app/model.js`, as in the demo's `model.js`). Each cell that has something in it, or that a
formula reads, is a `signal` (its raw text) and a `computed` (its value), made lazily in a `root()` of its own.
A formula's computed reads other cells' computeds through `evaluate`'s `get`, so it depends on exactly those.
A cell on a cycle gets a `cycle` signal set (worked out with `analyse()` when formulas change) and reads nothing.
Each edit is one `batch()`. The grid is `repeat()` over the rows in view; each drawn cell's text and class are
two holes that read its computed, so an edit updates just the cells whose values changed. A blank cell with
no signals reads its row's "born" counter, so it updates when the cell is made.

**Vue 3** (`sheet/vue/src/model.js`). The same design, Vue's own fine-grained way: a `shallowRef` (raw) and a
`computed` (value) per cell, made lazily in one detached `effectScope`. Vue's computeds are lazy: a value is
worked out when something reads it. The grid is `v-for` over the rows in view, one `SheetRow` component per
row (so only rows whose cells changed re-render), and the summary is a component of its own. `<script setup>`.

**React 19** (`sheet/react/src/sheet.js`). What a React developer writes without a signals library:
- The cells are state, `{ cells, refs }`, replaced immutably on each edit (`cells`: id → raw text and its parsed
  form; `refs`: id → the cells a formula reads, a new Map only when some formula's references change).
- The values are derived in render with `useMemo`, in two steps: the dependency order and cycles
  (`analyse()` over `refs`, so worked out again only when a formula's references change), then every value,
  each formula evaluated once in that order with a Map as the memo. A plain edit (a number) reuses the order.
- Rows are `React.memo` components that get their row's 26 texts and kinds, with a comparison of those, so a
  row whose texts didn't change skips rendering. The formula bar is a controlled input.

Why not more: making React incremental (re-evaluating only the cells downstream of an edit) means keeping a
reverse-dependency graph, dirty marks and a topological re-run of the changed part: writing a small reactive
library, which is what the comparison is about. "No signals library" means a React app recomputes its
derived data from state, and `useMemo` + `memo` is how it keeps that cheap. Nothing here is sandbagged: parsing
happens once per edit (the parsed form is stored with the text), the order is cached across value-only edits,
evaluation is one pass with no repeats, and only changed rows render.

The flip side is measured too: "edit one cell nobody reads" costs React a full re-evaluation (about 4,000
formulas), and Pith and Vue almost nothing.

**Eager vs lazy.** Pith's computeds update when what they read changes, even with nothing reading them (the
statuses of rows off screen). Vue's are lazy and update when read. React evaluates every formula. That's
each framework's own model, not something the apps choose.

## Update timing
Every operation in `measure.js` goes through the page as a person would: a click on a button, Enter in the
formula bar (`requestSubmit()`), or a scroll event on the grid's box (scrollTop set, then a `scroll` event
dispatched, as a browser does a frame later). Then `run()` resolves when the DOM shows the result, checked the
same way for all three: first after the event's microtasks, then after each further macrotask tick (the
`__m.tick` of measure.mjs).
- Pith updates the DOM synchronously, inside the event.
- Vue flushes in a microtask.
- React 19 flushes a click's or submit's update (a discrete event) in a microtask, and schedules a scroll's
  update (a continuous event) in a task of its own, so a scroll can take one more tick in React.
No `flushSync`: each framework updates the way it would for a user. `measure.mjs` adds its own tick and
forces style and layout before stopping the clock. `ok()` checks the DOM's values: after Edit A1, G4 (= D1000),
the summary's final balance and D2 (= A1 + C2); after Fill, the final balance against `finalBalance()`.
`window.bench` calls from outside an event (the stress test, memory) are scheduled by React as default
updates; the scripts wait for the DOM to show the result before going on.

## Flows (`flows/sheet.js`)
Typing a number and `=A1*2` (the formula follows), `#CYCLE!` (and recovering) and `#DIV/0!`, Fill demo data then
Edit A1 (the expected final balance, also at D1000 after scrolling there), scrolling to row 900 (row 900
drawn, row 1 gone, only rows in view drawn), and Clear.
