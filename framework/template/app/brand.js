import { html } from 'pith';

// Your site's mark: a placeholder shape. Swap in your own logo (inline SVG keeps it one request-free).
// Decorative (aria-hidden): the text next to it names the site.
export const brandMark = (className = 'brand-mark') => html`
  <svg class=${className} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor"/>
    <circle cx="12" cy="12" r="4" fill="var(--surface)"/>
  </svg>
`;

// The look of the status pages: the 404 page (app/pages/not-found.js) and the router's error view (app/router.js).
export const statusPage = ({ code, title, text, detail = null, actions }) => html`
  <section class="section narrow status-page" role=${code === '404' ? null : 'alert'}>
    ${brandMark('status-mark')}
    <p class="status-code">${code}</p>
    <h1>${title}</h1>
    <p class="lead">${text}</p>
    ${detail ? html`<p class="muted note">${detail}</p>` : null}
    <div class="row">${actions}</div>
  </section>
`;
