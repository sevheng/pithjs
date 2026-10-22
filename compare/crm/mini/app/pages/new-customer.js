import { html } from 'mini';
import { customerForm } from './customer-form.js';

export default function NewCustomerPage() {
  return html`
    <section class="section narrow">
      <h1>New customer</h1>
      ${customerForm()}
    </section>
  `;
}
