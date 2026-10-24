import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const files = `
AGENTS.md                              the rules, patterns and workflow, in one file
CLAUDE.md                              one line: @AGENTS.md (Claude Code reads CLAUDE.md)
.claude/skills/pith-frontend/SKILL.md  every state of a view, and which Pith tool handles it
.claude/skills/pith-design/SKILL.md    layout, the design system, and the screenshot loop
node_modules/pithjs/docs/errors.md     every warning and error code with its fix
node_modules/pithjs/README.md          the full API reference`;

const checkOutput = `
$ npm run check

User flows
  ✓ 24 passed
  ✗ contact: sending the form shows a thank-you (see("Thank you"): not found on /contact. The page shows:
      # Contact
      textbox "Email" = "ann@example.com"
      button "Send"
      Something went wrong. Try again later.)

1 problem found`;

const seeOutput = `
npm run see /todos                       # outline + screenshot (desktop)
npm run see /todos -- --mobile --full    # phone width (390px), the whole page
npm run see /todos -- --dark             # dark theme, and its text contrast
npm run see /todos -- --state            # also what the route, stores and components hold`;

const state = `
route /todos
store "pith-todos": todos = 3 items [{ id, text, done }, …], filter = "all"
<todo-list>: draft = "", visible = computed · 3 items [{ id, text, done }, …], left = computed · 3`;

const warning = `
[pith W001] @click on <button> needs a function but got number 0. Write @click=\${() => ...}
so the code runs on the event, not while rendering. See framework/docs/errors.md#w001

// the fix, from errors.md:
html\`<button @click=\${count.value++}>+</button>\`        // ✗ runs once while rendering
html\`<button @click=\${() => count.value++}>+</button>\`  // ✓ runs on each click`;

export default () => html`
  <p>
    Pith is built so an AI agent can change an app and know, without a person looking, whether it still
    works. Three things make that possible: one file with the rules, a code for every mistake, and tools
    that turn the running app into text an agent can read.
  </p>

  <h2 id="agents-md">AGENTS.md and CLAUDE.md</h2>
  <p>
    Every new project gets ${c('AGENTS.md')}: the six rules, a copy-paste pattern for each feature, the
    commands, where files go, and the loop to follow. Codex, Copilot, Cursor and most other tools read
    ${c('AGENTS.md')} by themselves. Claude Code reads ${c('CLAUDE.md')}, which is one line, ${c('@AGENTS.md')},
    so both read the same rules.
  </p>
  ${code(files, { label: 'The files an agent reads' })}
  <p>
    Add your own project's notes at the end of ${c('AGENTS.md')} (what each page is for, where data comes
    from). Keep the Pith part as it is, so it stays in step with the framework.
  </p>

  <h2 id="skills">The two skills</h2>
  <p>
    UI work needs more than the rules: a view has to handle loading, errors and empty data, and it has to
    look right. That guidance lives in two skills in ${c('.claude/skills/')}, so it's loaded only when the
    task needs it rather than on every request.
  </p>
  ${api([
    ['pith-frontend', html`Building or changing anything a person sees or clicks: pages, components, forms, lists, data views, dialogs. Covers the workflow, every state a view must have (loading, empty, error, success, disabled), and which Pith tool handles each.`],
    ['pith-design', html`The look: layout, spacing, typography, color, the dark theme, phones and polish, using the design tokens in ${c('styles/main.css')}. It requires looking at the screenshots before calling the work done.`],
  ])}
  <p>
    Claude Code picks a skill by its description when the task matches. Other agents are told by
    ${c('AGENTS.md')} to read both ${c('SKILL.md')} files before starting UI work.
  </p>

  <h2 id="check">npm run check: one verdict</h2>
  <p>
    ${c('npm run check')} runs every test there is (Node tests, framework tests, your user flows, every route
    on desktop and phone, accessibility in both themes, types, the size budget, preloads) and ends with one
    line: ${html`<strong>All good</strong>`}, or the number of problems. An agent is done only when it
    prints All good. Each failure is a ${c('✗')} line that says what went wrong and where:
  </p>
  ${code(checkOutput)}
  <p>
    ${c('npm run check -- --json')} prints the same result as one JSON object, for tools that parse it.
    <a href="/docs/testing">Checks and flows</a> lists every stage.
  </p>

  <h2 id="see">npm run see: look without a browser</h2>
  <p>
    ${c('npm run see /path')} prints the page as a text outline (headings, landmarks, components, links,
    buttons, inputs and their values), flags sideways scrolling and accessibility problems, and saves a
    screenshot to ${c('.pith/screenshots/')}. Agents that can read images open the PNG; the outline is
    enough to check text and structure.
  </p>
  ${code(seeOutput)}
  <p>
    ${c('--state')} prints what the app holds, by variable name, so an agent can see why a page shows what it
    shows without adding ${c('console.log')}s:
  </p>
  ${code(state)}
  <p>
    It uses your running ${c('npm run dev')} server when there is one, so it shows the same data you see in
    your browser (messages you posted, records you added). ${c('--fresh')} starts a new server instead, and
    ${c('--no-shot')} skips the screenshot.
  </p>

  <h2 id="warning-codes">Warning codes with fixes</h2>
  <p>
    When the app makes a known mistake, Pith says so in the console with a code. The code links to an
    entry in ${c('node_modules/pithjs/docs/errors.md')} with the wrong code, the right code and why.
    ${c('npm run check')} fails on any warning, so mistakes can't slip through.
  </p>
  ${code(warning)}
  <p>See <a href="/docs/warnings">Warnings and errors</a> for every code.</p>

  <h2 id="the-loop">The loop an agent follows</h2>
  <ol>
    <li><strong>Look first.</strong> ${c('npm run see /the-page -- --state')}, and open a page with a similar job to reuse its parts.</li>
    <li><strong>Make the change</strong> with the patterns in ${c('AGENTS.md')}. New files come from ${c('npm run new page')} or ${c('npm run new component')}.</li>
    <li><strong>Add a flow</strong> in ${c('tests/flows.js')} for what a person does, including one unhappy path.</li>
    <li><strong>Run ${c('npm run check')}.</strong> Read every ${c('✗')} line; look up each ${c('[pith W…]')} or ${c('[pith E…]')} code.</li>
    <li><strong>Look at it</strong> on desktop, phone and dark (${c('--mobile')}, ${c('--dark')}, ${c('--full')}), and fix what's off.</li>
    <li><strong>Done</strong> only when ${c('npm run check')} prints All good.</li>
  </ol>
  ${note(html`If Pith itself seems wrong, the agent shouldn't edit ${c('node_modules/pithjs/')}. It writes a user
    flow that shows the problem, and reports it.`, 'warn')}
`;
