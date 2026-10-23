import { html, signal, form, rules, fetchJSON } from 'pith';

// form() handles values, validation, accessible errors, submitting and the server's own errors.
// Try: submit empty, then an address ending in @blocked.test (the server rejects it, shown under Email).
export default function FormsExample() {
  const sent = signal('');
  const f = form({
    initial: { name: '', email: '', message: '' },
    validate: {
      name: rules.required(),
      email: [rules.required(), rules.email()],
      message: [rules.required(), rules.minLength(10)],
    },
    onSubmit: async (values) => {
      await fetchJSON('/api/contact', { json: values });
      sent.value = `Thanks, ${values.name}!`;
      f.reset();
    },
  });

  return html`
    <form class="form" novalidate @submit=${f.submit}>
      ${f.input('name', { label: 'Name', autocomplete: 'name' })}
      ${f.input('email', { label: 'Email', type: 'email', autocomplete: 'email' })}
      ${f.textarea('message', { label: 'Message', hint: () => `${f.fields.message.value.length} characters (10 or more)` })}
      ${() => (f.submitError.value ? html`<p class="form-error" role="alert">${f.submitError.value.message}</p>` : null)}
      <button class="btn primary" type="submit" ?disabled=${f.submitting}>Send</button>
      <p class="muted" aria-live="polite">${sent}</p>
    </form>
  `;
}
