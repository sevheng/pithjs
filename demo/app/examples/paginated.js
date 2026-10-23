import { html, paginated, repeat, fetchJSON } from 'pith';

// paginated() loads a list a page at a time. The fetcher gets the page number and returns
// { items, next }; "Load more" appends the next page, and hasMore turns false on the last one.
export default function PaginatedExample() {
  const team = paginated(({ page, signal }) => fetchJSON(`/api/team?page=${page}`, { signal }));

  return html`
    ${team.render((people) => html`
      <ol class="example-list">
        ${repeat(people, (p) => p.id, (p) => html`<li class="example-item">${p.name}</li>`)}
      </ol>`)}
    <div class="load-more">
      ${() => (team.hasMore.value
        ? html`<button class="btn" type="button" ?disabled=${team.loadingMore} @click=${team.loadMore}>
            ${() => (team.loadingMore.value ? 'Loading…' : 'Load more')}</button>`
        : html`<p class="muted">That's everyone.</p>`)}
    </div>
  `;
}
