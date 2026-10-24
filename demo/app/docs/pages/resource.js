import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

export default () => html`
  <section aria-labelledby="load">
    <h2 id="load">Load something</h2>
    <p>
      ${c('resource(fetcher)')} runs your fetcher, keeps track of whether it's loading, failed or done, and shows
      the right view for each. The fetcher gets ${c('{ signal }')}, an ${c('AbortSignal')}: pass it on to
      ${c('fetchJSON')} (or ${c('fetch')}) so a request Pith no longer needs is cancelled.
    </p>
    ${code(`import { html, resource, fetchJSON } from 'pith';

export default function TeamPage() {
  const team = resource(({ signal }) => fetchJSON('/api/team', { signal }));

  return html\`
    <h1>Team</h1>
    \${team.render((people) => html\`<ul>\${people.map((p) => html\`<li>\${p.name}</li>\`)}</ul>\`)}
  \`;
}`, { file: 'app/pages/team.js' })}
    <p>
      Why not your own ${c('fetch')} with a ${c('loading')} signal: the hard parts are the ones people skip,
      like cancelling a stale request, ignoring a reply that arrives late, and keeping old data on screen while
      reloading. ${c('resource()')} does all of them.
    </p>
  </section>

  <section aria-labelledby="views">
    <h2 id="views">A view for each state</h2>
    <p>
      ${c('render(ready)')} shows a "Loading…" line until the first data arrives, an error with a "Try again"
      button if it fails, and ${c('ready(data)')} once it's in. Pass an object to write the other two views
      yourself. Do that on any view a person waits on, with words for the context.
    </p>
    ${code(`team.render({
  loading: () => html\`<p class="loading">Loading the team…</p>\`,
  error: (err, retry) => html\`<div class="load-error" role="alert">
    <p>Couldn't load the team. \${err.message}</p>
    <button class="btn" type="button" @click=\${retry}>Try again</button>
  </div>\`,
  ready: (people) => (people.length
    ? html\`<ul>\${people.map((p) => html\`<li>\${p.name}</li>\`)}</ul>\`
    : html\`<p class="empty">No one here yet.</p>\`),
})`)}
    <p>
      The empty case belongs in ${c('ready')}: an empty list is a successful load. While a refetch runs, the
      previous data stays on screen; show ${c('team.loading')} as a small "Updating…" hint if it matters.
    </p>
  </section>

  <section aria-labelledby="tracking">
    <h2 id="tracking">Re-run when a signal changes</h2>
    <p>
      Signals the fetcher reads <em>before its first ${c('await')}</em> are tracked. When one changes, the
      request in flight is aborted and the fetcher runs again. A reply from an older request that arrives late
      is ignored, so a slow answer can never overwrite a newer one. That's what makes a search box safe:
    </p>
    ${code(`import { router } from '../router.js';

// The search lives in the URL (?q=), so a reload or a shared link keeps it.
const results = resource(({ signal }) =>
  fetchJSON(\`/api/team?q=\${encodeURIComponent(router.query.value.q ?? '')}\`, { signal }));

html\`<input class="input" type="search" aria-label="Search people"
  .value=\${() => router.query.value.q ?? ''}
  @input=\${(e) => router.setQuery({ q: e.target.value })}>\``)}
    ${note(html`A signal read after an ${c('await')} isn't tracked, so changing it does nothing. Read every
      input at the top: ${c('const q = query.value; const user = await …')}.`, 'warn')}
    <p>
      When the component or page that made the resource is removed, its request is aborted too.
    </p>
  </section>

  <section aria-labelledby="state">
    <h2 id="state">Reading the state yourself</h2>
    <p>
      ${c('render()')} covers most views, but each piece is also a signal you can use in a hole:
      ${c('data')} (undefined until the first load), ${c('error')} (null or the error), ${c('loading')}
      (true during any request, refetches included) and ${c('status')}: ${c("'loading'")} until there's data,
      ${c("'error'")}, or ${c("'ready'")}.
    </p>
    ${code(`html\`<h2>Team \${() => (team.status.value === 'ready' ? \`(\${team.data.value.length})\` : '')}</h2>
  <span class="muted" aria-live="polite">\${() => (team.loading.value ? 'Updating…' : '')}</span>
  <button class="btn" type="button" @click=\${team.refetch}>Reload</button>\``)}
  </section>

  <section aria-labelledby="changing">
    <h2 id="changing">Changing the data</h2>
    <h3>refetch and mutate</h3>
    <p>
      ${c('refetch()')} runs the fetcher again. ${c('mutate(value)')} replaces the data locally without a
      request, for example with what the server sent back after a save. ${c('mutate(fn)')} changes it instead:
      ${c('fn')} gets the <em>confirmed</em> data and returns the next value.
    </p>
    ${code(`const saved = await fetchJSON('/api/team', { json: { name } });
team.mutate((people) => [...people, saved]);`)}
    <p>
      Prefer the function form. If an optimistic save (below) is still on its way, ${c('team.data.value')}
      already includes it; a value built from it would apply that save a second time. ${c('mutate(fn)')} works
      on the data without pending updates, and they stay applied on top, once.
    </p>

    <h3 id="optimistic">Optimistic updates</h3>
    <p>
      ${c('optimistic(update, save)')} shows a change at once, then waits for the server.
      ${c('update(data)')} returns the new data; ${c('save()')} does the request.
    </p>
    ${code(`const toggle = (id) => todos.optimistic(
  (list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  () => fetchJSON(\`/api/todos/\${id}\`, { method: 'PATCH', json: { toggle: true } }),
);`)}
    <ul>
      <li>If ${c('save()')} resolves to a value, that value becomes the data. If it resolves to nothing, the
        update is kept.</li>
      <li>If it rejects, the update is rolled back and the error is <strong>rethrown</strong>, so the caller can
        show it. Inside a form's ${c('onSubmit')} it shows as ${c('submitError')}; elsewhere, catch it and tell the
        person (a toast with the reason).</li>
      <li>Several saves can be in flight at once. A failure rolls back only its own update; the others stay.</li>
    </ul>
    ${note(html`${c('update')} must be pure: it may run more than once, on newer data, while saves are pending.
      Don't create ids, call the server or change other signals inside it.`, 'warn')}
  </section>

  <section aria-labelledby="live">
    <h2 id="live">Views that change often: live()</h2>
    <p>
      ${c('render(ready)')} builds the whole ready view again every time the data changes. For most views that's
      fine. For one that changes all the time (a chat, a live feed, a list you ${c('mutate')} or
      ${c('optimistic')} a lot), rebuilding loses focus and scroll and costs time per row. ${c('live(ready)')}
      takes the same views, but builds ${c('ready')} once and passes the data as a <strong>signal</strong>. Put
      the list in ${c('repeat()')} over it, or over a ${c('computed')} of it, and an update patches just the
      rows that changed.
    </p>
    ${code(`const room = resource(({ signal }) => fetchJSON('/api/chat?room=general', { signal }));
const messages = computed(() => room.data.value?.messages ?? []);

html\`\${room.live(() => html\`
  <ol class="msg-list">
    \${repeat(messages, (m) => m.id, (m) => html\`<li>\${m.text}</li>\`)}
  </ol>\`)}\`;`)}
    <p>
      In the demo's Chat, the #firehose room took 100–230 ms per update with ${c('render')}, and 13–21 ms with
      ${c('live')}, with 200–900 messages on screen.
    </p>
    <h3>The function-hole trap</h3>
    <p>
      ${c('render()')} and ${c('live()')} return a function, which is a reactive hole on its own. A function
      returned from <em>another</em> function hole is not rendered (W003). Wrap it in ${c('html')}:
    </p>
    ${code(`\${() => (open.value ? res.live(view) : null)}             // ✗ shows nothing (W003)
\${() => (open.value ? html\`\${res.live(view)}\` : null)}  // ✓`)}
  </section>

  <section aria-labelledby="fetchjson">
    <h2 id="fetchjson">fetchJSON</h2>
    <p>
      ${c('fetchJSON(url, options)')} is ${c('fetch')} for JSON APIs. It takes the usual ${c('fetch')} options
      plus ${c('json')}: a value to send as the body. With ${c('json')} the method defaults to POST and the
      ${c('Content-Type')} header is set. It parses the reply (as JSON, or text if it isn't JSON) and returns it.
    </p>
    ${code(`await fetchJSON('/api/todos', { json: { text: 'Buy milk' } });                 // POST
await fetchJSON('/api/todos/3', { method: 'PATCH', json: { done: true } });
await fetchJSON('/api/todos/3', { method: 'DELETE' });

try {
  await fetchJSON('/api/signup', { json: values });
} catch (err) {
  // err is an HttpError for any non-2xx reply
  err.status;   // 422
  err.body;     // the server's JSON: { errors: { email: 'Already registered' } }
  err.message;  // err.body.message if the server sent one, else "Request failed: 422 …"
}`)}
    <p>
      A network failure or an aborted request throws the browser's own error, not an ${c('HttpError')}.
    </p>
  </section>

  <section aria-labelledby="prerendered">
    <h2 id="prerendered">Prerendered data</h2>
    <p>
      ${c('npm run build')} prerenders each page in a browser, and saves the JSON answers of the GETs the page
      made in a ${c('<script id="pith-data">')} tag. When the app starts, the first ${c('fetchJSON')} of each of
      those URLs gets its saved answer instead of a request, so the page doesn't flash "Loading…" over data that
      is already on screen. Each answer is used once, and what startup didn't use is dropped, so a refetch, a
      search or "Load more" always asks the server. Nothing to do in your code, as long as reads go through
      ${c('fetchJSON')}. The saved data is from build time: rebuild to refresh it.
    </p>
  </section>

  <section aria-labelledby="resource-api">
    <h2 id="resource-api">API</h2>
    ${api([
      ['resource(({ signal }) => …)', 'Run the fetcher now, and again when a signal it read before its first await changes (aborting the old request).'],
      ['res.render(views)', html`${c('views')}: ${c('ready')}, or ${c('{ ready, loading?, error? }')}. A hole that shows loading, error ${c('(err, retry)')} or ${c('ready(data)')}. Rebuilds ${c('ready')} on each data change.`],
      ['res.live(views)', html`Like render, but ${c('ready(dataSignal)')} is built once. Use ${c('repeat()')} inside.`],
      ['res.data', 'Signal: the latest data, undefined before the first load.'],
      ['res.error', 'Signal: the latest request\'s error, or null.'],
      ['res.loading', 'Signal: true while any request is in flight, refetches included.'],
      ['res.status', html`Signal: ${c("'loading'")}, ${c("'error'")} or ${c("'ready'")}.`],
      ['res.refetch()', 'Run the fetcher again. Old data stays on screen meanwhile.'],
      ['res.mutate(value | fn)', 'Replace the data locally, or change the confirmed data with fn (pending optimistic updates stay on top).'],
      ['res.optimistic(update, save)', 'Apply update now; await save. Its value (if any) becomes the data; on failure, roll back and rethrow.'],
      ['fetchJSON(url, options?)', 'fetch for JSON: sends options.json as the body (POST by default), parses the reply, throws HttpError on non-2xx.'],
      ['HttpError', html`${c('err.status')}, ${c('err.body')} (the parsed reply), ${c('err.message')}.`],
    ])}
  </section>
`;
