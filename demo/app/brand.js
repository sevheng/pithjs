import { html } from 'pith';

// The Pith mark: a ring and its core. Decorative (aria-hidden): the text next to it names it.
export const brandMark = (className = 'brand-mark') => html`
  <svg class=${className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <circle cx="12" cy="12" r="4" fill="currentColor"/>
  </svg>
`;

// The look of the status pages (404, and the router's error view in router.js).
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
