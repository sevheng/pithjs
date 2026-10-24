import { html } from 'pith';
import { icon } from '../icons.js';

// /chat: on a wide screen the empty room pane; on a phone the layout shows the rooms list instead.
export default function ChatHomePage() {
  return html`
    <div class="chat-empty">
      <span class="icon-tile">${icon('chat')}</span>
      <h1>Chat</h1>
      <p class="muted">Pick a room to read and send messages. Try <a href="/chat/help">#help</a>: the bot answers.</p>
    </div>
  `;
}
