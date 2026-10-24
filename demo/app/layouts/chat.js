import { html, resource, fetchJSON } from 'pith';
import { router } from '../router.js';
import { roomsVersion } from '../chat/state.js';
import { time } from '../chat/format.js';

// The chat frame for /chat and /chat/:room. As a layout it stays mounted while you switch rooms, so the
// rooms list doesn't reload or lose its scroll. On a phone it shows either the list (/chat) or the room.
export default function ChatLayout(page) {
  const rooms = resource(({ signal }) => (roomsVersion.value, fetchJSON('/api/chat', { signal })));
  const current = () => router.path.value.split('/')[2] ?? null;

  return html`
    <div class="chat" data-view=${() => (current() ? 'room' : 'list')}>
      <aside class="chat-rooms scroll-quiet" aria-labelledby="rooms-title">
        <h2 id="rooms-title" class="chat-rooms-title">Rooms</h2>
        ${rooms.render({
          loading: () => html`<p class="loading">Loading rooms…</p>`,
          error: (err, retry) => html`<div class="load-error" role="alert"><p>Couldn't load the rooms.</p>
            <button class="btn" type="button" @click=${retry}>Try again</button></div>`,
          ready: (list) => html`
            <ul class="room-list">
              ${list.map((r) => html`
                <li>
                  <a class="room-link" href=${`/chat/${r.id}`} aria-current=${() => (current() === r.id ? 'page' : null)}>
                    <span class="room-icon" aria-hidden="true">#</span>
                    <span class="room-name">${r.name}</span>
                    ${r.last ? html`<span class="room-time">${time(r.last.at)}</span>` : null}
                    <span class="room-last">${r.last
                      ? `${r.last.authorName}: ${r.last.parts.find((p) => p.type === 'text')?.text ?? `sent ${r.last.parts[0].type === 'image' ? 'an image' : `a ${r.last.parts[0].type}`}`}`
                      : r.topic}</span>
                    ${() => (r.unread && current() !== r.id ? html`<span class="badge" aria-label=${`${r.unread} unread`}>${r.unread}</span>` : null)}
                  </a>
                </li>`)}
            </ul>`,
        })}
      </aside>
      <section class="chat-main">${page}</section>
    </div>
  `;
}
