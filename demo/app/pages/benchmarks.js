import { html, signal, computed } from 'pith';
import { router } from '../router.js';
import data from '../data/benchmarks.js'; // generated from ../compare/results/measure.json (npm run benchmarks)

// What this very page load cost, measured by the browser (Resource and Paint Timing).
function measure() {
  const resources = /** @type {PerformanceResourceTiming[]} */ (performance.getEntriesByType('resource'));
  const scripts = resources.filter((r) => new URL(r.name).pathname.endsWith('.js'));
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  return {
    kb: (scripts.reduce((sum, r) => sum + (r.encodedBodySize || r.decodedBodySize || 0), 0) / 1024).toFixed(1),
    files: scripts.length,
    fcp: fcp ? Math.round(fcp.startTime) : null,
  };
}

const NAMES = { pith: 'Pith', 'pith-vite': 'Pith + Vite', react: 'React', vue: 'Vue' };
const APPS = {
  trade: { name: 'Trading', href: '/docs/trading', note: 'A watchlist of prices that tick, a candlestick chart, an order book, trades and positions with live P&L.' },
  sheet: { name: 'Spreadsheet', href: '/docs/spreadsheet', note: '1,000 × 26 cells of formulas, with a running total 1,000 cells deep.' },
};
// What each operation does, in a sentence.
const OPS = {
  'step: 40 of 40 symbols': 'Every price in a 40-symbol watchlist ticks once, and the chart, book and P&L follow.',
  'switch symbol': 'Pick another symbol: its chart, order book, trades and quote replace the old ones.',
  'step: 1,000 of 1,000 symbols': 'All 1,000 prices tick at once (mostly the browser’s style and layout).',
  'step: 10 of 1,000 symbols': 'Ten of 1,000 prices tick: does the cost follow what changed, or the size of the list?',
  'fill demo data': 'From empty to about 5,000 cells: every value worked out once.',
  'Edit A1 (1,000-deep chain)': 'Change the cell at the top of the chain: 1,000 running totals follow.',
  'edit one cell nobody reads': 'Change a cell no formula uses: does the cost follow what changed?',
  'scroll one screen': 'Scroll the grid one screen: the new rows are drawn.',
  clear: 'Empty all 5,000 cells.',
};
const VIEWS = [['load', 'Load'], ['trade', 'Trading'], ['sheet', 'Spreadsheet'], ['memory', 'Memory'], ['size', 'Size']];
const PROTOCOLS = [['h1', 'HTTP/1.1'], ['h2', 'HTTP/2']];

const num = (v) => v.toLocaleString('en-US');
const capital = (s) => s[0].toUpperCase() + s.slice(1);
const percent = (a, b) => Math.round(Math.abs(1 - a / b) * 100);
const times = (a, b) => `${(b / a).toFixed(1)}×`;
const check = () => html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const isPith = (key) => key.startsWith('pith');
const rivalOf = (v) => (v.react <= v.vue ? 'react' : 'vue');

/** A horizontal bar chart: one row per framework, bar width = value / max, the exact value as text. */
function chart(title, unit, values, { note = '', hideTitle = false, high = false, format = (v, key) => `${num(v)} ${unit}` } = {}) {
  const entries = Object.entries(values);
  const max = Math.max(...entries.map(([, v]) => v));
  const best = (high ? Math.max : Math.min)(...entries.map(([, v]) => v));
  return html`
    <figure class="bar-chart">
      <figcaption class=${hideTitle ? 'sr-only' : null}><span class="bar-title">${title}</span>${note ? html`<span class="bar-note muted">${note}</span>` : null}</figcaption>
      <ul class="bars">
        ${entries.map(([key, v]) => html`
          <li class=${`bar-row ${key === 'pith' ? 'is-pith' : isPith(key) ? 'is-pith-variant' : ''}`} data-impl=${key}>
            <span class="bar-label">${NAMES[key]}</span>
            <span class="bar-line">
              <span class="bar" aria-hidden="true" style=${`--w: ${(v / max).toFixed(4)}`}></span>
              <span class="bar-value">${format(v, key)}</span>
              ${v === best ? html`<span class="bar-best">Best</span>` : null}
            </span>
          </li>`)}
      </ul>
    </figure>
  `;
}

const field = (byImpl, f) => Object.fromEntries(Object.entries(byImpl).map(([k, v]) => [k, Math.round(v[f] * 10) / 10]));

