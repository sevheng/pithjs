import { html, signal, repeat, transition } from 'pith';
import { code, api, note, c } from '../ui.js';

/** A small working list: add, remove, move to the top and shuffle, each wrapped in transition(). */
function Demo() {
  let nextId = 4;
  const tasks = signal([
    { id: 1, name: 'Write the release notes' },
    { id: 2, name: 'Review the pull request' },
    { id: 3, name: 'Book the meeting room' },
  ]);
  const names = ['Reply to Ada', 'Water the plants', 'Fix the flaky test', 'Order coffee', 'Update the roadmap'];

  const add = () => transition(() => {
    const id = nextId++;
    tasks.value = [...tasks.value, { id, name: names[id % names.length] }];
  });
  const remove = (id) => transition(() => (tasks.value = tasks.value.filter((t) => t.id !== id)));
  const toTop = (id) => transition(() => {
    const t = tasks.value.find((x) => x.id === id);
    tasks.value = [t, ...tasks.value.filter((x) => x.id !== id)];
  });
  const shuffle = () => transition(() => (tasks.value = [...tasks.value].sort(() => Math.random() - 0.5)));

  return html`
    <div class="card example">
      <div class="row">
        <button class="btn primary" type="button" @click=${add}>Add a task</button>
        <button class="btn" type="button" @click=${shuffle}>Shuffle</button>
      </div>
      <ul class="example-list">
        ${repeat(tasks, (t) => t.id, (t) => html`
          <li class="example-item" style=${`view-transition-name: anim-task-${t.id}`}>
            <span>${t.name}</span>
            <span style="display: flex; flex: none">
              <button class="icon-btn" type="button" aria-label=${`Move "${t.name}" to the top`} @click=${() => toTop(t.id)}>↑</button>
              <button class="icon-btn danger" type="button" aria-label=${`Remove "${t.name}"`} @click=${() => remove(t.id)}>×</button>
            </span>
          </li>`)}
      </ul>
      ${() => (tasks.value.length ? null : html`<p class="empty">Nothing left. Add a task.</p>`)}
    </div>`;
}

export default () => html`
  <section aria-labelledby="which-tool">
    <h2 id="which-tool">Pick the right tool</h2>
    <p>
      Pith has no animation library, because the browser already has one. Most motion is plain CSS; Pith adds
      one function, ${c('transition()')}, for the case CSS can't do alone: things that leave or move.
    </p>
    <ul>
      <li><strong>Hovers, focus, open and close</strong>: a CSS ${c('transition')} on the property that changes.</li>
      <li><strong>Items that appear</strong>: CSS ${c('@starting-style')}, or a keyframe animation.</li>
      <li><strong>Items that are removed or reordered</strong>: wrap the change in ${c('transition()')}.</li>
      <li><strong>Page changes</strong>: nothing to do. The router already animates them.</li>
    </ul>
  </section>

  <section aria-labelledby="transition">
    <h2 id="transition">transition(update)</h2>
    <p>
      ${c('transition(update)')} runs ${c('update')} as a
      <a href="https://developer.mozilla.org/docs/Web/API/View_Transition_API">View Transition</a>: the browser
      takes a picture of the page before and after, then fades out what left, fades in what arrived, and slides
      what moved from its old place to its new one. You only change the data.
    </p>
    ${code(`import { transition } from 'pith';

