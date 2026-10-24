import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const flowSample = `
import { flow } from 'pith/testing';

flow('contact: sending the form shows a thank-you', async (app) => {
  await app.go('/contact');
  await app.type('Email', 'ann@example.com');   // by <label>, placeholder or aria-label
  await app.type('Message', 'Hello!');
  await app.click('Send');                      // by button/link text or aria-label
  await app.see('Thank you');                   // waits up to 3 s
  await app.notSee('Error');
  await app.expectPath('/contact');
  app.expect(app.query('#email').value === '', 'the form should reset');
});

flow('contact: an empty email is refused', async (app) => {
  await app.go('/contact');
  await app.click('Send');
  await app.see('This field is required');
});`;

const failure = `
✗ contact: sending the form shows a thank-you (see("Thank you"): not found on /contact. The page shows:
    [nav]
      link "Home" → /
    [main]
      # Contact
      <contact-form>
        [form]
          textbox "Email" = "ann@example.com"
          textbox "Message" = "Hello!"
          button "Send" (disabled)
    State:
    route /contact
    <contact-form>: sent = false, ...)`;

const browsers = `
npm install --save-dev playwright-core
npx playwright-core install firefox webkit
npm run check -- --browsers`;

export default () => html`
  <p>
    One command tells you whether everything still works: ${c('npm run check')}. It ends with
    ${html`<strong>All good</strong>`}, or a ${c('✗')} line for each problem with what went wrong and where.
    Work isn't done until it prints All good.
  </p>

  <h2 id="what-check-runs">What npm run check runs</h2>
  <p>Each stage runs in headless Chrome or Node. Stages that don't apply to a project are skipped.</p>
  <ol>
    <li><strong>Node tests</strong>: the framework's ${c('*.test.mjs')} files, and your project's ${c('tests/*.test.mjs')}.</li>
    <li><strong>Framework tests</strong> in Chrome, so a broken Pith shows up before your app does.</li>
    <li><strong>User flows</strong> from ${c('tests/flows.js')}: scripts that click and type like a person.</li>
    <li><strong>Every route</strong> in ${c('app/router.js')} renders with a title, one ${c('<h1>')}, no errors and no ${c('[pith]')} warnings, and doesn't scroll sideways at phone width (390px). It also checks accessibility: labels, button and link names, ${c('alt')}, unique ids, ${c('<html lang>')}, and text contrast in the light and the dark theme. A ${c(':param')} route is checked with the first URL ${c('prerender.mjs')} lists for it.</li>
    <li><strong>Types</strong>: a JSDoc type check with TypeScript, fetched once by npx (skipped offline).</li>
    <li><strong>Size</strong>: the whole framework, minified and gzipped, stays within its 10 KB budget.</li>
    <li><strong>Preloads</strong>: ${c('index.html')} preloads exactly the modules the app loads at startup. Without a build, a missing one costs a round trip and an extra one wastes a download.</li>
    <li><strong>Release</strong>: ${c('pith.min.js')}, the no-build production copy, matches the framework's source.</li>
  </ol>
  ${api([
    ['npm run check', 'All of the above, in Chrome.'],
    ['npm run check -- --json', 'The same result as one JSON object, for tools and AI agents.'],
    ['npm run check -- --build', html`Builds with Vite first and checks the built ${c('dist/')}, including that every route and every ${c('prerender.mjs')} URL was prerendered.`],
    ['npm run check -- --browsers', 'Also runs the framework tests and your flows in Firefox and WebKit (Safari\'s engine).'],
  ])}
  <p>
    Checks run a few headless Chromes at a time; ${c('PITH_CHROME_JOBS=2')} lowers that on a busy machine, and
    ${c('CHROME_PATH')} points at Chrome if it isn't found.
  </p>

  <h2 id="user-flows">User flows</h2>
  <p>
    A flow is a short script of what a person does and what they should then see. Flows live in
    ${c('tests/flows.js')}; add one for each feature, including one unhappy path (an error, an empty list).
  </p>
  ${code(flowSample, { file: 'tests/flows.js' })}
  <p>
    Each flow gets a fresh page with empty ${c('localStorage')}. It fails if any step fails, and also if the app
    logged an error or a warning while it ran.
  </p>

  <h3 id="finding-things">Finding things by name</h3>
  <p>
    Flows find elements the way a person does: buttons and links by their visible text or ${c('aria-label')},
    fields by their ${c('<label>')}, placeholder or ${c('aria-label')}. The exact name is tried first, then the
    name ignoring case. So a flow keeps working when you restyle the page, and an unlabelled field fails the
    flow just as it fails a screen-reader user.
  </p>
  <p>
    A target that starts with ${c('#')}, ${c('.')} or ${c('[')} is tried as a CSS selector first
    (${c("app.click('#save')")}). If it isn't a valid selector, or matches nothing visible, it's read as a name.
  </p>

  <h3 id="the-app-api">The app API</h3>
  <p>Every action waits up to 3 seconds for its target, so you don't write waits by hand.</p>
  ${api([
    ['app.go(path)', 'Load a page, like typing the URL, and wait until it has rendered its <h1>.'],
    ['app.click(target)', 'Click a button, link or checkbox. Fails if it is disabled.'],
    ['app.type(target, text)', 'Replace the text of an input or textarea.'],
    ['app.select(target, option)', 'Choose an option in a dropdown, by its visible text or value.'],
    ['app.pressEnter()', 'Submit the form of the focused field.'],
    ['app.see(text)', 'Wait until the visible page text contains text.'],
    ['app.notSee(text)', 'Wait until it no longer does. Both skip text that only screen readers get (sr-only).'],
    ['app.hear(text)', 'Wait until a live region (aria-live, role status or alert) announces text, even when it is visually hidden.'],
    ['app.expectPath(path)', 'Wait until the URL path is path.'],
    ['app.back()', 'The browser\'s back button.'],
    ['app.expect(condition, message)', 'Fail with message unless condition is truthy.'],
    ['app.waitFor(check, message)', 'Wait until check() is truthy, else fail with message.'],
    ['app.query(sel) · app.queryAll(sel)', 'Elements in the page, for checks that text can\'t express.'],
    ['app.outline()', 'The page as a text outline.'],
  ])}

  <h3 id="when-a-step-fails">When a step fails</h3>
  <p>
    A failing step says what it looked for and prints the whole page as an outline: headings, landmarks,
    links, buttons and fields with their values and states. Under it comes what the app holds (the route,
    stores, and each component's signals by variable name), so you can see <em>why</em> without adding
    ${c('console.log')}s:
  </p>
  ${code(failure)}
  <p>
    While ${c('npm run dev')} runs, you can also open the flows by hand at ${c('/__pith/flows.html')}, and the
    framework tests at ${c('/__pith/')}.
  </p>

  <h2 id="see">Looking at a page</h2>
  <p>
    ${c('npm run see /path')} prints the same outline for any page and saves a screenshot to
    ${c('.pith/screenshots/')}. Add ${c('-- --mobile')}, ${c('--dark')}, ${c('--full')} or ${c('--state')} for the
    phone, the dark theme, the whole page, or what the app holds. See
    <a href="/docs/ai-agents#see">Building with AI</a> for more.
  </p>

  <h2 id="other-browsers">Firefox and Safari</h2>
  <p>
    ${c('npm run check')} runs in Chrome. ${c('--browsers')} also runs the framework tests and your flows in
    Firefox and WebKit, through Playwright's browser driver. It's optional and skipped until you install it
    once in the project:
  </p>
  ${code(browsers)}
  ${note(html`Before you deploy, run ${c('npm run check -- --build')}: it checks the app your visitors will
    actually get, bundled and prerendered.`)}
`;
