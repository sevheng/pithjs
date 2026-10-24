import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const message = `
[pith W009] ... See framework/docs/errors.md#w009`;

const force = `
<script>globalThis.PITH_DEV = true;</script>  <!-- before pith is imported: warnings on any host -->`;

/**
 * Every code in framework/docs/errors.md, grouped by area: [id, heading, rows of [code, the mistake and its fix]].
 * @type {[string, string, [string, unknown][]][]}
 */
const groups = [
  ['templates', 'Templates', [
    ['W001', html`An ${c('@event')} hole got something that isn't a function. Wrap it: ${c('@click=${() => count.value++}')}.`],
    ['W002', html`A plain object in a text hole would show as ${c('[object Object]')}. Show one of its fields: ${c('${user.name}')}.`],
    ['W003', html`A signal or function inside an array, or returned from a function, doesn't update. Make it the whole hole: ${c('${count} items')}.`],
    ['W004', html`${c('repeat()')} inside an array or a function. Make it the whole hole; to hide the list, wrap the ${c('<ul>')} instead.`],
    ['W017', html`A ${c('repeat()')} row starts with a reactive hole outside any element, which would stay behind when the row is removed. Wrap the row in one element.`],
    ['E001', html`A hole inside a tag that isn't a whole attribute value (${c('class="card ${size}"')}). Build the string in JS: ${c('class=${`card ${size}`}')}.`],
    ['E002', html`A hole inside ${c('<textarea>')}, ${c('<title>')}, ${c('<style>')}, ${c('<script>')} or a comment. Use ${c('.value=${text}')}; set titles in the route.`],
  ]],
  ['lists', 'Lists', [
    ['W005', html`${c('repeat()')} saw the same key twice, so rows go missing. Use a stable unique id (${c('crypto.randomUUID()')}), not the index.`],
  ]],
  ['components', 'Components and context', [
    ['W006', html`A custom tag isn't defined a second after rendering: misspelled, or its file was never imported. Import it in the page that uses it.`],
    ['W007', html`A component's setup returned nothing, usually a missing ${c('return')}.`],
    ['W008', html`Setup returned a function. Setup runs once; put the reactive parts inside the template.`],
    ['W009', html`A prop name has capital letters, but attributes are lowercase. Use kebab-case: ${c("props: ['user-name']")}.`],
    ['W010', html`${c('ref=${...}')} got something that isn't a function. Use ${c('ref=${(el) => (input = el)}')}.`],
    ['W030', html`${c('provide()')} outside a component's setup. Call it in setup, or export a signal from ${c('app/store.js')}.`],
    ['W031', html`${c('inject()')} outside setup returns the fallback. Call it at the top of setup, not in a handler or hole.`],
    ['E004', html`${c('define()')} without a setup function. Use ${c("define('my-tag', (props, ctx) => html`...`)")}.`],
  ]],
  ['router', 'Router', [
    ['W011', html`A route pattern doesn't start with ${c('/')}. Write ${c("'/todos'")}.`],
    ['W012', html`A route has neither ${c('load')} nor a view. Add ${c("load: () => import('./pages/todos.js')")}.`],
    ['W013', html`There's no ${c("'*'")} route, so unknown URLs show plain "Not found" text. Add a not-found page.`],
    ['W020', html`Redirects went round more than 10 times: a ${c('redirect')} or the guard sends a URL back where it came from. Don't guard the page you redirect to.`],
    ['W021', html`A route's ${c('layout')} isn't a function or ${c('{ load }')}.`],
    ['W022', html`The guard returned something other than ${c('true')} or a path, so the page is shown. Return ${c('true')} or ${c("'/login'")}.`],
    ['E005', html`A lazy page or layout file has no default export. Use ${c('export default function TodosPage() {…}')}.`],
  ]],
  ['state', 'State, data and forms', [
    ['E003', html`Effects kept re-running each other, usually an effect writing a signal it reads. Derive with ${c('computed()')} instead.`],
    ['W014', html`A persisted store holds a value JSON can't save (${c('Date')}, ${c('Map')}, ${c('Set')}, functions). Store plain data, like an ISO date string.`],
    ['W040', html`${c('paginated()')}'s fetcher returned neither an array nor ${c('{ items, next }')}. Return the list itself, e.g. ${c('(await fetchJSON(url)).data')}.`],
    ['W050', html`A sticky or fixed bar has no ${c('view-transition-name')}, so rows animated by ${c('transition()')} are drawn over it. Give it a layer while transitions run (the starter styles do for ${c('nav-bar')}).`],
    ['W051', html`An element animated by ${c('transition()')} is outside the visible part of its scroll box, so it's drawn outside the box. Don't animate rows inside a scroll box: take ${c('class="motion"')} off that list.`],
    ['W015', html`${c('form()')} has a ${c('validate')} rule for a field that isn't in ${c('initial')}, so it never runs. Add the field or fix the name.`],
    ['W016', html`A field helper names a field that isn't in ${c('initial')}, so it renders nothing. Add it to ${c('initial')}.`],
  ]],
  ['build', 'Build and prerendering', [
    ['W060', 'A route showed the not-found page while prerendering. Its pattern doesn\'t match its path; fix the route.'],
    ['W061', html`A route rendered nothing into ${c('#app')}. ${c('main.js')} must render into ${c('<div id="app">')}.`],
    ['W062', html`A route logged errors while prerendering, so it wasn't written. Fix them (${c('npm run check -- --build')}).`],
    ['W063', html`A route showed another page (a redirect, or the guard). Expected: it gets the plain shell. Give every route a ${c('title')}.`],
    ['W064', html`A ${c('prerender.mjs')} URL matches no route, or showed the ${c("'*'")} page. Fix the URL or the route.`],
    ['W065', html`A ${c('prerender.mjs')} URL can't become a file: it needs one leading ${c('/')}, no ${c('?')}, ${c('#')}, ${c('..')} or ${c(':')}.`],
    ['W066', html`${c('prerender.mjs')} failed: it threw, had no default export, or didn't return an array of paths.`],
  ]],
];