const remove = (id) => transition(() => {
  todos.value = todos.value.filter((t) => t.id !== id);
});`)}
    <h3 id="try-transition">Try it</h3>
    ${Demo()}
    <p>
      Without View Transitions, or when the person has asked for reduced motion, it just runs ${c('update')}.
      ${c('update')} always runs exactly once.
    </p>
    <h3>Why not call document.startViewTransition yourself</h3>
    <p>
      The browser may hold a view transition back (it does in a background tab, for example), and your change
      waits with it, so a click can look like it did nothing. ${c('transition()')} runs ${c('update')} after 300 ms
      at most, whatever the browser does, so an animation never stops a change. It also checks for reduced motion,
      and quiets the errors a skipped transition throws.
    </p>
  </section>

  <section aria-labelledby="names">
    <h2 id="names">A name per row</h2>
    <p>
      The browser can only slide a row it can tell apart from the others. Give each row its own
      ${c('view-transition-name')}, made from its key, in an inline ${c('style')}:
    </p>
    ${code(`html\`<ul>\${repeat(todos, (t) => t.id, (t) => html\`
  <li style=\${\`view-transition-name: todo-\${t.id}\`}>\${t.text}</li>\`)}</ul>\`;`)}
    ${note(html`Names must be unique on the whole page. Two rows with the same name, say ${c('item-1')} in two lists,
      make the browser skip the animation (the change still happens). Prefix them per list, and use ids with
      letters, digits and dashes only: a name is a CSS identifier.`, 'warn')}
    ${note(html`Use ${c('repeat()')} with a stable key. Without it, rows are rebuilt instead of moved, and nothing
      has a before and after to slide between.`)}
  </section>

  <section aria-labelledby="appearing">
    <h2 id="appearing">Items that appear</h2>
    <p>
      For something added to the page, ${c('@starting-style')} gives the values to animate <em>from</em> when an
      element first renders. Add a ${c('transition')} and the browser does the rest, without any script. The demo's
      Chat uses it for a message you send:
    </p>
    ${code(`.msg.sending { opacity: 0.6; transition: opacity 0.2s, translate 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
@starting-style { .msg.sending { opacity: 0; translate: 0 8px; } }`, { file: 'styles/main.css' })}
    <p>
      The message shows at once (an optimistic update), rises into place, and goes to full opacity when the server
      confirms it.
    </p>
  </section>

  <section aria-labelledby="css">
    <h2 id="css">Hovers and the rest</h2>
    <p>
      Hover, focus, pressed and open states are CSS: put a short ${c('transition')} on the properties that change,
      such as ${c('background')}, ${c('box-shadow')} or ${c('translate')}. Keep it quick (0.1 to 0.25 s) so the
      interface feels fast.
    </p>
    ${code(`.card { transition: box-shadow 0.15s, translate 0.15s; }
.card:hover { box-shadow: var(--shadow-lift); translate: 0 -2px; }

@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
}`)}
    ${note(html`Respect ${c('prefers-reduced-motion')} in your own CSS animations, especially ones that move
      things or loop. ${c('transition()')} and the router already do.`, 'warn')}
  </section>

  <section aria-labelledby="in-the-demo">
    <h2 id="in-the-demo">In the demo apps</h2>
    <ul>
      <li><a href="/kanban">Kanban</a>: every move (drag and drop, the Move buttons, Alt+arrow keys) is one
        ${c('transition()')} around the new card order, and each card has ${c('view-transition-name: kcard-<id>')}.
        Focus goes back to the moved card inside the same update.</li>
      <li><a href="/chat">Chat</a>: a sent message appears with ${c('@starting-style')}, as above.</li>
      <li>The <a href="/docs/lists">Lists</a> example: add, remove and shuffle with ${c('transition()')}.</li>
    </ul>
  </section>

  <section aria-labelledby="animation-api">
    <h2 id="animation-api">API</h2>
    ${api([
      ['transition(update)', 'Run update as a View Transition when the browser has them and motion isn\'t reduced; else run it now. Runs it exactly once, within 300 ms.'],
      ['transition(update, kind)', html`The same, with ${c('data-transition="kind"')} on ${c('<html>')} while it runs, for CSS that styles one kind of change. Page changes are ${c("'page'")}.`],
      ['view-transition-name: x', 'CSS: a unique name per row, so the browser can slide it. Set it in an inline style from the row\'s key.'],
      ['@starting-style { … }', 'CSS: where an element\'s transition starts when it first appears.'],
    ])}
  </section>
`;
