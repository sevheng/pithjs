import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const warning = (id) => html`<a href=${`/docs/warnings#${id.toLowerCase()}`}>${id}</a>`;

const first = `
// app/components/my-counter.js
import { define, html, signal } from 'pith';

define('my-counter', (props, ctx) => {
  const count = signal(Number(props.start.value) || 0);
  return html\`<button class="btn" @click=\${() => count.value++}>Clicked \${count} times</button>\`;
}, { props: ['start'] });`;

const usePage = `
// app/pages/home.js
import { html } from 'pith';
import '../components/my-counter.js'; // importing the file defines the tag

export default function HomePage() {
  return html\`<h1>Home</h1> <my-counter start="5"></my-counter>\`;
}`;

const propsEx = `
define('user-badge', (props) => html\`
  <span class="badge">\${props.name} · \${() => props['avatar-url'].value ? 'photo' : 'no photo'}</span>
\`, { props: ['name', 'avatar-url'] });

html\`<user-badge name="Ann" avatar-url=\${url}></user-badge>\`;  // attributes: strings
html\`<user-badge .name=\${user.name}></user-badge>\`;            // a property: any value
document.querySelector('user-badge').name = 'Bo';              // the same, from outside`;

const lifecycle = `
define('live-clock', (props, ctx) => {
  const now = signal(new Date());
  ctx.onMount(() => {
    const id = setInterval(() => (now.value = new Date()), 1000);
    return () => clearInterval(id); // runs when the element is removed
  });
  ctx.onCleanup(() => console.log('bye'));
  return html\`<time>\${() => now.value.toLocaleTimeString()}</time>\`;
});`;

const emitEx = `
define('star-rating', (props, ctx) => html\`
  <button @click=\${() => ctx.emit('rate', 5)}>★★★★★</button>
\`);

// The parent listens like for any DOM event. It bubbles, also out of a shadow root.
html\`<star-rating @rate=\${(e) => save(e.detail)}></star-rating>\`;`;

const slots = `
define('info-card', (props, ctx) => html\`
  <article class="card">
    <h3>\${ctx.slot('title')}</h3>
    \${ctx.slot()}
    <footer>\${ctx.slot('actions')}</footer>
  </article>
\`);

html\`<info-card>
  <span slot="title">Storage</span>
  <p>80% used.</p>
  <button slot="actions" class="btn">Upgrade</button>
</info-card>\`;`;

const context = `
import { define, html, provide, inject, signal } from 'pith';

define('theme-box', (props, ctx) => {
  provide('theme', signal('dark'));   // in setup
  return html\`\${ctx.children}\`;
});

define('theme-label', () => {
  const theme = inject('theme', signal('light')); // nearest provider above, or the fallback
  return html\`<span>Theme: \${theme}</span>\`;
});

html\`<theme-box><section><theme-label></theme-label></section></theme-box>\`;`;

const injectWrong = `
define('theme-label', () => {
  const theme = inject('theme', 'light');                       // ✓ at the top of setup
  return html\`<button @click=\${() => inject('theme')}>x</button>\`; // ✗ W031: in a handler
});
provide('theme', theme); // ✗ W030: outside any setup`;

const shadowEx = `
define('fancy-tag', () => html\`<span class="tag"><slot></slot></span>\`, {
  shadow: true,
  styles: \`.tag { padding: 0.2em 0.6em; border-radius: 999px; background: var(--fill); }\`,
});`;

const fnVsComponent = `
// A function: for markup you reuse. No tag, no lifecycle, nothing to import for its side effect.
const price = (cents) => html\`<span class="price">\${(cents / 100).toFixed(2)} €</span>\`;
html\`<p>Total: \${price(total)}</p>\`;

// A component: it has its own state, lifecycle or error boundary, or it's used from plain HTML.
html\`<my-counter start="3"></my-counter>\`;`;

