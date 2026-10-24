import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

export default () => html`
  <section aria-labelledby="pages">
    <h2 id="pages">Load a list page by page</h2>
    <p>
      Long lists shouldn't come down in one request. ${c('paginated(fetcher, options)')} loads the first page,
      and ${c('loadMore()')} fetches the next one and appends it. It's built on ${c('resource()')}, so it has the
      same loading and error views, cancels stale requests and ignores late replies.
    </p>
    <p>
      The fetcher gets ${c('{ page, next, signal }')}: ${c('page')} counts from 1, ${c('next')} is the cursor the
      previous page returned (undefined for page 1), and ${c('signal')} is the ${c('AbortSignal')} to pass to
      ${c('fetchJSON')}.
    </p>
    ${code(`import { html, paginated, repeat, fetchJSON } from 'pith';

const team = paginated(({ page, signal }) => fetchJSON(\`/api/team?page=\${page}\`, { signal }));

html\`\${team.render((people) => html\`
  <ol>\${repeat(people, (p) => p.id, (p) => html\`<li>\${p.name}</li>\`)}</ol>\`)}\`;`)}
  </section>

  <section aria-labelledby="shape">
    <h2 id="shape">What the fetcher returns</h2>
    <p>Either of two shapes, depending on your API:</p>
    <h3>An array</h3>
    <p>
      Return the page's items. With ${c('{ pageSize }')}, a page shorter than that is the last one. Without it,
      only an empty page ends the list, which costs one extra request at the end, so pass it when you know it.
    </p>
    ${code(`paginated(({ page, signal }) => fetchJSON(\`/api/posts?page=\${page}&limit=20\`, { signal }), { pageSize: 20 });`)}
    <h3>Items and a cursor</h3>
    <p>
      Return ${c('{ items, next }')}. ${c('next')} is anything your API needs to find the following page (a page
      number, an id, an opaque token), and it comes back to the fetcher as ${c('next')}. ${c('null')} or
      ${c('undefined')} means there are no more pages.
    </p>
    ${code(`paginated(({ next, signal }) =>
  fetchJSON(\`/api/feed\${next ? \`?after=\${next}\` : ''}\`, { signal })); // → { items: [...], next: 'c9' | null }`)}
    ${note(html`Returning the whole reply when the list is nested (${c('{ data: [...] }')}) shows an empty list and
      warns ${c('W040')}. Pick the array out: ${c('async ({ page, signal }) => (await fetchJSON(url, { signal })).data')}.`, 'warn')}
  </section>

  <section aria-labelledby="load-more">
    <h2 id="load-more">A "Load more" button</h2>
    <p>
      ${c('hasMore')} is false once the last page is in, ${c('loadingMore')} is true while the next page is on its
      way, and ${c('error')} holds a failed page. A failed ${c('loadMore()')} keeps the items already loaded; call
      ${c('loadMore()')} again to retry. So the button needs four states: more to load, loading, failed, and the
      end of the list.
    </p>
    ${code(`html\`\${team.live({
  loading: () => html\`<p class="loading">Loading the team…</p>\`,
  ready: (people) => html\`
    <ol>\${repeat(people, (p) => p.id, (p) => html\`<li>\${p.name}</li>\`)}</ol>
    <div class="load-more">
      \${() => (team.moreError.value
        ? html\`<p role="alert">Couldn't load more. \${team.moreError.value.message}</p>\`
        : null)}
      \${() => (team.hasMore.value
        ? html\`<button class="btn" type="button" ?disabled=\${team.loadingMore} @click=\${team.loadMore}>
            \${() => (team.loadingMore.value ? 'Loading…' : team.moreError.value ? 'Try again' : 'Load more')}
          </button>\`
        : html\`<p class="muted">That's everyone.</p>\`)}
    </div>\`,
})}\`;`)}
    <p>
      Why the button sits inside ${c('ready')}: if page 1 fails, the error view replaces the whole list, button
      included. ${c('team.moreError')} holds only a failed "Load more", so it's shown next to the button that
      retries it.
    </p>
    ${note(html`${c('loadMore()')} does nothing while a page is loading or when there are no more, so it's safe to
      call from an ${c('IntersectionObserver')} for infinite scroll. Keep a real button too, for keyboards and
      for when the observer doesn't fire.`)}
  </section>

  <section aria-labelledby="render-live">
    <h2 id="render-live">render or live</h2>
    <p>
      ${c('render(ready)')} gets the items as an array and builds ${c('ready')} again each time a page is added.
      ${c('live(ready)')} builds it once and passes the ${c('items')} signal, which ${c('loadMore()')} appends to;
      with ${c('repeat()')} over it, a new page adds only its own rows, and focus and scroll stay put. Use
      ${c('live')} for anything longer than a few pages. Both take ${c('{ ready, loading, error }')} like
      ${c('resource().render')}.
    </p>
    ${note(html`Both return a function. Inside another function hole, wrap them: ${c('${() => (open.value ? html`${team.live(view)}` : null)}')}.`, 'warn')}
  </section>

  <section aria-labelledby="filters">
    <h2 id="filters">Search, filters and refetch</h2>
    <p>
      Signals the fetcher reads before its first ${c('await')} are tracked, as in ${c('resource()')}. When one
      changes, everything in flight is aborted (a "Load more" too) and the list starts again from page 1.
      ${c('refetch()')} does the same by hand.
    </p>
    ${code(`import { router } from '../router.js';

const people = paginated(({ page, signal }) => {
  const q = router.query.value.q ?? '';   // tracked: a new search reloads from page 1
  return fetchJSON(\`/api/team?q=\${encodeURIComponent(q)}&page=\${page}\`, { signal });
});`)}
    <p>
      Inside ${c('loadMore()')} the fetcher runs untracked, so reading the same signals for the next page is fine.
    </p>
  </section>

  <section aria-labelledby="changing-items">
    <h2 id="changing-items">Changing loaded items</h2>
    <p>${c('list.mutate((items) => next)')} changes the loaded items in place: star a message, mark it read,
      take it out. Pages loaded later are added after the changed items, even if one is loading while you
      change them. Before page 1 has loaded, ${c('mutate')} does nothing.</p>
    ${code(`const star = (id) => inbox.mutate((items) => items.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m)));`)}
    <p>${c('list.status')} is page 1's state (${c("'loading' | 'error' | 'ready'")}): a failed "Load more" leaves it
      ${c("'ready'")}. Show that error next to the button with ${c('list.moreError')}, which holds only it.</p>
  </section>

  <section aria-labelledby="paginated-api">
    <h2 id="paginated-api">API</h2>
    ${api([
      ['paginated(fetcher, { pageSize? })', html`Load page 1 now. ${c('fetcher({ page, next, signal })')} returns an array or ${c('{ items, next }')}.`],
      ['list.items', 'Signal: every item loaded so far.'],
      ['list.render(views)', html`Like ${c('resource().render')}, with the items array as ${c('ready')}'s argument.`],
      ['list.live(views)', html`Like ${c('resource().live')}: ${c('ready(items)')} is built once and gets the items signal.`],
      ['list.loadMore()', 'Fetch the next page and append it. Retries after an error; does nothing while loading or at the end.'],
      ['list.hasMore', 'Signal: false once the last page is loaded.'],
      ['list.loading', 'Signal: true while page 1 loads (first load, refetch, or a tracked signal changed).'],
      ['list.loadingMore', 'Signal: true while loadMore() is fetching.'],
      ['list.error', 'Signal: the page 1 error or the last loadMore() error, or null.'],
      ['list.moreError', 'Signal: only the last loadMore() error, or null. Show it beside "Load more".'],
      ['list.status', "Signal: page 1's 'loading' | 'error' | 'ready'."],
      ['list.mutate((items) => next)', 'Change the loaded items locally; later pages are appended to the result.'],
      ['list.refetch()', 'Start again from page 1.'],
    ])}
  </section>
`;
