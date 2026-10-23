import { html, form, rules, fetchJSON } from 'pith';
import { router } from '../router.js';

const EMPTY = { name: '', email: '', company: '', phone: '', status: 'lead', notes: '' };

/** The create/edit form. Pass the customer to edit, or nothing to create one. */
export function customerForm(customer) {
  const f = form({
    initial: customer
      ? { name: customer.name, email: customer.email, company: customer.company, phone: customer.phone, status: customer.status, notes: customer.notes }
      : EMPTY,
    validate: {
      name: [rules.required(), rules.minLength(2)],
      email: [rules.required(), rules.email()],
    },
    // A 422 { errors } reply shows under the matching fields automatically.
    onSubmit: async (values) => {
      const saved = await fetchJSON(customer ? `/api/customers/${customer.id}` : '/api/customers', {
        method: customer ? 'PUT' : 'POST',
        json: values,
      });
      router.navigate(`/customers/${saved.id}`);
    },
  });

  return html`
    <form class="card form" novalidate @submit=${f.submit}>
      ${f.input('name', { label: 'Name', autocomplete: 'name' })}
      ${f.input('email', { label: 'Email', type: 'email', autocomplete: 'email' })}
      ${f.input('company', { label: 'Company' })}
      ${f.input('phone', { label: 'Phone', type: 'tel' })}
      ${f.select('status', { label: 'Status', options: [['lead', 'Lead'], ['active', 'Active'], ['churned', 'Churned']] })}
      ${f.textarea('notes', { label: 'Notes', rows: 4 })}
      ${() => (f.submitError.value
        ? html`<p class="form-error" role="alert">Couldn't save. ${f.submitError.value.message}</p>`
        : null)}
      <div class="row">
        <button class="btn primary" type="submit" ?disabled=${f.submitting}>
          ${() => (f.submitting.value ? 'Saving…' : 'Save')}
        </button>
        <a class="btn ghost" href=${customer ? `/customers/${customer.id}` : '/customers'}>Cancel</a>
      </div>
    </form>
  `;
}