export default () => html`
  <p>A Pith component is a real custom element. ${c('define(tag, setup)')} registers the tag; each time the
    element is added to the page, ${c('setup')} runs once and returns its template. There is no re-render:
    signals inside update their own holes. When the element is removed, everything setup made (effects,
    timers you clean up, requests) is stopped.</p>

  <h2 id="define">Defining a component</h2>
  ${code(first, { file: 'app/components/my-counter.js' })}
  <p>The tag name needs a dash. Import the file in the page that uses it (not in ${c('main.js')}), so its
    code downloads with that page. A tag that's still undefined a second after rendering is usually a
    missing import or a typo (${warning('W006')}).</p>
  ${code(usePage)}
  ${note(html`Setup must ${c('return')} the template. With braces and no ${c('return')}, the component is
    empty (${warning('W007')}). Returning a function (${c('() => html`…`')}) doesn't make it reactive
    either (${warning('W008')}): put the reactive parts in holes.`, 'warn')}
  <p>New project files: ${c('npm run new component user-card')} writes one for you.</p>

  <h2 id="props">Props</h2>
  <p>List the props in ${c('{ props: [...] }')}. Each one is a <strong>signal</strong>, fed by the attribute
    of the same name and by the element's property. Put it in a hole as it is (${c('${props.name}')}) to
    keep it live. Attributes are always strings (or ${c('null')} when missing); use a property
    (${c('.name=${value}')}) to pass numbers, objects or arrays.</p>
  ${code(propsEx)}
  ${note(html`Prop names must be lowercase or kebab-case. HTML lowercases attribute names, so
    ${c('userName')} would arrive as ${c('username')} and never reach the prop (${warning('W009')}).
    Write ${c("props: ['user-name']")} and read ${c("props['user-name']")}.`, 'warn')}
  ${note(html`${c('signal(props.start.value)')} copies the starting value once, which is what you want for
    a starting value. To follow the prop, read it in a hole or a ${c('computed')}.`)}

  <h2 id="ctx">The context object</h2>
  <p>Setup's second argument, ${c('ctx')}, has what a component needs beyond its props.</p>
  <h3>onMount and onCleanup</h3>
  <p>${c('ctx.onMount(fn)')} runs after the first render, when the element is in the page: measure it,
    focus something, start a timer. It may return a cleanup. ${c('ctx.onCleanup(fn)')} runs when the element
    is removed. Moving an element within the page doesn't count as removing it.</p>
  ${code(lifecycle)}
  <h3>emit</h3>
  <p>${c('ctx.emit(type, detail)')} dispatches a bubbling ${c('CustomEvent')} from the element. Use it to
    tell the parent something happened, instead of passing callbacks down.</p>
  ${code(emitEx)}
  <h3>host and children</h3>
  <p>${c('ctx.host')} is the element itself. ${c('ctx.children')} holds the child nodes it had before it
    rendered.</p>

  <h2 id="slots">Slots</h2>
  <p>${c("ctx.slot('name')")} returns the original children with ${c('slot="name"')}; ${c('ctx.slot()')}
    returns the rest (blank text dropped). Place them anywhere in the template.</p>
  ${code(slots)}

  <h2 id="context">Sharing values with provide and inject</h2>
  <p>To give a value to every component inside one, without passing it through each level, call
    ${c('provide(key, value)')} in the outer component's setup and ${c('inject(key, fallback)')} in any
    component inside it. It finds the nearest provider above, also across shadow roots. Provide a signal if
    the value changes.</p>
  ${code(context)}
  ${note(html`Both only work at the top of a component's setup. ${c('provide')} outside setup does nothing
    (${warning('W030')}); ${c('inject')} in a handler, ${c('onMount')} or a hole returns the fallback
    (${warning('W031')}). For app-wide values, export a signal from ${c('app/store.js')} instead.`, 'warn')}
  ${code(injectWrong)}
  <p>In this demo: the <a href="/docs/shop">Shop</a>'s account layout provides the display name, and the greeting and the
    Profile form inject it (${c('app/components/account-context.js')}).</p>

  <h2 id="options">Shadow DOM and styles</h2>
  <p>By default a component renders into itself, so the page's CSS applies as usual. That's what most app
    components want. ${c('shadow: true')} renders into a shadow root instead, with ${c('styles')} as its own
    CSS: use it for widgets whose styles must not leak in or out. Native ${c('<slot>')} works there.</p>
  ${code(shadowEx)}
  <p>The last option, ${c('fallback')}, is the view shown when the component crashes. See
    <a href="/docs/errors">Error boundaries</a>.</p>

  <h2 id="when">A component or a function?</h2>
  <p>Most reusable markup is just a function that returns ${c('html`…`')}: it costs nothing and takes any
    JavaScript value. Make a component when it has its own state and lifecycle, should get its own error
    boundary, or needs to work as a tag in plain HTML.</p>
  ${code(fnVsComponent)}

  <h2 id="api">API</h2>
  ${api([
    ['define(tag, setup, options?)', html`Registers a custom element. ${c('setup(props, ctx)')} runs once per mount and returns the template.`],
    ['options.props', 'Prop names (lowercase or kebab-case, W009). Each is a signal fed by the attribute and the property.'],
    ['options.shadow', html`${c('true')}: render into a shadow root. Default ${c('false')}.`],
    ['options.styles', html`CSS for the shadow root (with ${c('shadow: true')}).`],
    ['options.fallback', html`${c('(err, retry) => view')}, shown if the component throws.`],
    ['ctx.onMount(fn)', 'Runs after the first render; fn may return a cleanup.'],
    ['ctx.onCleanup(fn)', 'Runs when the element is removed.'],
    ['ctx.emit(type, detail)', 'Dispatches a bubbling, composed CustomEvent.'],
    ['ctx.slot(name?)', html`Children with ${c('slot="name"')}, or the rest.`],
    ['ctx.host · ctx.children', 'The element, and its original child nodes.'],
    ['provide(key, value)', 'In setup: make value available to components inside (W030).'],
    ['inject(key, fallback?)', 'In setup: the nearest provided value, or fallback (W031).'],
  ])}
`;
