import { html, signal } from 'pith';

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

export default function BenchmarksPage() {
  const now = signal(null);
  if (document.readyState === 'complete') now.value = measure();
  else addEventListener('load', () => setTimeout(() => (now.value = measure())), { once: true });

  const stat = (value, label) => html`<li class="card stat"><span class="value">${value}</span><span class="stat-label">${label}</span></li>`;
  return html`
    <section class="hero tinted">
      <span class="badge soft">Measured, not claimed</span>
      <h1>Benchmarks</h1>
      <p class="lead">The same apps in Pith, React and Vue, loaded and clicked the same way.</p>
    </section>

    <section class="section" aria-labelledby="now">
      <h2 id="now">This page, right now</h2>
      <p class="muted">What your browser downloaded and when it first painted, for this visit.</p>
      ${() => (now.value
        ? html`<ul class="number-strip">
            ${stat(now.value.kb, 'KB of JavaScript, as sent')}
            ${stat(now.value.files, 'JavaScript files')}
            ${stat(now.value.fcp == null ? '–' : `${now.value.fcp} ms`, 'until first paint')}
          </ul>`
        : html`<p class="loading">Measuring…</p>`)}
    </section>
  `;
}