function LoadView(protocol) {
  return html`
    <section class="section bench-view" aria-labelledby="view-title">
      <div class="bench-view-head">
        <div>
          <h2 id="view-title">Loading on a slow phone</h2>
          <p class="muted">Slow 4G and a 4× slower CPU, a fresh browser each run. Milliseconds, lower is better.</p>
        </div>
        <div class="segmented bench-seg" role="group" aria-label="Protocol">
          ${PROTOCOLS.map(([key, label]) => html`
            <button type="button" aria-pressed=${() => String(protocol.value === key)}
                    @click=${() => router.setQuery({ protocol: key === 'h1' ? null : key })}>${label}</button>`)}
        </div>
      </div>
      ${() => loadCharts(protocol.value)}
    </section>
  `;
}

function loadCharts(protocol) {
  const apps = data.load[protocol];
  const t = field(apps.trade, 'ready');
  return html`
      <p class="bench-summary">Trading is on screen <strong>${percent(t.pith, t.react)}% sooner than React</strong> in Pith without a
        build, and ${t.pith <= t.vue ? `${percent(t.pith, t.vue)}% sooner` : `${percent(t.pith, t.vue)}% later`} than Vue.
        Bundled with Vite, Pith is first: ${percent(t['pith-vite'], t.react)}% sooner than React, ${percent(t['pith-vite'], t.vue)}% sooner than Vue.</p>
      <div class="bench-grid wide">
        ${Object.entries(apps).map(([app, byImpl]) => html`
          <article class="card bench-card">
            <h3>${APPS[app].name}</h3>
            <p class="muted note">${APPS[app].note}</p>
            <div class="bench-pair">
              ${chart('Ready', 'ms', field(byImpl, 'ready'), { note: 'The real content is on screen.' })}
              ${chart('First paint', 'ms', field(byImpl, 'fcp'), { note: 'The browser first drew something.' })}
            </div>
          </article>`)}
      </div>
  `;
}

function AppView(app) {
  const ops = Object.entries(data.runtime[app]);
  const runs = Object.entries(data.stress[app] ?? {});
  const leads = ops.filter(([, v]) => v.pith <= Math.min(v.react, v.vue) * 1.1).length;
  const summary = app === 'trade'
    ? (() => {
        const v = data.runtime.trade['step: 10 of 1,000 symbols'];
        return html`When 10 of 1,000 prices tick, Pith updates the page in <strong>${num(v.pith)} ms</strong>: ${times(v.pith, v.react)} faster
          than React (${num(v.react)} ms), and ${v.pith <= v.vue ? `ahead of Vue (${num(v.vue)} ms)` : `behind Vue (${num(v.vue)} ms)`}.
          Pith is fastest or within 10% on <strong>${leads} of ${ops.length}</strong> operations.`;
      })()
    : (() => {
        const leaf = data.runtime.sheet['edit one cell nobody reads'];
        const a1 = data.runtime.sheet['Edit A1 (1,000-deep chain)'];
        const fill = data.runtime.sheet['fill demo data'];
        const best = (v) => NAMES[['pith', 'react', 'vue'].sort((a, b) => v[a] - v[b])[0]];
        return html`An edit nobody else reads costs Pith <strong>${num(leaf.pith)} ms</strong> (React ${num(leaf.react)}, Vue ${num(leaf.vue)}):
          only what changed recomputes. On the 1,000-deep chain ${best(a1)} is fastest (Pith ${num(a1.pith)} ms, React ${num(a1.react)},
          Vue ${num(a1.vue)}), and filling the sheet ${best(fill)} (React builds no reactive cells at all).`;
      })();
  return html`
    <section class="section bench-view" aria-labelledby="view-title">
      <h2 id="view-title">${APPS[app].name}</h2>
      <p class="muted">${APPS[app].note} <a href=${APPS[app].href}>The full example</a>. On a desktop CPU, from the call until the
        DOM is updated and laid out. Milliseconds, lower is better.</p>
      <p class="bench-summary">${summary}</p>
      <div class="bench-grid">
        ${ops.map(([op, values]) => html`<article class="card bench-card">${chart(capital(op), 'ms', values, { note: OPS[op] ?? '' })}</article>`)}
      </div>
      ${runs.length ? html`
        <h3 class="bench-sub">Under load</h3>
        <p class="muted">Five seconds of sustained work while every frame is recorded. Frames a second, higher is better.
          ${runs.every(([, byImpl]) => { const f = Object.values(byImpl).map((v) => v.fps); return Math.max(...f) <= Math.min(...f) * 1.15; })
            ? 'All four draw within 15% of each other here: the browser’s own work is the limit, not the framework.' : ''}</p>
        <div class="bench-grid">
          ${runs.map(([name, byImpl]) => html`
            <article class="card bench-card">
              ${chart(capital(name), 'fps', field(byImpl, 'fps'), { high: true,
                note: `The slowest frames (95th percentile): ${Object.entries(byImpl).map(([k, v]) => `${NAMES[k]} ${num(Math.round(v.frameP95))} ms`).join(', ')}.` })}
            </article>`)}
        </div>` : null}
    </section>
  `;
}

