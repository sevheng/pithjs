import { html } from 'pith';

export default function NotFoundPage() {
  return html`
    <section class="section narrow">
      <h1>Page not found</h1>
      <p class="lead">Nothing lives at <code>${location.pathname}</code>.</p>
      <a class="btn primary" href="/">Go home</a>
    </section>
  `;
}