export default () => html`
  <p>
    When your code makes a mistake Pith knows about, it tells you in the browser console with a code, and
    the code leads to a fix. ${c('npm run check')} fails on any of them, so they can't slip into a commit.
  </p>
  ${code(message, { label: 'The shape of every message' })}

  <h2 id="how-they-work">How they work</h2>
  <ul>
    <li>
      <strong>Warnings (${c('W…')})</strong> are for code that runs but does the wrong thing, like a click
      handler that ran once while rendering. Each distinct message is shown once. They're on only on
      ${c('localhost')}, and ${c('npm run build')} removes their code entirely, so they cost nothing in
      production.
    </li>
    <li>
      <strong>Errors (${c('E…')})</strong> are thrown everywhere, in development and production, because the
      output would be wrong otherwise. A page or component that throws shows its error view with "Try again",
      and the rest of the app keeps working.
    </li>
    <li>
      <strong>Build warnings (${c('W06…')})</strong> are printed by ${c('npm run build')} for routes and URLs that
      couldn't be prerendered.
    </li>
  </ul>
  <p>To turn warnings on or off on another host, set a flag before Pith is imported:</p>
  ${code(force, { file: 'index.html' })}

  <h2 id="every-code">Every code, by area</h2>
  <p>
    One line each: what went wrong, and the fix. The full list, with wrong-and-right code for each, is in
    ${c('node_modules/pithjs/docs/errors.md')} in your project (${c('framework/docs/errors.md')} in the Pith repo).
  </p>
  ${groups.map(([id, title, rows]) => html`
    <h3 id=${id}>${title}</h3>
    ${api(rows, { head: ['Code', 'Problem and fix'], anchors: true })}
  `)}
  ${note(html`Don't silence a warning to make the check pass. Each one means something on the page is wrong,
    or will be for some user.`, 'warn')}
`;