const MEMORY_NOTES = { trade: 'Each of the 1,000 rows holds its own signals in Pith and Vue; React keeps plain objects and re-renders.', sheet: 'Every cell with something in it is a reactive value in Pith and Vue; React keeps the raw text and works the values out.' };

const leastOf = (v) => NAMES[['pith', 'react', 'vue'].sort((a, b) => v[a] - v[b])[0]];

function MemoryView() {
  const t = data.memory.trade['1,000 symbols'];
  const sh = data.memory.sheet['demo data'];
  return html`
    <section class="section bench-view" aria-labelledby="view-title">
      <h2 id="view-title">Memory</h2>
      <p class="muted">The JavaScript heap after a forced garbage collection. Megabytes, lower is better.</p>
      <p class="bench-summary">Trading with 1,000 symbols takes <strong>${num(t.pith)} MB in Pith</strong>, ${num(t.react)} in React and
        ${num(t.vue)} in Vue (${leastOf(t)} holds the least). The full spreadsheet takes ${num(sh.pith)} MB in Pith, ${num(sh.react)} in React
        and ${num(sh.vue)} in Vue (${leastOf(sh)} holds the least).</p>
      ${Object.entries(data.memory).map(([app, states]) => html`
        <h3 class="bench-sub">${APPS[app].name}</h3>
        <p class="muted note">${MEMORY_NOTES[app]}</p>
        <div class="bench-grid">
          ${Object.entries(states).map(([state, values]) => html`
            <article class="card bench-card">${chart(capital(state), 'MB', values)}</article>`)}
        </div>`)}
    </section>
  `;
}

function SizeView() {
  const apps = data.load.h1;
  const t = field(apps.trade, 'jsKB');
  return html`
    <section class="section bench-view bench-size" aria-labelledby="view-title">
      <h2 id="view-title">Size</h2>
      <p class="muted">JavaScript downloaded to show each app, gzipped, as a real host sends it. Kilobytes, lower is better.</p>
      <p class="bench-summary">Trading needs <strong>${num(t.pith)} KB of JavaScript</strong> in Pith without a build, app included
        (${num(t['pith-vite'])} KB bundled). Vue sends ${num(t.vue)} KB and React ${num(t.react)} KB.</p>
      <div class="bench-grid wide">
        ${Object.entries(apps).map(([app, byImpl]) => html`
          <article class="card bench-card">
            <h3>${APPS[app].name}</h3>
            ${chart(`JavaScript for ${APPS[app].name}`, 'KB', field(byImpl, 'jsKB'), {
              hideTitle: true,
              format: (v, key) => `${num(v)} KB · ${byImpl[key].jsFiles} ${byImpl[key].jsFiles === 1 ? 'file' : 'files'}`,
            })}
          </article>`)}
      </div>
    </section>
  `;
}

