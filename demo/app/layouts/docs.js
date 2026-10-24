import { html } from 'pith';
import { router } from '../router.js';
import { sections, docByName, docHref } from '../docs/index.js';

// Shared by every /docs page: the sidebar stays mounted while you read; only `page` changes.
// On a phone the sidebar folds into a "Docs menu" at the top that names the page you're on.
export default function DocsLayout(page) {
  const current = () => router.path.value.replace(/^\/docs\/?/, '') || 'introduction';
  // Pointing at (or tabbing to) a link downloads that page's body, so it's usually there before the click.
  const early = (doc) => doc.load().catch(() => {}); // a failed download is tried again when the page opens
  const nav = (label) => html`
    <nav aria-label=${label}>
      ${sections.map((s) => html`
        <h2 class="docs-group">${s.title}</h2>
        <ul class="docs-links">
          ${s.pages.map((p) => html`<li><a class="docs-link" href=${docHref(p.name)}
            @pointerenter=${() => early(p)} @focus=${() => early(p)}
            aria-current=${() => (current() === p.name ? 'page' : null)}>${p.title}</a></li>`)}
        </ul>`)}
    </nav>`;

  return html`
    <div class="docs">
      <aside class="docs-side scroll-quiet">${nav('Docs')}</aside>
      <details class="docs-menu" @click=${(e) => { if (e.target.closest('a')) e.currentTarget.open = false; }}>
        <summary>Docs menu <span class="muted">· ${() => docByName(current())?.title ?? ''}</span></summary>
        ${nav('Docs (menu)')}
      </details>
      <div class="docs-main">
        ${page}
        <footer class="docs-foot">Built with Pith · no runtime dependencies · no build step</footer>
      </div>
    </div>`;
}
