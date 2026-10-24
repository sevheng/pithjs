import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const warning = (id) => html`<a href=${`/docs/warnings#${id.toLowerCase()}`}>${id}</a>`;

const overview = `
import { html, signal } from 'pith';

const name = signal('Ann');
const busy = signal(false);

const view = html\`
  <p>Hello, \${name}</p>                                    <!-- text -->
  <a href=\${\`/users/\${id}\`} class="link">Profile</a>       <!-- attribute -->
  <button ?disabled=\${busy}>Save</button>                  <!-- boolean attribute -->
  <input .value=\${name}>                                   <!-- property -->
  <button @click=\${() => (busy.value = true)}>Go</button>  <!-- event -->
  <input ref=\${(el) => el.focus()}>                        <!-- the element itself -->
\`;
document.getElementById('app').replaceChildren(view);`;

const text = `
html\`<p>\${user.name} has \${count} messages</p>\`;       // strings and numbers
html\`<p>\${() => (count.value === 1 ? 'one' : 'many')}</p>\`; // a function: updates
html\`<p>\${null} \${false} \${undefined}</p>\`;           // nothing at all`;

const nested = `
const badge = (n) => html\`<span class="badge">\${n}</span>\`;

html\`
  <h2>Inbox \${badge(3)}</h2>
  <ul>\${['a', 'b'].map((x) => html\`<li>\${x}</li>\`)}</ul>
\`;`;

const conditional = `
const open = signal(false);

html\`
  <button @click=\${() => (open.value = !open.value)}>Details</button>
  \${() => (open.value ? html\`<div class="card">More text</div>\` : null)}
\`;

// Several cases: return a different template from the function.
html\`\${() => {
  if (status.value === 'loading') return html\`<p>Loading…</p>\`;
  if (status.value === 'error') return html\`<p role="alert">It didn't load.</p>\`;
  return html\`<p>\${items.value.length} items</p>\`;
}}\`;`;

const attrs = `
html\`<div class=\${cls}>\`;             // ✓ the whole value
html\`<div class=\${\`card \${size}\`}>\`;  // ✓ build the string in JS
html\`<div class=\${() => (on.value ? 'card on' : 'card')}>\`; // ✓ reactive
html\`<div class="card \${size}">\`;  // ✗ E001: part of a value
html\`<div \${attrs}>\`;              // ✗ E001: holes can't add attributes`;

const bools = `
html\`<button ?disabled=\${busy}>Save</button>\`;        // present while busy is true
html\`<details ?open=\${() => step.value === 2}>…</details>\`;
html\`<a href=\${url} aria-current=\${isHere ? 'page' : null}>\`; // null or false removes it`;

const props = `
html\`<input .value=\${draft} @input=\${(e) => (draft.value = e.target.value)}>\`;
html\`<input type="checkbox" .checked=\${done} @change=\${(e) => (done.value = e.target.checked)}>\`;
html\`<textarea .value=\${notes}></textarea>\`;
html\`<user-card .user=\${{ id: 1, name: 'Ann' }}></user-card>\`; // an object, not a string`;

const events = `
html\`<button @click=\${() => count.value++}>+</button>\`;  // ✓ runs on each click
html\`<button @click=\${save}>Save</button>\`;              // ✓ the function itself
html\`<button @click=\${save()}>Save</button>\`;            // ✗ W001: runs once, while rendering
html\`<form @submit=\${(e) => { e.preventDefault(); send(); }}>\`;`;

const refs = `
let input;
html\`<input ref=\${(el) => (input = el)}>
  <button @click=\${() => input.focus()}>Focus</button>\`;`;

const escaping = `
const comment = '<img src=x onerror=alert(1)>';
html\`<p>\${comment}</p>\`;            // shows the text, runs nothing
html\`<a href=\${'javascript:alert(1)'}>\`; // becomes href="#"`;