// Where Pith is behind, read from the numbers (so it stays true when they're measured again).
function behind() {
  const rows = Object.entries(data.runtime).flatMap(([app, ops]) => Object.entries(ops).flatMap(([op, v]) => {
    const rival = rivalOf(v);
    return v.pith > v[rival] ? [{ op: `${APPS[app].name}: ${op}`, pith: v.pith, rival, value: v[rival], pct: percent(v.pith, v[rival]), unit: 'ms' }] : [];
  }));
  // Memory: each app's state where Pith is furthest behind.
  for (const [app, states] of Object.entries(data.memory)) {
    const worst = Object.entries(states).map(([state, v]) => ({ state, v, rival: rivalOf(v) }))
      .filter((x) => x.v.pith > x.v[x.rival]).sort((a, b) => b.v.pith / b.v[b.rival] - a.v.pith / a.v[a.rival])[0];
    if (worst) rows.push({ op: `${APPS[app].name}: memory, ${worst.state}`, pith: worst.v.pith, rival: worst.rival, value: worst.v[worst.rival], pct: percent(worst.v.pith, worst.v[worst.rival]), unit: 'MB' });
  }
  const unbundled = Object.values(data.load).flatMap((apps) => Object.values(apps).map((a) => percent(a.pith.ready, a['pith-vite'].ready)));
  return { rows: rows.filter((r) => r.pct >= 1).sort((a, b) => b.pct - a.pct), unbundled: [Math.min(...unbundled), Math.max(...unbundled)] };
}

