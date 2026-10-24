import { html } from 'pith';
import { apps } from '../apps.js';
import { icon } from '../icons.js';

export default function ExamplesPage() {
  return html`
    <section class="hero tinted">
      <span class="badge soft">Built with Pith, no build step</span>
      <h1>Examples</h1>
      <p class="lead">Real apps, not snippets: every state handled, on phones and in dark mode.</p>
    </section>

    <section class="section" aria-label="Example apps">
      <ul class="app-grid">
        ${apps.map((a) => html`
          <li class="card lift app-card">
            <span class="icon-tile">${icon(a.icon)}</span>
            <h2>${a.name}</h2>
            <p class="muted">${a.text}</p>
            <ul class="check-list">${a.shows.map((s) => html`<li>${icon('check')}<span>${s}</span></li>`)}</ul>
            <a class="btn primary" href=${a.href}>Open ${a.name}</a>
          </li>`)}
      </ul>
    </section>
  `;
}