const noHoles = `
html\`<textarea>\${text}</textarea>\`;        // ✗ E002
html\`<textarea .value=\${text}></textarea>\`; // ✓
html\`<style>.x { color: \${c} }</style>\`;  // ✗ E002: use style=\${\`color: \${c}\`} or a CSS variable
html\`<!-- \${note} -->\`;                   // ✗ E002`;

const listsEx = `
// A plain array: fine for a list that's built once
html\`<ul>\${tags.map((t) => html\`<li>\${t}</li>\`)}</ul>\`;

// A list that changes: repeat() with a key keeps and moves rows
html\`<ul>\${repeat(todos, (t) => t.id, (t) => html\`<li>\${t.text}</li>\`)}</ul>\`;`;

export default () => html`
  <p>Pith's views are ${c('html`…`')} tagged templates: plain HTML with ${c('${}')} holes. Each call gives you
    real DOM (a ${c('DocumentFragment')}). The HTML is parsed once per place in your code and then copied,
    and every hole is tied straight to its node, so an update touches that node and nothing else.
    No virtual DOM, no JSX, no build step.</p>
  ${code(overview)}

  <h2 id="text">Text holes</h2>
  <p>Between tags, a hole shows text. Strings and numbers appear as they are. ${c('null')},
    ${c('undefined')}, ${c('true')} and ${c('false')} show nothing, which is handy for
    ${c('${error && html`…`}')}.</p>
  ${code(text)}
  <p>A signal or a function in a hole updates in place (see <a href="/docs/signals">Signals</a>). Anything
    else is read once.</p>
  ${note(html`${c('${count.value}')} is a snapshot. It's read while the template is built and never
    changes. Pass the signal (${c('${count}')}) or a function (${c('${() => count.value * 2}')}).`, 'warn')}
  ${note(html`Putting a whole object in a hole shows ${c('[object Object]')} (${warning('W002')}). Show one of its fields: ${c('${user.name}')}.`, 'warn')}

  <h2 id="nesting">Nested templates and arrays</h2>
  <p>A hole can hold another template, a DOM node, or an array of them. Small helper functions that
    return ${c('html`…`')} are the easiest way to split a view up.</p>
  ${code(nested)}

  <h2 id="conditional">Showing things conditionally</h2>
  <p>Return a template, or ${c('null')}, from a function hole. When the signals it read change, the old
    content is removed and the new one put in its place.</p>
  ${code(conditional)}
  <p>Keep the function small: it rebuilds everything it returns. A signal inside the template it returns
    still updates by itself, without the function running again.</p>

  <h2 id="attributes">Attributes</h2>
  <p>${c('name=${value}')} sets an attribute. ${c('null')}, ${c('undefined')} and ${c('false')} remove it,
    ${c('true')} sets it empty. A signal or function keeps it up to date.</p>
  <p>The hole must be the <strong>whole value</strong>. Pith binds each hole to one attribute, so it can't
    fill half of one. Build the string in JavaScript instead.</p>
  ${code(attrs)}
  ${note(html`${c('class="btn ${kind}"')} throws ${warning('E001')}. Write
    ${c('class=${`btn ${kind}`}')}, or a function for a class that changes.`, 'warn')}

  <h3>Boolean attributes</h3>
  <p>${c('?name=${value}')} adds the attribute when the value is truthy and removes it when it isn't.
    Use it for ${c('disabled')}, ${c('hidden')}, ${c('open')}, ${c('required')}.</p>
  ${code(bools)}

  <h3>Properties</h3>
  <p>${c('.name=${value}')} sets the DOM property ${c('el.name')}, not the attribute. Use it for what the
    user can change (an input's ${c('.value')}, a checkbox's ${c('.checked')}), and to pass objects or
    arrays to a component. The property is only written when it differs, so typing isn't interrupted.</p>
  ${code(props)}

  <h2 id="events">Events</h2>
  <p>${c('@name=${fn}')} adds an event listener. Any event name works (${c('@click')}, ${c('@input')},
    ${c('@keydown')}, a component's own ${c('@saved')}).</p>
  ${code(events)}
  ${note(html`The hole needs a function. ${c('@click=${save()}')} calls ${c('save')} once while the page is
    built, and the button then does nothing (${warning('W001')}). Wrap it: ${c('@click=${() => save()}')}.`, 'warn')}
  <p>An error thrown in a handler (or a rejected ${c('async')} handler) shows the component's or page's
    error view, like an error while rendering. See <a href="/docs/errors">Error boundaries</a>.</p>

  <h2 id="ref">Getting the element</h2>
  <p>${c('ref=${(el) => …}')} calls your function with the element once it's created, for things a
    template can't say: focus, measuring, a third-party widget. It needs a function (${warning('W010')}).</p>
  ${code(refs)}

  <h2 id="escaping">Escaping: safe for user input</h2>
  <p>Text holes always become text nodes, never HTML, so whatever a user typed shows as typed. Attribute
    values are set with ${c('setAttribute')}, and a ${c('javascript:')} URL in ${c('href')} or ${c('src')}
    is replaced with ${c('#')}.</p>
  ${code(escaping)}
  ${note(html`Never put data into ${c('innerHTML')} yourself. That skips all of this. If you have
    trusted HTML to show (Markdown you rendered on the server), sanitize it first.`, 'warn')}

  <h2 id="no-holes">Where holes can't go</h2>
  <p>Inside ${c('<textarea>')}, ${c('<title>')}, ${c('<style>')}, ${c('<script>')} and HTML comments, the
    browser reads everything as plain text, so a hole would silently show nothing. Pith throws
    ${warning('E002')} instead. Use ${c('.value')} for a textarea, the route's ${c('title')} for the
    page title, and a ${c('style')} attribute or CSS variable for styles.</p>
  ${code(noHoles)}

  <h2 id="lists">Plain arrays and keyed lists</h2>
  <p>A ${c('.map()')} that returns templates is fine for a list you build once. Inside a function hole it
    is rebuilt from scratch on every change, which loses focus and input in the rows. For a list that
    changes, use ${c('repeat()')}: it keeps each row by key and moves it.
    See <a href="/docs/lists">Lists</a>.</p>
  ${code(listsEx)}

  <h2 id="svg">SVG</h2>
  <p>Markup inside one ${c('html`<svg>…</svg>`')} is SVG. A piece of an SVG built in its own template (a list
    of labels, a crosshair) uses ${c('svg')} instead of ${c('html')}, so its ${c('<text>')}, ${c('<path>')} and
    ${c('<g>')} are SVG elements and not unknown HTML ones. The Dashboard's charts are built this way.</p>
  ${code(`import { html, svg } from 'pith';

html\`<svg viewBox="0 0 100 50">
  \${ticks.map((t) => svg\`<text x=\${t.x} y="48">\${t.label}</text>\`)}
</svg>\`;`)}

  <h2 id="api">API</h2>
  ${api([
    ['html`…`', 'Builds DOM from the template. Returns a DocumentFragment.'],
    ['${value}', 'Text (escaped), a node, a template or an array of them. null, undefined and booleans show nothing.'],
    ['${signal} · ${() => …}', 'Updates in place when the signals it reads change.'],
    ['name=${v}', html`Sets an attribute; ${c('null')}/${c('false')} removes it. Must be the whole value (E001).`],
    ['?name=${v}', 'Adds or removes a boolean attribute.'],
    ['.name=${v}', 'Sets a DOM property (input values, objects for components).'],
    ['@name=${fn}', 'Adds an event listener. Needs a function (W001).'],
    ['ref=${(el) => …}', 'Calls the function with the element (W010).'],
    ['repeat(items, key, row)', html`A keyed list; see <a href="/docs/lists">Lists</a>.`],
    ['svg`…`', html`Like ${c('html')}, for a piece that goes inside an ${c('<svg>')}.`],
  ])}
`;
