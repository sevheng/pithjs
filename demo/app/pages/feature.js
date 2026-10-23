import { html } from 'pith';
import { examples, exampleByName } from '../examples/index.js';
import sources from '../examples/sources.js';

/** @param {{ name: string }} params */
export default function FeaturePage({ name }) {
  const example = exampleByName(name);
  if (!example) {
    return html`
      <section class="section narrow">
        <h1>No such feature</h1>
        <p class="lead">There's no example called <code>${name}</code>.</p>
        <a class="btn primary" href="/features">All features</a>
      </section>
    `;
  }
  const i = examples.indexOf(example);
  const [prev, next] = [examples[i - 1], examples[i + 1]];

  return html`
    <article class="section feature-page">
      <p><a href="/features">← All features</a></p>
      <h1>${example.title}</h1>
      <p class="lead">${example.summary}</p>
      <p class="tags">${example.api.map((a) => html`<code class="tag">${a}</code>`)}${example.app ? html`<span class="tag app">app code, not framework</span>` : null}</p>

      <section aria-labelledby="try-it">
        <h2 id="try-it">Try it</h2>
        <div class="card example">${example.view()}</div>
      </section>

      <section aria-labelledby="the-code">
        <h2 id="the-code">The code</h2>
        <p class="muted small">app/examples/${name}.js</p>
        <pre class="code" tabindex="0" aria-label=${`Source of app/examples/${name}.js`}><code>${sources[name]}</code></pre>
      </section>

      ${example.usedIn.length ? html`
        <section aria-labelledby="in-this-app">
          <h2 id="in-this-app">Used in this app</h2>
          <ul>${example.usedIn.map(([href, label]) => html`<li><a href=${href}>${label}</a></li>`)}</ul>
        </section>` : null}

      <nav class="pager" aria-label="More features">
        ${prev ? html`<a class="btn" href=${`/features/${prev.name}`}>← ${prev.title}</a>` : html`<span></span>`}
        ${next ? html`<a class="btn" href=${`/features/${next.name}`}>${next.title} →</a>` : null}
      </nav>
    </article>
  `;
}
