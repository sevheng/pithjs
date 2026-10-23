import { html } from 'pith';
import { examples } from '../examples/index.js';

export default function FeaturesPage() {
  return html`
    <section class="section">
      <h1>Features</h1>
      <p class="lead">Every part of Pith, each with a live example and its code.</p>
      <ul class="feature-grid">
        ${examples.map((e) => html`
          <li class="card feature-card">
            <h2><a href=${`/features/${e.name}`}>${e.title}</a></h2>
            <p>${e.summary}</p>
            <p class="tags">${e.api.map((a) => html`<code class="tag">${a}</code>`)}${e.app ? html`<span class="tag app">app code</span>` : null}</p>
          </li>
        `)}
      </ul>
    </section>
  `;
}
