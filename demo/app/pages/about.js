import { html, signal } from 'mini';
import '../components/info-card.js';
import '../components/risky-widget.js';

function measure() {
  const resources = /** @type {PerformanceResourceTiming[]} */ (performance.getEntriesByType('resource'));
  const scripts = resources.filter((r) => new URL(r.name).pathname.endsWith('.js'));
  const bytes = scripts.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
  const nav = /** @type {PerformanceNavigationTiming | undefined} */ (performance.getEntriesByType('navigation')[0]);
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  return {
    files: scripts.length,
    kb: (bytes / 1024).toFixed(1),
    fcp: fcp ? Math.round(fcp.startTime) : null,
    load: nav && nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
  };
}

export default function AboutPage() {
  const stats = signal(null);
  if (document.readyState === 'complete') stats.value = measure();
  // loadEventEnd is only filled in after load handlers finish, so measure one tick later.
  else addEventListener('load', () => setTimeout(() => (stats.value = measure())), { once: true });

  const stat = (label, value) => html`
    <div class="card stat">
      <span class="stat-value">${value}</span>
      <span class="stat-label">${label}</span>
    </div>
  `;

  return html`
    <section class="section narrow">
      <h1>How fast is it?</h1>
      <p class="lead">Live numbers from this page load, measured by your browser.</p>
      ${() => {
        const s = stats.value;
        if (!s) return html`<p class="muted">Measuring…</p>`;
        return html`
          <div class="grid stats">
            ${stat('JavaScript (KB, uncompressed)', s.kb)}
            ${stat('JS files', s.files)}
            ${stat('First paint (ms)', s.fcp ?? '–')}
            ${stat('Fully loaded (ms)', s.load ?? '–')}
          </div>
        `;
      }}
      <h2>Why it's fast</h2>
      <ul class="list">
        <li>No framework runtime to download, parse and run before showing anything.</li>
        <li>No virtual DOM: each signal is wired straight to the DOM node that shows it.</li>
        <li>Templates are parsed once by the browser's own HTML parser, then cloned.</li>
        <li>No build step, so what you write is what the browser runs.</li>
      </ul>
      <info-card>
        <span slot="title">Errors stay contained</span>
        <p class="muted">If a component throws, only that component shows a fallback. The rest of the page keeps working.</p>
        <risky-widget></risky-widget>
      </info-card>
      <p><a href="/__mini/" data-reload>Run the framework tests →</a></p>
    </section>
  `;
}
