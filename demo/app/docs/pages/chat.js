import { html } from 'pith';
import { code, note, c } from '../ui.js';

export default () => html`
  <p>A team chat with five rooms. Messages are made of typed parts (text, code, images, files and link
    previews) with replies and reactions. What you send shows at once and gets a Retry if the server says no.
    In #help a bot answers, and #firehose holds up to 100,000 messages to show the list staying fast.</p>

  <h2 id="try">What to try</h2>
  <ul>
    <li>Open <a href="/chat/general">#general</a>: a code block (with Copy), a file card, a link preview and a
      quoted reply. Messages from one sender within 5 minutes are grouped under one name.</li>
    <li>Send a message with Enter (Shift+Enter for a new line). It shows at once, marked "Sending…".</li>
    <li>Send a message that contains ${c('/fail')}. The server answers 500: the message stays, marked
      "Not sent", with Retry and Delete.</li>
    <li>Ask the bot in <a href="/chat/help">#help</a> about forms or lists: "Pith bot is typing", then its answer.</li>
    <li>Reply to a message or add a reaction from the buttons on a message. Click a reaction again to take yours back.</li>
    <li>Switch rooms: the rooms list stays where it is and its unread badges clear as you read.</li>
    <li>Open <a href="/chat/firehose">#firehose</a>: 10,000 messages, of which the newest 200 are on screen.
      Try <a href="/chat/firehose?count=100000">?count=100000</a>, "Show older", and "Flood · 100/s", which adds
      20 messages every 200 ms. The bar shows how long each update took.</li>
    <li>The unhappy paths: <a href="/chat/random">#random</a> is empty, and <a href="/chat/nope">/chat/nope</a>
      is a room that doesn't exist.</li>
  </ul>

  <h2 id="built">How it's built</h2>
  <ul>
    <li>${c('app/layouts/chat.js')}: the frame, with the rooms list and the open room. A layout stays mounted while
      you switch rooms, so the list doesn't reload or lose its scroll. On a phone it shows either the list or the room.</li>
    <li>${c('app/pages/chat-room.js')}: one room. It loads the messages, renders each part, and handles sending,
      Retry, replies, reactions, the typing indicator, "Show older" and the #firehose tools.</li>
    <li>${c('app/pages/chat-home.js')}: ${c('/chat')} with no room open.</li>
    <li>${c('app/chat/state.js')}: one shared signal, ${c('roomsVersion')}. The room bumps it after a load (which marks the
      room read), so the layout refetches the unread counts.</li>
    <li>${c('app/chat/format.js')}: times and days, file sizes, initials, links found in text (http and https only),
      and ${c('annotate()')}, which works out once per message whether it starts a new day or a new sender.</li>
    <li>${c('api/chat.mjs')}: the dev API. It lists rooms, returns a room's messages (404 for an unknown one), generates
      #firehose, saves new messages, answers 500 for ${c('/fail')}, and queues the bot's reply.</li>
    <li>${c('prerender.mjs')}: lists every room except #firehose, so ${c('npm run build')} writes each one as HTML with
      its messages already in it.</li>
  </ul>

  <h2 id="pith">The Pith parts it uses</h2>
  <ul>
    <li><a href="/docs/router">Routing</a>: ${c('/chat/:room')} with a layout that stays mounted, and ${c('?count=')} for the #firehose size.</li>
    <li><a href="/docs/resource">Loading data</a>: ${c('resource()')} for the rooms and the messages, ${c('optimistic()')} for
      sending, ${c('mutate(fn)')} for local changes, and ${c('live()')} for the log.</li>
    <li><a href="/docs/lists">Lists</a>: ${c('repeat()')} keyed by message id, so a new message adds one row and nothing else moves.</li>
    <li><a href="/docs/selector">Selecting a row</a>: ${c('selector()')} marks the first message on screen, which always shows its day and sender.</li>
    <li><a href="/docs/signals">Signals</a>: ${c('computed()')} for the window of messages on screen, ${c('effect()')} to keep it at the bottom.</li>
    <li><a href="/docs/dialogs">Dialogs and toasts</a>: "Copied" after Copy code.</li>
    <li><a href="/docs/deploying">Building and deploying</a>: each room prerendered with its messages.</li>
  </ul>

  <h2 id="code">The interesting parts</h2>
  <h3 id="code-send">Sending at once, with Retry</h3>
  <p>${c('optimistic()')} shows the message straight away and rolls it back if the request fails. The failed message
    then goes into its own list, shown under the log with Retry. Other local changes use ${c('mutate(fn)')}: the
    function gets the confirmed messages, so a message still on its way isn't copied in and then added twice.</p>
  ${code(`
