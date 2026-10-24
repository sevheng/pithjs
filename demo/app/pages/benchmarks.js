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

const NAMES = { pith: 'Pith', 'pith-vite': 'Pith + Vite', react: 'React', vue: 'Vue', 'pith-fine': 'Pith, fine-grained' };
const PAGES = { todo: 'Todo app', crm: 'CRM, start page', 'crm/customers': 'CRM, customer list' };
const PAGE_NOTES = { todo: 'One page: the list from localStorage.', crm: 'Ready when the stats are on the page.', 'crm/customers': 'A lazy route: ready when the table rows are in.' };
const MEMORY = { ready: 'Empty page', '1,000 rows': '1,000 rows', '10,000 rows': '10,000 rows', 'after 5 create/clear': 'After 5 create/clear cycles' };
const VIEWS = [['load', 'Load'], ['runtime', 'Runtime'], ['memory', 'Memory'], ['size', 'Size']];
const PROTOCOLS = [['h1', 'HTTP/1.1'], ['h2', 'HTTP/2']];

const num = (v) => v.toLocaleString('en-US');
const capital = (s) => s[0].toUpperCase() + s.slice(1);
const percent = (a, b) => Math.round(Math.abs(1 - a / b) * 100);
const check = () => html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const isPith = (key) => key.startsWith('pith');

/** A horizontal bar chart: one row per framework, bar width = value / max, the exact value as text. */
function chart(title, unit, values, { note = '', hideTitle = false, format = (v, key) => `${num(v)}\u00a0${unit}` } = {}) {
  const entries = Object.entries(values);
  const max = Math.max(...entries.map(([, v]) => v));
  const best = Math.min(...entries.map(([, v]) => v));
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

const only = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));
const field = (byImpl, f) => Object.fromEntries(Object.entries(byImpl).map(([k, v]) => [k, v[f]]));

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
  const pages = data.load[protocol];
  const crm = field(pages.crm, 'ready');
  return html`
      <p class="bench-summary">On the CRM, Pith is ready <strong>${percent(crm.pith, crm.react)}% sooner than React</strong>
        and ${percent(crm.pith, crm.vue)}% sooner than Vue. With Vite: ${percent(crm['pith-vite'], crm.react)}% and ${percent(crm['pith-vite'], crm.vue)}%.</p>
      <div class="bench-grid wide">
        ${Object.entries(pages).map(([page, byImpl]) => html`
          <article class="card bench-card">
            <h3>${PAGES[page]}</h3>
            <p class="muted note">${PAGE_NOTES[page]}</p>
            <div class="bench-pair">
              ${chart('Ready', 'ms', field(byImpl, 'ready'), { note: 'The content is in the page.' })}
              ${chart('First paint', 'ms', field(byImpl, 'fcp'), { note: 'The browser first drew something.' })}
            </div>
          </article>`)}
      </div>
  `;
}

function RuntimeView() {
  const ops = Object.entries(data.runtime);
  const leads = ops.filter(([, v]) => v.pith <= Math.min(v.react, v.vue) * 1.1).length;
  return html`
    <section class="section bench-view" aria-labelledby="view-title">
      <h2 id="view-title">Runtime</h2>
      <p class="muted">A table of rows, js-framework-benchmark style, on a desktop CPU. Time from the click until the DOM
        is updated and laid out. Milliseconds, lower is better.</p>
      <p class="bench-summary">Pith is fastest or within the ±10% noise on <strong>${leads} of ${ops.length} operations</strong>.
        Selecting a row takes ${num(data.runtime['select a row'].pith)} ms, against React's ${num(data.runtime['select a row'].react)} and Vue's ${num(data.runtime['select a row'].vue)}.</p>
      <div class="bench-grid">
        ${ops.map(([op, values]) => html`<article class="card bench-card">${chart(capital(op), 'ms', values)}</article>`)}
        <p class="muted note bench-aside">"Pith, fine-grained" is the same Pith app with each row's label as a signal, an opt-in
          pattern for big, busy lists. "Pith" is the default way to write it. "Pith + Vite" is Pith bundled with Vite.</p>
      </div>
    </section>
  `;
}

