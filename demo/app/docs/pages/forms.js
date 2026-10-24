import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

export default () => html`
  <section aria-labelledby="make-a-form">
    <h2 id="make-a-form">Make a form</h2>
    <p>
      ${c('form({ initial, validate, onSubmit })')} holds a form's values, checks them, shows errors next to the
      right fields, and runs your ${c('onSubmit')} only when everything passes. ${c('initial')} names every field
      and its starting value; ${c('validate')} gives each field one rule or a list of them.
    </p>
    ${code(`import { html, form, rules, fetchJSON } from 'pith';
import { router } from '../router.js';

export default function SignupPage() {
  const f = form({
    initial: { email: '', password: '', plan: 'free', terms: false },
    validate: {
      email: [rules.required(), rules.email()],
      password: [rules.required(), rules.minLength(8)],
      terms: rules.required('Please accept the terms'),
    },
    onSubmit: async (values) => {
      await fetchJSON('/api/signup', { json: values });
      router.navigate('/welcome');
    },
  });

  return html\`
    <h1>Sign up</h1>
    <form class="form" novalidate @submit=\${f.submit}>
      \${f.input('email', { label: 'Email', type: 'email', autocomplete: 'email' })}
      \${f.input('password', { label: 'Password', type: 'password', hint: 'At least 8 characters' })}
      \${f.select('plan', { label: 'Plan', options: [['free', 'Free'], ['pro', 'Pro']] })}
      \${f.checkbox('terms', { label: 'I accept the terms' })}
      \${() => (f.submitError.value ? html\`<p class="form-error" role="alert">\${f.submitError.value.message}</p>\` : null)}
      <button class="btn primary" type="submit" ?disabled=\${f.submitting}>Create account</button>
    </form>
  \`;
}`, { file: 'app/pages/signup.js' })}
    <p>
      Why ${c('form()')}: the parts that are easy to get wrong (labels tied to inputs, errors read out by screen
      readers, not shouting at someone who hasn't finished typing, focusing the field to fix, a second click while
      saving) are done once, the same way in every form.
    </p>
    ${note(html`Put ${c('novalidate')} on the ${c('<form>')} and ${c('@submit')} on the form, not ${c('@click')} on the
      button. Then Enter submits, and the browser's own bubbles don't fight Pith's messages.`, 'warn')}
  </section>

  <section aria-labelledby="fields">
    <h2 id="fields">Field helpers</h2>
    <p>
      Each helper renders a label, the control, an optional hint and the error line, wired with
      ${c('for')}/${c('id')}, ${c('aria-invalid')} and ${c('aria-describedby')}. Their value lives in
      ${c('f.fields.<name>')}.
    </p>
    <ul>
      <li>${c("f.input(name, { label, type, placeholder, autocomplete, hint })")}: any input ${c('type')}
        (text by default, email, password, number, tel, url, date…). The value is a string.</li>
      <li>${c("f.textarea(name, { label, rows, placeholder, hint })")}: multi-line text, 4 rows by default.</li>
      <li>${c("f.select(name, { label, options, hint })")}: ${c("options")} is ${c("['a', 'b']")}, or
        ${c("[['value', 'Label'], …]")} pairs.</li>
      <li>${c("f.checkbox(name, { label, hint })")}: the label sits to the right; the value is ${c('true')} or ${c('false')}.</li>
    </ul>
    <h3>Hints</h3>
    <p>
      A ${c('hint')} is help text under the field, read out with it: format rules belong there ("At least 8
      characters"), not in the placeholder, which disappears as soon as someone types. A function makes it live:
    </p>
    ${code(`f.textarea('bio', { label: 'Bio', hint: () => \`\${f.fields.bio.value.length}/200\` })`)}
  </section>

  <section aria-labelledby="rules">
    <h2 id="rules">Rules</h2>
    <p>
      Every rule takes an optional message as its last argument (${c('pattern')} needs one). Empty values pass every
      rule except ${c('required')}, so an optional field can still have a format: ${c('[rules.email()]')} alone
      accepts a blank. With a list, the first rule that fails gives the message.
    </p>
    ${api([
      ['rules.required(msg?)', html`Not empty: not ${c("''")}, null, ${c('false')} (an unticked checkbox) or ${c('[]')}.`],
      ['rules.minLength(n, msg?)', 'At least n characters, ignoring spaces at the ends.'],
      ['rules.maxLength(n, msg?)', 'At most n characters.'],
      ['rules.email(msg?)', 'Looks like an email address.'],
      ['rules.pattern(re, msg)', 'Matches the regular expression.'],
      ['rules.min(n, msg?)', 'A number of at least n.'],
      ['rules.max(n, msg?)', 'A number of at most n.'],
      ["rules.sameAs('field', msg?)", 'Equals another field, such as a password confirmation.'],
    ])}
    <h3>Your own rules</h3>
    <p>
      A rule is a function ${c('(value, values) => message | null')}: return the message to show, or nothing when
      the value is fine. ${c('values')} holds every field, for rules that compare.
    </p>
    ${code(`const notInPast = (v) => (v && v < new Date().toISOString().slice(0, 10) ? 'Pick today or later' : null);
const endAfterStart = (v, values) => (v && values.start && v < values.start ? 'Ends before it starts' : null);

form({
  initial: { start: '', end: '' },
  validate: { start: [rules.required(), notInPast], end: [rules.required(), endAfterStart] },
});`)}
  </section>

  <section aria-labelledby="when">
    <h2 id="when">When errors show</h2>
    <p>
      Not while someone types into a field for the first time. A field's error shows once it has been left (blur),
      or once a submit was tried; after that it updates as they type, so it goes away the moment it's fixed. A
      checkbox counts as left as soon as it's changed.
    </p>
    <p>
      A submit with errors shows them all, moves focus to the first bad field, and doesn't call ${c('onSubmit')}.
      The error line has ${c('role="alert"')}, so screen readers announce it.
    </p>
  </section>

  <section aria-labelledby="submitting">
    <h2 id="submitting">Submitting</h2>
    <p>
      ${c('f.submitting')} is true while ${c('onSubmit')} runs (await your request in it). Use it to disable the
      button and say what's happening; a second submit meanwhile is ignored anyway.
    </p>
    ${code(`<button class="btn primary" type="submit" ?disabled=\${f.submitting}>
  \${() => (f.submitting.value ? 'Saving…' : 'Save changes')}
</button>`)}
    <p>
      If ${c('onSubmit')} throws, the error goes to ${c('f.submitError')} (a network failure, a 500), unless it's
      about fields (below). Show it near the button, in plain words. What the person typed stays.
    </p>
    ${note(html`Only call ${c('f.reset()')} after a successful save. Clearing the form on an error makes people type
      everything again.`, 'warn')}
  </section>

  <section aria-labelledby="server">
    <h2 id="server">Errors from the server</h2>
    <p>
      Validate on the server too: the browser's checks can be skipped. If ${c('onSubmit')} throws an error whose
      ${c('body.errors')} is ${c('{ field: message }')}, the messages show under those fields and focus moves to the
      first one. A 422 from ${c('fetchJSON')} is exactly that, since its ${c('HttpError')} carries the reply as
      ${c('body')}. Editing a field clears its server error.
    </p>
    ${code(`// api/signup.mjs
export async function POST({ body }) {
  if (await emailTaken(body?.email)) {
    return Response.json({ errors: { email: 'That email is already registered' } }, { status: 422 });
  }
  return { ok: true };
}`, { file: 'api/signup.mjs' })}
    <p>
      If ${c('body.errors')} names no field the form has, the error goes to ${c('submitError')} instead, so it's
      never lost.
    </p>
    <h3>Setting errors yourself</h3>
    <p>
      ${c("f.setErrors({ email: 'Already registered' })")} shows messages on fields from your own code, such as a
      check you ran outside ${c('onSubmit')}. Like the server's, each clears when its field is edited, and all of
      them on the next submit. They show once the field was left or a submit was tried.
    </p>
  </section>

  <section aria-labelledby="values">
    <h2 id="values">Values and reset</h2>
    <p>
      ${c('f.fields.email')} is the field's signal: read it for a live preview, or set it with
      ${c("f.set('email', value)")} (which also clears that field's server error). ${c('f.values()')} gives every
      value as a plain object. ${c('f.valid')} is true when every rule passes, and ${c("f.error('email')")} is the
      error showing on a field right now (use it in a function hole). ${c('f.reset()')} puts back ${c('initial')}
      and hides every error.
    </p>
    ${note(html`Every field name must be in ${c('initial')}. A rule for a field that isn't there never runs
      (${c('W015')}), and a helper for one renders nothing (${c('W016')}). Add it: ${c("initial: { notes: '' }")}.`, 'warn')}
  </section>

  <section aria-labelledby="forms-api">
    <h2 id="forms-api">API</h2>
    ${api([
      ['form({ initial, validate?, onSubmit? })', 'Create a form. validate: { field: rule | rule[] }. onSubmit(values) may be async.'],
      ['f.submit', html`The submit handler: ${c('<form novalidate @submit=${f.submit}>')}.`],
      ['f.input / textarea / select / checkbox', 'Field helpers: label, control, hint and error, wired for accessibility.'],
      ['f.fields.name', 'Each field\'s value as a signal.'],
      ['f.set(name, value)', 'Set a value and clear that field\'s server error.'],
      ['f.values()', 'Every value as a plain object.'],
      ['f.error(name)', 'The error showing on a field now, or null.'],
      ['f.valid', 'Signal: true when every rule passes.'],
      ['f.submitting', 'Signal: true while onSubmit runs.'],
      ['f.submitError', 'Signal: an error from onSubmit not about a field, or null.'],
      ['f.setErrors({ field: msg })', 'Show errors on fields yourself.'],
      ['f.reset()', 'Back to initial values, with no errors showing.'],
    ])}
  </section>
`;
