import { html, signal, form, rules, fetchJSON } from 'mini';

export default function ContactPage() {
  const sentBy = signal('');

  const contact = form({
    initial: { name: '', email: '', topic: 'question', message: '', agree: false },
    validate: {
      name: [rules.required(), rules.minLength(2)],
      email: [rules.required(), rules.email()],
      message: [rules.required(), rules.minLength(10)],
      agree: rules.required('Please agree so we can reply'),
    },
    // A 422 reply with { errors: { field: message } } shows under the matching fields automatically.
    onSubmit: async (values) => {
      await fetchJSON('/api/contact', { json: values });
      sentBy.value = values.name;
    },
  });

  const sendAnother = () => {
    contact.reset();
    sentBy.value = '';
  };

  return html`
    <section class="section narrow">
      <h1>Contact</h1>
      <p class="muted">Checked in the browser as you go, and again on the server when you send.</p>

      <form class="card form" novalidate @submit=${contact.submit} ?hidden=${sentBy}>
        ${contact.input('name', { label: 'Your name', autocomplete: 'name' })}
        ${contact.input('email', { label: 'Email', type: 'email', autocomplete: 'email', hint: 'Only used to reply to you.' })}
        ${contact.select('topic', { label: 'Topic', options: [['question', 'A question'], ['feedback', 'Feedback'], ['bug', 'A bug report']] })}
        ${contact.textarea('message', { label: 'Message', rows: 5 })}
        ${contact.checkbox('agree', { label: 'I agree to be contacted by email' })}
        ${() => contact.submitError.value
          ? html`<p class="form-error" role="alert">Couldn't send: ${contact.submitError.value.message}</p>`
          : null}
        <button class="btn primary" type="submit" ?disabled=${contact.submitting}>
          ${() => (contact.submitting.value ? 'Sending…' : 'Send message')}
        </button>
      </form>

      <div class="card form-success" role="status" ?hidden=${() => !sentBy.value}>
        <h2>Thanks, ${sentBy}!</h2>
        <p>We got your message and will reply soon.</p>
        <button class="btn" type="button" @click=${sendAnother}>Send another</button>
      </div>
    </section>
  `;
}
