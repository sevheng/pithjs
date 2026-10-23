import { html, signal, paginated, repeat, fetchJSON } from 'pith';
import { router } from '../router.js';

export default function TeamPage() {
  // The search lives in the URL (?q=), so a reload or a shared link keeps it.
  const query = signal(router.query.peek().q ?? '');
  const search = (e) => {
    query.value = e.target.value;
    router.setQuery({ q: query.value.trim() });
  };

  // Page 1 re-loads whenever `query` changes (the old request is cancelled); "Load more" appends the next page.
  const team = paginated(({ page, signal }) =>
    fetchJSON(`/api/team?q=${encodeURIComponent(query.value)}&page=${page}`, { signal }));

  return html`
    <section class="section narrow">
      <h1>Team</h1>
      <p class="muted">Loaded from <code>/api/team</code>, a few people at a time. Search runs on the server and is kept in the URL.</p>

      <div class="search-row">
        <label class="sr-only" for="team-search">Search the team</label>
        <input id="team-search" class="input" type="search" placeholder="Search by name or role" autocomplete="off"
               .value=${query} @input=${search}>
        <span class="muted small" aria-live="polite">${() => (team.loading.value ? 'Updating…' : '')}</span>
      </div>

      ${team.render((people) => people.length
        ? html`
          <ul class="people">
            ${repeat(people, (p) => p.id, (p) => html`
              <li class="card person">
                <a class="person-name" href=${`/team/${p.id}`}>${p.name}</a>
                <span class="muted">${p.role}</span>
              </li>
            `)}
          </ul>`
        : html`<p class="empty">No one matches "${query.peek()}".</p>`)}

      <div class="load-more">
        ${() => (team.hasMore.value
          ? html`<button class="btn" type="button" ?disabled=${team.loadingMore} @click=${team.loadMore}>
              ${() => (team.loadingMore.value ? 'Loading…' : 'Load more')}
            </button>`
          : null)}
        ${() => (team.error.value && team.items.value.length
          ? html`<p class="form-error" role="alert">Couldn't load more: ${team.error.value.message}</p>`
          : null)}
      </div>
    </section>
  `;
}