export default function BenchmarksPage() {
  const now = signal(null);
  if (document.readyState === 'complete') now.value = measure();
  else addEventListener('load', () => setTimeout(() => (now.value = measure())), { once: true });

  // computed: a change to ?protocol= doesn't rebuild the whole view (and lose focus), only its charts.
  const view = computed(() => (VIEWS.some(([k]) => k === router.query.value.view) ? router.query.value.view : 'load'));
  const protocol = computed(() => (router.query.value.protocol === 'h2' ? 'h2' : 'h1'));
  const views = { load: () => LoadView(protocol), trade: () => AppView('trade'), sheet: () => AppView('sheet'), memory: MemoryView, size: SizeView };
  const gaps = behind();

  // The four numbers people ask about, read from the measurements.
  const ready = field(data.load.h1.trade, 'ready');
  const tick = data.runtime.trade['step: 10 of 1,000 symbols'];
  const js = field(data.load.h1.trade, 'jsKB');
  const ops = Object.values(data.runtime).flatMap((o) => Object.values(o));
  const close = ops.filter((v) => v.pith <= Math.min(v.react, v.vue) * 1.1).length;
  const score = [
    { value: percent(ready.pith, ready.react), unit: '%', label: 'sooner on screen than React', pith: ready.pith, rival: ready.react,
      note: `Trading on a slow phone, no build: ${num(Math.round(ready.pith))} ms vs ${num(Math.round(ready.react))} ms` },
    { value: times(tick.pith, tick.react), unit: '', label: 'faster than React when 10 of 1,000 prices tick', pith: tick.pith, rival: tick.react,
      note: `${num(tick.pith)} ms vs ${num(tick.react)} ms (React) and ${num(tick.vue)} ms (Vue)` },
    { value: num(js.pith), unit: ' KB', label: 'of JavaScript for Trading, no build', pith: js.pith, rival: Math.min(js.react, js.vue),
      note: `Vue ${num(js.vue)} KB, React ${num(js.react)} KB` },
    { value: `${close}/${ops.length}`, unit: '', label: 'operations fastest or within 10%', pith: close, rival: ops.length, bars: false,
      note: 'Ticks, switching, filling, editing, scrolling and clearing, in both apps' },
  ];

  const stat = (value, label) => html`<li class="card stat"><span class="value">${value}</span><span class="stat-label">${label}</span></li>`;
  return html`
    <div class="bench-page">
    <header class="bench-head">
      <span class="badge soft">Measured, not claimed</span>
      <h1>Benchmarks</h1>
      <p class="lead">The same apps in Pith, React and Vue, loaded and clicked the same way.</p>
      <p class="muted note">Measured ${data.measured} in ${data.browser} · medians of many runs · <a href="#method">how it was measured</a></p>
    </header>

    <ul class="scoreboard" aria-label="The headline numbers">
      ${score.map((s) => html`
        <li class="score">
          <span class="score-value">${s.value}<small>${s.unit}</small></span>
          <span class="score-label">${s.label}</span>
          ${s.bars === false ? null : html`<span class="score-bars" aria-hidden="true">
            <span class="score-bar pith" style=${`--w: ${s.pith / Math.max(s.pith, s.rival)}`}></span>
            <span class="score-bar" style=${`--w: ${s.rival / Math.max(s.pith, s.rival)}`}></span>
          </span>`}
          <span class="score-note muted">${s.note}</span>
        </li>`)}
    </ul>

    <div class="bench-switch">
      <div class="segmented bench-seg" role="group" aria-label="Benchmark">
        ${VIEWS.map(([key, label]) => html`
          <button type="button" aria-pressed=${() => String(view.value === key)}
                  @click=${() => router.setQuery({ view: key === 'load' ? null : key })}>${label}</button>`)}
      </div>
    </div>

    ${() => views[view.value]()}

    <div class="bench-pair-sections">
    <section class="section" aria-labelledby="behind">
      <h2 id="behind">Where Pith is behind</h2>
      <p class="muted">Not every number is a win. Differences under 10% are within the noise between sessions.</p>
      <ul class="card bench-behind">
        ${gaps.rows.map((r) => html`
          <li>
            <span class="behind-op">${capital(r.op)}</span>
            <span>Pith ${num(r.pith)} ${r.unit}, ${NAMES[r.rival]} ${num(r.value)} ${r.unit}: <strong>${r.pct >= 100 ? `${(r.pith / r.value).toFixed(1)}× ${r.unit === 'MB' ? 'more' : 'slower'}` : `${r.pct}% ${r.unit === 'MB' ? 'more' : 'slower'}`}</strong>${r.pct < 10 ? html`<span class="muted"> (within the noise)</span>` : null}</span>
          </li>`)}
        <li>
          <span class="behind-op">No build</span>
          <span>Without a build, Pith is ready <strong>${gaps.unbundled[0]}–${gaps.unbundled[1]}% later</strong> than Pith + Vite:
            the browser fetches the app's files one by one instead of one bundle.</span>
        </li>
      </ul>
      <p class="note">The spreadsheet's fill and clear are where reactivity costs most: Pith and Vue build (and take down) a reactive
        value for each of 5,000 cells, React only stores text. The same values make Pith's and Vue's memory higher. In return, an
        edit recomputes only what depends on it.</p>
      <p class="note">Not measured at all: server rendering, the ecosystem, hiring and years of maintenance, where React and Vue are far ahead.</p>
    </section>

    <section class="section" aria-labelledby="method">
      <h2 id="method">How it was measured</h2>
      <ul class="check-list bench-method">
        <li>${check()}<span><strong>Same apps, same flows.</strong> A trading screen and a spreadsheet, each written in Pith,
          React 19 and Vue 3 the way their docs recommend, sharing the code that isn't the framework's (the price feed, the
          formulas), and each passing the same user flows.</span></li>
        <li>${check()}<span><strong>Load:</strong> Chrome with a fresh profile per run, Slow 4G (150 ms round trip, 1.6 Mbps) and 4× CPU
          slowdown, served gzipped over HTTP/1.1 and HTTP/2. Median of ${data.runs} runs.</span></li>
        <li>${check()}<span><strong>Runtime:</strong> 3 warm-up and 10 measured runs with garbage collection in between, in 3 fresh pages,
          over 4 rounds with the frameworks in a rotated order. Medians. Each result is checked in the page.</span></li>
        <li>${check()}<span><strong>Under load:</strong> five seconds of ticks or edits on a timer, every frame recorded.</span></li>
        <li>${check()}<span><strong>Memory:</strong> the JavaScript heap after a forced garbage collection.</span></li>
        <li>${check()}<span><strong>Pith</strong> runs as deployed without a build (its one-file production copy, no dev warnings);
          "Pith + Vite" bundles the app too, to show what skipping the build costs.</span></li>
      </ul>
      <h3>Caveats</h3>
      <ul class="list note">
        <li>Runtime numbers vary up to ±10% between sessions; smaller differences don't mean much.</li>
        <li>Headless Chrome on one machine: no real phones, no other browsers.</li>
        <li>Two apps, one screen each: routing, data loading and forms aren't in these numbers.</li>
        <li>No extra libraries: React has no signals or state library, which would change its spreadsheet numbers.</li>
      </ul>
    </section>
    </div>

    <section class="section" aria-labelledby="now">
      <h2 id="now">This page, right now</h2>
      <p class="muted">What your browser downloaded and when it first painted, for this visit.</p>
      ${() => (now.value
        ? html`<ul class="now-strip">
            ${stat(now.value.kb, 'KB of JavaScript, as sent')}
            ${stat(now.value.files, 'JavaScript files')}
            ${stat(now.value.fcp == null ? '–' : `${now.value.fcp} ms`, 'until first paint')}
          </ul>`
        : html`<p class="loading">Measuring…</p>`)}
    </section>
    </div>
  `;
}
