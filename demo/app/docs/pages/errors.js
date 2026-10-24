import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const caught = `
const user = signal(null);

define('user-name', () => html\`<p>\${() => user.value.name}</p>\`); // throws while user is null

// Instead of a broken page, <user-name> shows:
//   Something went wrong. Cannot read properties of null (reading 'name')   [Try again]`;

const custom = `
define('stock-price', setup, {
  fallback: (err, retry) => html\`
    <p class="muted">Price unavailable
      <button class="btn" type="button" @click=\${retry}>Retry</button></p>\`,
});`;

const handlers = `
html\`<button @click=\${() => { throw new Error('nope'); }}>Break</button>\`;  // shows the fallback
html\`<button @click=\${async () => { await save(); }}>Save</button>\`;        // a rejection does too

button.addEventListener('click', () => { throw new Error('nope'); });       // ✗ not covered`;

const routerError = `
export const router = createRouter(routes, {
  error: (err, retry) => html\`
    <section class="section narrow" role="alert">
      <h1>Something went wrong</h1>
      <p class="muted">\${err.message}</p>
      <button class="btn primary" type="button" @click=\${retry}>Try again</button>
    </section>\`,
});`;

const own = `
import { html, signal, catchError } from 'pith';

// A boundary around one widget inside a page, without making it a component.
function Safe(build, fallback) {
  const failed = signal(null);
  let stop = () => {};
  const view = catchError(
    (dispose) => ((stop = dispose), build()),
    (err) => { stop(); failed.value = err; } // stop what build made, show the fallback
  );
  return html\`\${() => (failed.value ? fallback(failed.value) : view)}\`;
}

html\`\${Safe(() => Chart(data), (err) => html\`<p role="alert">The chart failed: \${err.message}</p>\`)}\`;`;

const tryCatch = `
// ✗ catches only what throws right now, and hides it
define('user-card', () => {
  try {
    return html\`<p>\${() => user.value.name}</p>\`;
  } catch {
    return html\`<p>Error</p>\`;
  }
});

// ✓ let it throw: the boundary also catches later errors in holes and handlers
define('user-card', () => html\`<p>\${() => user.value.name}</p>\`, { fallback });`;

const expected = `
// Expected failures (no network, 404, validation) are states, not crashes:
users.render({ error: (err, retry) => html\`<p role="alert">Couldn't load users. <button @click=\${retry}>Retry</button></p>\` });`;

export default () => html`
  <p>A bug in one part of the page shouldn't take down the rest. In Pith, every component and every page is an
    <strong>error boundary</strong>: if it throws, it shows a small error view with a "Try again" button
    in its place, and everything around it keeps working. Click "Break it" above: the text under the panel
    stays.</p>

  <h2 id="what">What gets caught</h2>
  <p>A component's boundary catches errors thrown:</p>
  <ul>
    <li>while its setup runs,</li>
    <li>later, in one of its ${c('${}')} holes or ${c('computed')} values,</li>
    <li>in an ${c('@event')} handler in its template, including an ${c('async')} handler whose promise rejects.</li>
  </ul>
  ${code(caught)}
  <p>The default view is a ${c('role="alert"')} with the error message and a "Try again" button, and the error
    is logged with ${c('console.error')}. "Try again" throws away what setup made and runs it again from
    scratch.</p>
  ${code(handlers)}
  ${note(html`Listeners you add yourself with ${c('addEventListener')} aren't covered. Use ${c('@event')}
    holes in templates.`)}

  <h2 id="fallback">Your own fallback</h2>
  <p>Pass ${c('fallback: (err, retry) => view')} to ${c('define')}. It replaces the component's content;
    call ${c('retry')} to set it up again. With your own fallback, nothing is logged, so log the error
    there if you want it reported.</p>
  ${code(custom)}
  <p>The nearest boundary catches first: a component inside a page shows its own fallback, and the page
    goes on as normal.</p>

  <h2 id="pages">Pages and the router</h2>
  <p>A page that throws while rendering, or later in one of its holes or handlers, shows "This page didn't
    load" with "Try again" in the page's place. The nav bar and layout stay. The same view shows when a
    lazy page's code fails to download (offline, a deploy replaced the file), and "Try again" downloads it
    again. A page file without a default export fails this way too, with ${html`<a href="/docs/warnings#e005">E005</a>`}.</p>
  <p>To brand it, pass ${c('error')} to ${c('createRouter')}:</p>
  ${code(routerError, { file: 'app/router.js' })}
  <p>The "not found" page is different: it's the ${c("'*'")} route. See <a href="/docs/router">Routing</a>.</p>

  <h2 id="catch-error">A boundary of your own</h2>
  <p>Components and pages cover most cases. For a boundary around part of a page, use
    ${c('catchError(fn, handler)')}: errors thrown in ${c('fn')}, or later in effects and holes made inside
    it, go to ${c('handler')}.</p>
  ${code(own)}

  <h2 id="mistakes">Don't wrap setup in try/catch</h2>
  <p>A ${c('try')} around setup only sees errors thrown while it runs. Errors in holes and handlers happen
    later, outside it. The boundary already handles both, so let the error through and give the component a
    ${c('fallback')} if you want a different view.</p>
  ${code(tryCatch)}
  ${note(html`Boundaries are for bugs. A request that fails or a form the server rejects is an expected state:
    ${c('resource()')} and ${c('form()')} give you error views and messages for those, with a retry.
    See <a href="/docs/resource">Loading data</a>.`, 'warn')}
  ${code(expected)}

  <h2 id="api">API</h2>
  ${api([
    ['define(tag, setup, { fallback })', html`${c('(err, retry) => view')}: shown when the component throws. Default: an alert with "Try again".`],
    ['createRouter(routes, { error })', html`${c('(err, retry) => view')}: shown when a page throws or its code fails to load.`],
    ['catchError(fn, handler)', html`Runs ${c('fn')}; errors in it and in effects made inside go to ${c('handler(err)')}.`],
  ])}
`;