function MemoryView() {
  const big = data.memory['10,000 rows'];
  return html`
    <section class="section bench-view" aria-labelledby="view-title">
      <h2 id="view-title">Memory</h2>
      <p class="muted">The JavaScript heap after a forced garbage collection, in the same table app. Megabytes, lower is better.</p>
      <p class="bench-summary">With 10,000 rows Pith holds <strong>${num(big.pith)} MB</strong>: ${percent(big.pith, big.react)}% less than
        React and ${percent(big.pith, big.vue)}% less than Vue. After create/clear cycles it returns close to where it started.</p>
      <div class="bench-grid">
        ${Object.entries(data.memory).map(([state, values]) => html`
          <article class="card bench-card">${chart(MEMORY[state], 'MB', values)}</article>`)}
      </div>
    </section>
  `;
}

function SizeView() {
  const pages = data.load.h1;
  const crm = field(pages.crm, 'jsKB');
  return html`
    <section class="section bench-view bench-size" aria-labelledby="view-title">
      <h2 id="view-title">Size</h2>
      <p class="muted">JavaScript downloaded to show each page, gzipped, as a real host sends it. Kilobytes, lower is better.</p>
      <p class="bench-summary">The CRM's start page needs <strong>${num(crm.pith)}\u00a0KB of JavaScript</strong> in Pith, without a build.
        Vue sends ${num(crm.vue)}\u00a0KB and React ${num(crm.react)}\u00a0KB.</p>
      <div class="bench-grid wide">
        ${Object.entries(pages).map(([page, byImpl]) => html`
          <article class="card bench-card">
            <h3>${PAGES[page]}</h3>
            ${chart(`JavaScript for the ${PAGES[page]}`, 'KB', field(byImpl, 'jsKB'), {
              hideTitle: true,
              format: (v, key) => `${num(v)}\u00a0KB · ${byImpl[key].jsFiles}\u00a0${byImpl[key].jsFiles === 1 ? 'file' : 'files'}`,
            })}
          </article>`)}
      </div>
    </section>
  `;
}

// Where Pith is behind, read from the numbers (so it stays true when they're measured again).
function behind() {
  const rows = Object.entries(data.runtime).flatMap(([op, v]) => {
    const rival = v.react <= v.vue ? 'react' : 'vue';
    return v.pith > v[rival] ? [{ op, pith: v.pith, rival, value: v[rival], pct: percent(v.pith, v[rival]) }] : [];
  }).sort((a, b) => b.pct - a.pct);
  const unbundled = Object.values(data.load).flatMap((pages) =>
    ['crm', 'crm/customers'].map((p) => percent(pages[p].pith.ready, pages[p]['pith-vite'].ready)));
  const update = data.runtime['update every 10th row'];
  return { rows, unbundled: [Math.min(...unbundled), Math.max(...unbundled)], update };
}