// Local changes are functions of the confirmed messages, so a message still on its way (optimistic) isn't
// copied into them and then added again on top.
const change = (fn) => conv.mutate((data) => ({ ...data, messages: fn(data.messages) }));

let sent = 0; // temporary ids for messages on their way (not time-based: two can start in one millisecond)
async function send(text, reply) {
  const temp = { id: \`temp-\${++sent}\`, author: 'you', at: new Date().toISOString(), parts: [{ type: 'text', text }], reactions: [], replyTo: reply ?? undefined, sending: true };
  let saved;
  atBottom.value = true;
  try {
    // Shown at once; rolled back (and rethrown) if the server says no.
    await conv.optimistic(
      (data) => ({ ...data, messages: [...data.messages, temp] }),
      async () => { saved = await fetchJSON(\`/api/chat?room=\${encodeURIComponent(room)}\`, { json: { text, replyTo: reply } }); }
    );
    change((messages) => messages.map((m) => (m.id === temp.id ? saved : m)));
    // …
  } catch (err) {
    failed.value = [...failed.value, { id: temp.id, text, replyTo: reply, error: err.message }];
  }
}`, { file: 'app/pages/chat-room.js' })}

  <h3 id="code-window">Only the newest messages on screen</h3>
  <p>The room keeps every message it loaded, but only a window of them is rendered: the newest 200 when the room
    opens. "Show older" moves the start back by 500. New messages are added at the end, so nothing above them moves.</p>
  ${code(`
const start = signal(/** @type {number | null} */ (null));
const all = computed(() => conv.data.value?.messages ?? []);
// …
const visible = computed(() => {
  const from = start.value;
  if (from === null) return []; // not decided yet (a new load): never "everything", which could be 100,000 rows
  annotate(all.value.slice(Math.max(0, from - 1)), meta);
  return all.value.slice(from);
});
const isFirst = selector(() => visible.value[0]?.id); // the first message on screen always shows its day and sender
const older = computed(() => start.value ?? 0);`, { file: 'app/pages/chat-room.js' })}

  <h3 id="code-live">A log built once</h3>
  <p>${c('render()')} would build its ready view again for every message, reaction and flood batch. ${c('live()')} builds it
    once, and the ${c('repeat()')} inside patches the list as the data changes.</p>
  ${code(`
const log = conv.live({
  // … the loading skeleton and the error view with Try again
  ready: () => html\`\${() => {
    const k = kind.value;
    // … "No such room" and "No messages yet"
    return html\`
      <div class="older">\${() => (older.value ? html\`<button class="btn show-older" type="button" @click=\${showOlder}>
        Show older (\${older.value.toLocaleString()} more)</button>\` : null)}</div>
      <div class="msg-list">\${repeat(visible, (m) => m.id, row)}</div>\`;
  }}\`,
});`, { file: 'app/pages/chat-room.js' })}
  ${note(html`Each ${c('repeat()')} row is one wrapper element. A row that starts with a hole that fills in later can't be removed cleanly.`)}

  <h2 id="tests">Its tests</h2>
  <p>In ${c('tests/flows.js')}:</p>
  <ul>
    <li>chat: a room shows rich messages grouped by sender, and the rooms list</li>
    <li>chat: sending a message shows it, and the bot in #help answers</li>
    <li>chat: an empty room says so</li>
    <li>chat: a message the server rejects shows Not sent, and can be deleted or sent</li>
    <li>chat: replies and reactions</li>
    <li>chat: an unknown room says so</li>
    <li>chat: after switching rooms there is one composer, and sending works</li>
    <li>chat/#firehose: thousands of messages, only the newest on screen, Show older and Flood</li>
  </ul>
`;
