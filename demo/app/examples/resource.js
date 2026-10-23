import { html, signal, resource, fetchJSON } from 'pith';

// resource() loads data and tracks loading and errors. It re-runs when a signal it read changes (`q`),
// and cancels the old request first, so a slow answer can never overwrite a newer one.
export default function ResourceExample() {
  const q = signal('');
  const people = resource(({ signal }) => fetchJSON(`/api/team?q=${encodeURIComponent(q.value)}`, { signal }));

  return html`
    <div class="search-row">
      <label class="sr-only" for="resource-q">Search people</label>
      <input id="resource-q" class="input" type="search" placeholder="Search people" .value=${q}
             @input=${(e) => (q.value = e.target.value)}>
      <span class="muted small" aria-live="polite">${() => (people.loading.value ? 'Loading…' : '')}</span>
      <button class="btn" type="button" @click=${people.refetch}>Reload</button>
    </div>
    ${people.render((page) => (page.items.length
      ? html`<ul class="example-list">${page.items.map((p) => html`<li class="example-item">${p.name} <span class="muted">${p.role}</span></li>`)}</ul>`
      : html`<p class="empty">No one matches.</p>`))}
  `;
}
