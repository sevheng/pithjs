import { html, resource, fetchJSON } from 'pith';
import { router } from '../router.js';
import { icon } from '../icons.js';
import { FOLDERS, countsVersion, compose } from '../inbox/state.js';

// The mail frame for /inbox/:folder: the folders (with counts) and a Compose button, beside the folder page
// (the list and the preview). As a layout it stays mounted while you switch folders, so the counts don't
// flash. The folder list is fixed; only the counts load, so a count changing never rebuilds the links.
export default function InboxLayout(page) {
  const counts = resource(({ signal }) => (countsVersion.value, fetchJSON('/api/inbox', { signal })));
  const current = () => router.path.value.split('/')[2] ?? 'inbox';
  const viewing = () => (router.query.value.m ? 'message' : 'list');

  /** @param {{ id: string, name: string }} f */
  const count = (f) => {
    const n = counts.data.value?.[f.id];
    if (!n) return null;
    return f.id === 'inbox'
      ? html`<span class="badge" aria-label=${`${n} unread`}>${n}</span>`
      : html`<span class="folder-count" aria-label=${`${n} messages`}>${n}</span>`;
  };

  return html`
    <div class="inbox" data-view=${viewing}>
      <aside class="inbox-side" aria-label="Mail">
        <button class="btn primary compose-btn" type="button" @click=${() => compose()}>${icon('pencil')}<span class="compose-text">Compose</span></button>
        <nav aria-label="Folders">
          <ul class="folder-list">
            ${FOLDERS.map((f) => html`
              <li>
                <a class="folder-link" href=${`/inbox/${f.id}`} aria-current=${() => (current() === f.id ? 'page' : null)}>
                  ${icon(f.icon)}<span class="folder-name">${f.name}</span>${() => count(f)}
                </a>
              </li>`)}
          </ul>
        </nav>
        ${() => (counts.error.value ? html`<p class="note folder-error" role="alert">Couldn't load the counts.
          <button class="btn ghost" type="button" @click=${counts.refetch}>Try again</button></p>` : null)}
      </aside>
      ${page}
    </div>
  `;
}
