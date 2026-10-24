import { html } from 'pith';
import { code, note, c } from '../ui.js';

export default () => html`
  <p>A mail app in three panes: folders with counts, a list of messages you can search, and a reading pane.
    You can star, archive and delete messages, one at a time or many at once, and each move has an Undo.
    Compose checks the fields in the browser, and the server rejects some addresses on its own.</p>

  <h2 id="try">What to try</h2>
  <ul>
    <li>Open a message in <a href="/inbox/inbox">Inbox</a>. It shows in the reading pane, its id goes into ${c('?m=')}, and
      it's marked read: the unread count goes down. Back closes it again.</li>
    <li>Scroll to the end of the list and click "Load more". The second page is added, then the list says that's all.</li>
    <li>Search for "invoice". The search is kept in ${c('?q=')}, so a reload keeps it. Search for something that isn't
      there to see "No messages match", with Clear search.</li>
    <li>Search for ${c('/fail')}. The server answers 500, and the list shows an error with Try again.</li>
    <li>Star a message, then look in <a href="/inbox/starred">Starred</a>.</li>
    <li>Tick a few messages and click Archive. A toast says how many moved, with Undo.</li>
    <li>Delete a message: it asks first, moves it to <a href="/inbox/trash">Trash</a>, and offers Undo. In Trash,
      delete asks again and deletes it forever.</li>
    <li>Click Compose and send with empty fields: each one says what's missing. Then send to
      ${c('someone@blocked.test')}: the server answers 422, and its message shows under To.</li>
    <li>Reply to a message, then find what you sent in <a href="/inbox/sent">Sent</a>.</li>
    <li>Open <a href="/inbox/spam">/inbox/spam</a>, a folder that doesn't exist.</li>
  </ul>

  <h2 id="built">How it's built</h2>
  <ul>
    <li>${c('app/layouts/inbox.js')}: the folders and their counts, and the Compose button. As a layout it stays mounted
      while you switch folders. The folder links are fixed; only the counts load, so a new count never rebuilds a link.</li>
    <li>${c('app/pages/inbox.js')}: one folder (${c('/inbox/:folder')}): the search box, the toolbar for checked
      messages, the list a page at a time, and the reading pane for the message in ${c('?m=')}.</li>
    <li>${c('app/inbox/state.js')}: what the layout and the page share. The folder list, two version signals
      (bumping ${c('countsVersion')} makes the layout fetch the counts again; ${c('sentVersion')} reloads Sent), date
      formats, and the Compose dialog.</li>
    <li>${c('api/inbox.mjs')}: the dev API. Counts, a folder's messages 20 at a time, one message (which marks it read),
      and the actions: star, move, undo, destroy and send.</li>
    <li>${c('prerender.mjs')}: every folder URL, so the build writes each one as HTML.</li>
  </ul>

  <h2 id="pith">The Pith parts it uses</h2>
  <ul>
    <li><a href="/docs/router">Routing</a>: ${c('/inbox/:folder')} with a layout, a redirect from ${c('/inbox')}, and the
      search and open message kept in the ${c('?query')}.</li>
    <li><a href="/docs/paginated">Pages of data</a>: ${c('paginated()')} for the list, with "Load more".</li>
    <li><a href="/docs/resource">Loading data</a>: ${c('resource()')} for the counts and the open message.</li>
    <li><a href="/docs/lists">Lists</a>: ${c('repeat()')} keyed by id, so a starred or archived message changes one row.</li>
    <li><a href="/docs/selector">Selecting a row</a>: ${c('selector()')} marks the open message.</li>
    <li><a href="/docs/forms">Forms</a>: Compose is a ${c('form()')}, with rules here and the server's 422 errors under their fields.</li>
    <li><a href="/docs/dialogs">Dialogs and toasts</a>: Compose in a ${c('dialog()')}, ${c('confirm()')} before deleting, and
      toasts with an Undo button.</li>
  </ul>

  <h2 id="code">The interesting parts</h2>
  <h3 id="code-counts">Counts that follow every change</h3>
  <p>The layout's request reads ${c('countsVersion')}. Anything that changes a count (reading, starring, moving,
    sending) bumps it, and the counts load again. The layout doesn't need to know what happened.</p>
  ${code(`
