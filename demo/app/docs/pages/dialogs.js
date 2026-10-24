import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const usage = `
import { confirm, dialog, toast } from '../ui.js';   // from app/pages or app/components

const clearDone = async () => {
  if (!(await confirm('Clear completed todos?', { ok: 'Clear', danger: true }))) return;
  store.todos.value = store.todos.value.filter((t) => !t.done);
  toast('Cleared', { type: 'success' });
};`;

const custom = `
const color = await dialog((close) => html\`
  <h2>Pick a color</h2>
  <div class="row">
    <button class="btn" type="button" @click=\${() => close('red')}>Red</button>
    <button class="btn" type="button" @click=\${() => close('blue')}>Blue</button>
  </div>\`);
// 'red', 'blue', or undefined (Esc or a click on the backdrop)`;

const toasts = `
toast('Saved');                                     // info, gone after 4 s
toast('Could not save', { type: 'error' });         // role="alert": read out at once
const dismiss = toast('Uploading…', { timeout: 0 }); // stays until dismissed
// later:
dismiss();`;

const flowSample = `
flow('todos: clearing completed asks first', async (app) => {
  await app.go('/todos');
  await app.click('Clear completed');   // opens the confirm dialog
  await app.click('Clear');             // its OK button, by its text
  await app.see('Cleared');             // the toast
});`;

export default () => html`
  <h2 id="app-code">App code, not framework</h2>
  <p>
    Pith has no dialog or toast in its core, on purpose. The browser already does the hard parts: a modal
    ${c('<dialog>')} traps focus, closes on Esc, makes the rest of the page inert and sits in the top layer; a
    ${c('popover')} floats above everything without z-index fights. What's left is the look, and every app wants
    its own.
  </p>
  <p>
    So each new project gets ${c('app/ui.js')}: about 150 lines with ${c('confirm()')}, ${c('dialog()')} and
    ${c('toast()')}, and their styles under "UI helpers" in ${c('styles/main.css')}. It's yours: change the
    markup, the styles or the behavior, or add a drawer or a menu next to them. An AI agent can extend it
    with the same browser APIs.
  </p>
  ${note(html`Don't use ${c('window.confirm')} or ${c('alert')}. They block the page, can't be styled, and some
    browsers suppress them. Use ${c('app/ui.js')}.`, 'warn')}

  <h2 id="using-them">Using them</h2>
  <p>
    Each one is a promise, so the code reads top to bottom: ask, wait for the answer, act. Import
    ${c('app/ui.js')} in the page or component that uses it, not in ${c('main.js')}, so other pages never load it.
  </p>
  ${code(usage, { file: 'app/components/todo-list.js' })}
  ${api([
    ['confirm(message, { ok, cancel, danger })', html`A yes/no question. Resolves ${c('true')} for OK, ${c('false')} for Cancel, Esc or the backdrop. ${c('danger: true')} makes OK red and starts focus on Cancel.`],
    ['dialog((close) => content, { label })', html`Any content in a modal. ${c('close(value)')} resolves the promise with value; Esc and the backdrop resolve ${c('undefined')}.`],
    ['toast(message, { type, timeout })', html`A short message in the corner. ${c('type')}: ${c("'info'")}, ${c("'success'")} or ${c("'error'")}; ${c('timeout')} in ms, ${c('0')} to stay. Returns a function that dismisses it.`],
  ])}

  <h3 id="custom-dialogs">Custom dialogs</h3>
  <p>
    Start the content with a heading: it becomes the dialog's accessible name. (Or pass ${c('{ label }')}; with
    neither, ${c('dialog()')} warns.) When the dialog closes it's removed, its effects are cleaned up, and focus
    goes back to where it was.
  </p>
  ${code(custom)}
  <p>
    A form inside works too: put a ${c('form()')} in the content and call ${c('close(values)')} from its
    ${c('onSubmit')}. While it's open, the dialog's own signals update like any other template.
  </p>

  <h3 id="toasts">Toasts</h3>
  <p>
    Toasts share one live region (${c('role="status"')}), so screen readers announce them; error toasts use
    ${c('role="alert"')}. A toast pauses its timer while it's pointed at or focused, so it can be read and
    dismissed, and it stays on top even when a modal dialog is open.
  </p>
  ${code(toasts)}

  <h2 id="in-flows">In user flows</h2>
  <p>
    Dialogs and toasts are ordinary page content, so flows use them like a person: click the button that
    opens the dialog, click its button by name, and check the toast's text.
  </p>
  ${code(flowSample, { file: 'tests/flows.js' })}
  <p>
    Name the action in the buttons ("Delete", not "OK"): a person knows what will happen, and the flow
    reads like the page.
  </p>
`;