export default function BenchmarksPage() {
  const now = signal(null);
  if (document.readyState === 'complete') now.value = measure();
  else addEventListener('load', () => setTimeout(() => (now.value = measure())), { once: true });

  // computed: a change to ?protocol= doesn't rebuild the whole view (and lose focus), only its charts.
  const view = computed(() => (VIEWS.some(([k]) => k === router.query.value.view) ? router.query.value.view : 'load'));
  const protocol = computed(() => (router.query.value.protocol === 'h2' ? 'h2' : 'h1'));
  const views = { load: () => LoadView(protocol), runtime: RuntimeView, memory: MemoryView, size: SizeView };
  const gaps = behind();

  // The four numbers people ask about, read from the measurements.
  const crm = field(data.load.h1.crm, 'ready');
  const mem = data.memory['10,000 rows'];
  const js = field(data.load.h1.crm, 'jsKB');
  const ops = Object.values(data.runtime);
  const close = ops.filter((v) => v.pith <= Math.min(v.react, v.vue) * 1.1).length;
  const score = [
    { value: percent(crm.pith, crm.react), unit: '%', label: 'sooner on screen than React', pith: crm.pith, rival: crm.react,
      note: `CRM start page on a slow phone: ${num(Math.round(crm.pith))} ms vs ${num(Math.round(crm.react))} ms` },
    { value: percent(mem.pith, Math.min(mem.react, mem.vue)), unit: '%', label: 'less memory at 10,000 rows', pith: mem.pith, rival: Math.min(mem.react, mem.vue),
      note: `${num(mem.pith)} MB vs ${num(mem.react)} MB (React) and ${num(mem.vue)} MB (Vue)` },
    { value: num(js.pith), unit: ' KB', label: 'of JavaScript for the CRM, no build', pith: js.pith, rival: Math.min(js.react, js.vue),
      note: `Vue ${num(js.vue)} KB, React ${num(js.react)} KB` },
    { value: `${close}/${ops.length}`, unit: '', label: 'list operations fastest or within 10%', pith: close, rival: ops.length, bars: false,
      note: 'Create, update, swap, select, remove, append and clear rows' },
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
            <span>Pith ${num(r.pith)} ms, ${NAMES[r.rival]} ${num(r.value)} ms: <strong>${r.pct}% slower</strong>${r.pct < 10 ? html`<span class="muted"> (within the noise)</span>` : null}</span>
          </li>`)}
        <li>
          <span class="behind-op">No build on a multi-page app</span>
          <span>On the CRM, Pith without a build is ready <strong>${gaps.unbundled[0]}–${gaps.unbundled[1]}% later</strong> than Pith + Vite:
            the browser finds each lazy page's imports a round trip late.</span>
        </li>
      </ul>
      <p class="note">Updating rows is behind because Pith rebuilds a row whose item is a new object, where React patches its text.
        Fine-grained rows close that gap (${num(gaps.update['pith-fine'])} ms, the fastest), at a price in memory:
        ${num(data.memory['10,000 rows']['pith-fine'])} MB at 10,000 rows instead of ${num(data.memory['10,000 rows'].pith)}.</p>
      <p class="note">Not measured at all: server rendering, the ecosystem, hiring and years of maintenance, where React and Vue are far ahead.</p>
    </section>

    <section class="section" aria-labelledby="method">
      <h2 id="method">How it was measured</h2>
      <ul class="check-list bench-method">
        <li>${check()}<span><strong>Same apps, same flows.</strong> A Todo app, a 6-route CRM and a benchmark table, each written in Pith,
          React 19 and Vue 3 the way their docs recommend, and each passing the same user flows.</span></li>
        <li>${check()}<span><strong>Load:</strong> Chrome with a fresh profile per run, Slow 4G (150 ms round trip, 1.6 Mbps) and 4× CPU
          slowdown, served gzipped over HTTP/1.1 and HTTP/2. Median of ${data.runs} runs.</span></li>
        <li>${check()}<span><strong>Runtime:</strong> 3 warm-up and 10 measured runs with garbage collection in between, in 3 fresh pages,
          over 4 rounds with the frameworks in a rotated order. Medians. Each result is checked.</span></li>
        <li>${check()}<span><strong>Memory:</strong> the JavaScript heap after a forced garbage collection.</span></li>
        <li>${check()}<span><strong>Pith</strong> runs as deployed without a build (its one-file production copy, no dev warnings);
          "Pith + Vite" bundles the app too, to show what skipping the build costs.</span></li>
      </ul>
      <h3>Caveats</h3>
      <ul class="list note">
        <li>Runtime numbers vary up to ±10% between sessions; smaller differences don't mean much.</li>
        <li>Headless Chrome on one machine: no real phones, no other browsers.</li>
        <li>The biggest app has 6 routes. 100+ routes and many developers are untested.</li>
        <li>React and Vue use hand-written data loading and forms, as Pith has those built in. Libraries would shorten their code
          and add dependencies.</li>
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
