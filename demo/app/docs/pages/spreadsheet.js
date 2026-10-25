import { html } from 'pith';
import { code, note, c } from '../ui.js';

export default () => html`
  <p>A spreadsheet of 1,000 rows and 26 columns with formulas: numbers, text, ${c('=A1+B2*3')}, ${c('SUM')},
    ${c('AVERAGE')}, ${c('MIN')}, ${c('MAX')}, ${c('COUNT')}, ${c('IF')} and ${c('ROUND')}. It's the hardest test of
    Pith's signals: every cell with something in it is a signal and a computed, and the demo budget makes a chain of
    values 1,000 cells deep, where changing the top cell changes every cell below it.</p>

  <h2 id="try">What to try</h2>
  <ul>
    <li>Click a cell and type ${c('5')}, then in the cell beside it ${c('=A1*2')}. Change the first one: the second
      follows. The formula bar above the grid shows what's typed in the active cell; edit there or in the cell.</li>
    <li>Make a circle: ${c('=B1')} in A1 and ${c('=A1')} in B1. Both show ${c('#CYCLE!')}, and the page carries on.
      Change either to a number and the other gets its value. Divide by zero for ${c('#DIV/0!')}, refer to ${c('A1001')}
      for ${c('#REF!')}, or call ${c('=FOO(1)')} for ${c('#NAME?')}.</li>
    <li>Press Fill demo data: a budget of 1,000 months. A1 is the opening balance; each row has an income (A), costs (B),
      the net (${c('=A2-B2')}), the balance (${c('=D1+C2')}, the one above plus this month's net) and a status. G1:G4 sum
      it up with ${c('MIN')}, ${c('AVERAGE')} and ${c('SUM')} over whole columns. Or open
      <a href="/sheet?demo">${c('/sheet?demo')}</a>, which starts with it (unless your sheet has something in it).</li>
    <li>Press Edit A1. The bar shows how many cells were recomputed (A1, the 1,000 balances, the sums, and the
      statuses on screen: the ones scrolled away have no reader, so they wait until you scroll to them) and how long it
      took. Scroll to row 900 and watch it change too.</li>
    <li>Turn on Random edits at 100 or 1,000 a second: incomes and costs in random months change, and every balance
      below them follows. The bar shows the edits, the cells recomputed and the time a frame takes.</li>
    <li>Keyboard: arrows move, Shift+arrows select a range, Enter or F2 edits, typing replaces, Escape cancels, Tab saves
      and moves right. Ctrl+Z and Ctrl+Y undo and redo. Ctrl+C copies a range as tab-separated text (paste it in another
      spreadsheet), Ctrl+V pastes one. Delete clears the selection.</li>
    <li>Reload: the sheet is saved in this browser. Open it in a second tab and edit: the first follows.</li>
  </ul>

  <h2 id="built">How it's built</h2>
  <ul>
    <li>${c('app/pages/sheet.js')}: the page. The bar with Undo, Redo, Clear and the stress tools, which time their
      edits, the formula bar, and the grid.</li>
    <li>${c('app/sheet/formula.js')}: reading what's typed and working out a formula, as pure functions with no signals:
      a small parser, the functions, the error values, and the search for cycles (Tarjan's, without recursion). Tested in
      Node by ${c('tests/sheet.test.mjs')}.</li>
    <li>${c('app/sheet/model.js')}: the cells as signals, undo and redo, saving to a store, and the demo data.</li>
    <li>${c('app/sheet/grid.js')}: the grid. ${c('windowed()')} works out which rows are in view; the grid draws those, with
      the keyboard, the mouse, editing, and copy and paste.</li>
  </ul>

  <h2 id="pith">The Pith parts it uses</h2>
  <ul>
    <li><a href="/docs/signals">Signals</a>: a ${c('signal()')} for what's typed in each cell and a ${c('computed()')} for
      its value; ${c('batch()')} around each edit (a paste, a step of Random edits), so each cell is worked out once.</li>
    <li><a href="/docs/lists">Lists</a>: ${c('repeat()')} over the rows in view, keyed by row number, so scrolling adds and
      removes rows at the edges and keeps the rest.</li>
    <li><a href="/docs/selector">Selecting a row</a>: ${c('selector()')} highlights the active row and column header.</li>
    <li><a href="/docs/store">Shared state</a>: ${c('createStore()')} saves the sheet and follows other tabs.</li>
  </ul>

  <h2 id="code">The interesting parts</h2>
  <h3 id="code-cells">A cell is a signal and a computed</h3>
  <p>A formula's computed reads the value of each cell it uses, so it subscribes to exactly those. Changing a cell
    recomputes the cells that read it, and the cells that read those, and nothing else. A blank cell that no formula reads
    has no signals, so the sheet costs only the cells in use. A cell on a circular reference is flagged before its value
    is worked out: it shows ${c('#CYCLE!')} and reads nothing, so the signals never go round in a loop.</p>
  ${code(`
