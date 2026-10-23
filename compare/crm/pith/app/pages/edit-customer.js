import { html, resource, fetchJSON } from 'pith';
import { customerForm } from './customer-form.js';

export default function EditCustomerPage({ id }) {
  const customer = resource(({ signal }) => fetchJSON(`/api/customers/${id}`, { signal }));

  return html`
    <section class="section narrow">
      ${customer.render((c) => html`
        <h1>Edit ${c.name}</h1>
        ${customerForm(c)}
      `)}
    </section>
  `;
}