export default function InboxLayout(page) {
  const counts = resource(({ signal }) => (countsVersion.value, fetchJSON('/api/inbox', { signal })));
  const current = () => router.path.value.split('/')[2] ?? 'inbox';
  const viewing = () => (router.query.value.m ? 'message' : 'list');
  // …`, { file: 'app/layouts/inbox.js' })}

  <h3 id="code-compose">Compose: rules here, and the server's say</h3>
  <p>The form checks what it can in the browser. The server checks again, and answers 422 with an error for each
    field. ${c('form()')} shows those under the fields they belong to.</p>
  ${code(`
const f = form({
  initial: { to: start.to ?? '', subject: start.subject ?? '', body: start.body ?? '' },
  validate: {
    to: [rules.required('Add at least one address'), emails],
    subject: [rules.required('Add a subject'), rules.maxLength(200)],
    body: rules.required('Write a message'),
  },
  // A 422 { errors } (e.g. an address at @blocked.test) shows under its field.
  onSubmit: async (values) => close(await fetchJSON('/api/inbox', { json: { action: 'send', ...values } })),
});`, { file: 'app/inbox/state.js' })}
  ${code(`
if (!to.length) errors.to = 'Add at least one address';
else if (to.some((a) => !isEmail(a))) errors.to = \`"\${to.find((a) => !isEmail(a))}" isn't an email address\`;
else if (to.some((a) => a.toLowerCase().endsWith('@blocked.test'))) errors.to = "blocked.test doesn't accept mail. Remove that address.";
if (!subject) errors.subject = 'Add a subject';
else if (subject.length > 200) errors.subject = 'Keep the subject under 200 characters';
if (!text) errors.body = 'Write a message';
if (Object.keys(errors).length) return Response.json({ message: 'Check the highlighted fields', errors }, { status: 422 });`, { file: 'api/inbox.mjs' })}

  <h3 id="code-undo">Undo on the server</h3>
  <p>A move remembers where each message came from, so Undo is one request that puts them back.</p>
  ${code(`
if (action === 'move') {
  if (!['inbox', 'archive', 'trash'].includes(body.to)) return Response.json({ message: \`Can't move messages to "\${body.to}"\` }, { status: 422 });
  for (const m of find(ids)) if (m.folder !== body.to) Object.assign(m, { prev: m.folder, folder: body.to });
  return { ok: true };
}
if (action === 'undo') {
  for (const m of find(ids)) if (m.prev) Object.assign(m, { folder: m.prev, prev: null });
  return { ok: true };
}`, { file: 'api/inbox.mjs' })}
  ${note(html`The API keeps its messages in memory, so what you change stays changed until the dev server restarts.`)}

  <h2 id="tests">Its tests</h2>
  <p>In ${c('tests/flows.js')}:</p>
  <ul>
    <li>inbox: /inbox opens the Inbox with folders, counts and nothing selected</li>
    <li>inbox: opening a message shows it, keeps ?m= in the URL, and marks it read</li>
    <li>inbox: Load more adds the next page, then says that is all</li>
    <li>inbox: search is kept in ?q=, and no results says so</li>
    <li>inbox: a list that fails to load says so, with Try again</li>
    <li>inbox: starring a message, then unstarring it</li>
    <li>inbox: compose checks fields here, and the server rejects @blocked.test (422)</li>
    <li>inbox: a sent message shows in Sent</li>
    <li>inbox: delete asks first, then Undo brings the message back</li>
    <li>inbox: bulk archive moves the checked messages to Archive</li>
    <li>inbox: an unknown folder says so</li>
  </ul>
`;
