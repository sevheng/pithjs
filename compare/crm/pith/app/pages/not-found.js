import { html } from 'pith';

export default function NotFoundPage() {
  return html`
    <section class="section narrow">
      <h1>Page not found</h1>
      <a class="btn primary" href="/">Go to dashboard</a>
    </section>
  `;
}
