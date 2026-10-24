import { html, resource } from 'pith';
import { docs, docByName, docHref } from '../docs/index.js';
import { exampleByName } from '../examples/index.js';
import sources from '../examples/sources.js';
import { apps } from '../apps.js';
import { icon } from '../icons.js';

/** /docs and /docs/:page, inside the docs layout. The page's body downloads when it's opened. */
/** @param {{ page?: string }} params */
export default function DocPage({ page = 'introduction' }) {
  const doc = docByName(page);
  if (!doc) {
    return html`
      <article class="doc">
        <h1>No such page</h1>
        <p class="lead">There's no docs page called <code>${page}</code>.</p>
        <a class="btn primary" href="/docs">Docs home</a>
      </article>`;
  }
  const body = resource(() => doc.load());
  const view = body.render({
    loading: () => html`<div class="doc-skeleton" aria-busy="true"><span></span><span></span><span></span><p class="sr-only">Loading…</p></div>`,
    error: (err, retry) => html`<div class="load-error" role="alert"><p>This page didn't load. ${err.message}</p>
      <button class="btn" type="button" @click=${retry}>Try again</button></div>`,
    ready: (mod) => mod.default(),
  });
  if (doc.own) return html`${view}`;

  const i = docs.indexOf(doc);
  const [prev, next] = [docs[i - 1], docs[i + 1]];
  const example = doc.example ? exampleByName(doc.example) : null;
  const app = doc.app ? apps.find((a) => a.name === doc.app) : null;

  return html`
    <article class="doc">
      <header class="doc-head">
        <h1>${doc.title}</h1>
        <p class="lead">${doc.summary}</p>
        ${example ? html`<p class="tags">${example.api.map((a) => html`<code class="tag">${a}</code>`)}${example.app ? html`<span class="tag app">app code, not framework</span>` : null}</p>` : null}
        ${app ? html`<p class="row"><a class="btn primary" href=${app.href}>${icon(app.icon)} Open ${app.name}</a></p>` : null}
      </header>

      ${example ? html`
        <section aria-labelledby="try-it">
          <h2 id="try-it">Try it</h2>
          <div class="card example">${example.view()}</div>
        </section>` : null}

      <div class="doc-body">${view}</div>

      ${example ? html`
        <section aria-labelledby="the-code">
          <h2 id="the-code">The code</h2>
          <figure class="doc-code">
            <figcaption>app/examples/${example.name}.js</figcaption>
            <pre class="code" tabindex="0" aria-label=${`Source of app/examples/${example.name}.js`}><code>${sources[example.name]}</code></pre>
          </figure>
        </section>` : null}

      <nav class="pager" aria-label="Previous and next page">
        ${prev ? html`<a class="pager-link" href=${docHref(prev.name)} aria-label=${`Previous: ${prev.title}`}><span class="muted small">Previous</span>${prev.title}</a>` : html`<span></span>`}
        ${next ? html`<a class="pager-link next" href=${docHref(next.name)} aria-label=${`Next: ${next.title}`}><span class="muted small">Next</span>${next.title}</a>` : null}
      </nav>
    </article>
  `;
}