const c = { id, raw: signal(raw), cycle: signal(cyclic) };
c.value = computed(() => {
  const text = c.raw.value;
  if (c.cycle.value) return ERR.CYCLE;          // on a circular reference: read nothing
  const input = parseInput(text);               // (kept until the text changes)
  if (input.kind !== 'formula') return input.value;
  return evaluate(input.ast, read);             // read(id) = the other cell's value.value: a subscription
});`, { file: 'app/sheet/model.js' })}
  <p>Cells are made lazily, sometimes while another cell's formula is being worked out (${c('=A1+Z900')}, where Z900 was
    blank). Each is made in a ${c('root()')} of its own, so it belongs to the sheet and not to the computed that happened
    to need it.</p>

  <h3 id="code-order">Once each, in order: what this example changed in Pith</h3>
  <p>Before this example, Pith ran effects in waves, in the order they were told about a change. A 1,000-deep chain took
    1,000 waves, which tripped the "effects kept updating each other" guard (${c('E003')}), and a cell that read the whole
    chain, like ${c('=MIN(D1:D1000)')}, was worked out again in every wave: 999 times for one edit, seeing half-updated
    balances in between. Now each effect and computed has a level, one above the deepest computed it reads, and a change
    runs the lowest level first. So a computed runs once per change, after everything it reads, and a chain can be any
    length (nothing recurses). An effect made inside another starts above it, so a parent that removes it goes first.
    The tests are in ${c('framework/tests/signal.test.mjs')}.</p>
  ${note(html`The cost is about 75 bytes (the core is still under 10 KB) and a comparison per read. On the
    <a href="/docs/benchmarks">benchmark</a> table, before and after alternated in one session (3 rounds), every operation
    stayed within 2%; selecting a row went from 0.30 to 0.35 ms, under the timer's 0.1 ms steps.`)}

  <h3 id="code-window">Drawing 26,000 cells: a window, written in the app</h3>
  <p>Pith has no virtual scrolling in its core: most lists should be short or paged, and when one can't be, the
    window is a few lines of app code. Every row is 32 pixels tall, so the rows in view follow from the scroll position
    and the box's height. The grid draws those (plus 8 above and below), each placed at its index × 32 pixels in a body
    as tall as all 1,000 rows, so the scrollbar is right. The span is a string, so scrolling inside a row changes
    nothing.</p>
  ${code(`
export function windowed({ count, rowHeight, offset = 0, overscan = 6 }) {
  const top = signal(0);
  const height = signal(800);
  const span = computed(() => {
    const first = Math.max(0, Math.floor((top.value - offset) / rowHeight) - overscan);
    const last = Math.min(count - 1, Math.ceil((top.value + height.value - offset) / rowHeight) + overscan);
    return \`\${first}:\${last}\`;
  });
  const rows = computed(() => {
    const [first, last] = span.value.split(':').map(Number);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  });
  const ref = (el) => {
    el.addEventListener('scroll', () => (top.value = el.scrollTop), { passive: true });
    const seen = new ResizeObserver(() => ((height.value = el.clientHeight), (top.value = el.scrollTop)));
    seen.observe(el);
    onCleanup(() => seen.disconnect());
  };
  …
}

html\`<div class="sheet-scroll" ref=\${win.ref}>
  …<div class="sheet-body" style=\${\`height: \${ROWS * ROW_H}px\`}>\${repeat(win.rows, (r) => r, row)}</div>
</div>\`;`, { file: 'app/sheet/grid.js' })}
  <p>The active cell and the selection are two boxes drawn over the cells, not a class on each cell. The grid is a
    ${c('role="grid"')} with ${c('aria-rowcount')} and ${c('aria-colcount')} for the whole sheet, ${c('aria-rowindex')}
    on each drawn row, and ${c('aria-activedescendant')} naming the active cell, so a screen reader says where you are.
    It isn't animated: its rows are in a scroll box (W051).</p>

  <h3 id="numbers">Measured</h3>
  <p>Measured in headless Chrome on a desktop, on the production build (${c('npm run build')}), at 1440 × 900, reading the
    numbers the bar shows (25 runs of Edit A1 after 5 to warm up; 5 seconds of Random edits at each rate), with the demo
    budget:</p>
  <ul>
    <li><strong>Edit A1</strong> recomputes about 1,030 cells (A1, the 1,000 balances, the sums that read them, and the
      statuses on screen; the other statuses have no reader, so they skip it), each once, and updates the rows on screen
      in <strong>3.1 ms</strong> (median; the slowest 4.4 ms). It's on screen 12 ms after the click. Before Pith ordered
      its updates, this edit failed with ${c('E003')}; on 2026-10-25 it took 8.7 ms, before computeds nobody reads
      skipped their updates and signals became small objects.</li>
    <li><strong>Random edits</strong> at 100 a second: about <strong>36,000 cells recomputed a second</strong>, about 2 ms
      a frame (the worst in a second under 5 ms), and the page kept drawing at 60 frames a second.</li>
    <li>At 1,000 a second (about 16 edits in each frame's ${c('batch()')}, so a balance below several of them is still
      worked out once): about <strong>61,000 cells a second</strong>, 3 ms a frame (the worst 5 to 6 ms).</li>
    <li><strong>Fill demo data</strong> (5,007 cells; the 4,033 values in use worked out once, in order) takes 25 to 46 ms.</li>
    <li>The same sheet written in React and Vue: <a href="/docs/benchmarks?view=sheet">Benchmarks</a>.</li>
  </ul>
  <p>The bar shows the same numbers on your machine.</p>

  <h2 id="tests">Its tests</h2>
  <p>In ${c('tests/sheet.test.mjs')} (Node): cell names, reading what's typed, arithmetic and precedence, the
    functions, every error value, and finding cycles in a 20,000-deep chain. In ${c('tests/flows.js')}:</p>
  <ul>
    <li>sheet: typing a number and a formula, and the formula follows</li>
    <li>sheet: circular references show #CYCLE! and recover; #DIV/0!, #REF! and #NAME?</li>
    <li>sheet: the keyboard moves, edits and cancels; undo and redo</li>
    <li>sheet: scrolling to row 900 draws it, and editing there works</li>
    <li>sheet: Fill demo data, then Edit A1 updates the whole 1,000-deep chain once each</li>
    <li>sheet: pasting tab-separated text fills a range, as one step of undo</li>
  </ul>
`;
