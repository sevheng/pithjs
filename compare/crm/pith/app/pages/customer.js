import { html, signal, resource, fetchJSON } from 'pith';
import { router } from '../router.js';
import { money, STATUS_LABELS } from '../format.js';

export default function CustomerPage({ id }) {
  const customer = resource(({ signal }) => fetchJSON(`/api/customers/${id}`, { signal }));
  const confirming = signal(false);

  const remove = async () => {
    if (!confirming.value) {
      confirming.value = true;
      return;
    }
    await fetchJSON(`/api/customers/${id}`, { method: 'DELETE' });
    router.navigate('/customers');
  };

  const details = (c) => [
    ['Email', c.email],
    ['Company', c.company],
    ['Phone', c.phone],
    ['Status', STATUS_LABELS[c.status]],
    ['Revenue', money(c.revenue)],
    ['Notes', c.notes],
  ];

  return html`
    <section class="section narrow">
      ${customer.render({
        ready: (c) => html`
          <h1>${c.name}</h1>
          <dl class="card details">
            ${details(c).map(([label, value]) => html`<dt>${label}</dt><dd>${value || '—'}</dd>`)}
          </dl>
          <div class="row">
            <a class="btn" href=${`/customers/${c.id}/edit`}>Edit</a>
            <button class="btn danger" type="button" @click=${remove}>
              ${() => (confirming.value ? 'Confirm delete' : 'Delete')}
            </button>
            ${() => (confirming.value
              ? html`<button class="btn ghost" type="button" @click=${() => (confirming.value = false)}>Cancel</button>`
              : null)}
          </div>
        `,
        error: (err, retry) => err?.status === 404
          ? html`<h1>Customer not found</h1><a href="/customers">Back to customers</a>`
          : html`
            <div class="load-error" role="alert">
              <p>Couldn't load this. ${err.message}</p>
              <button class="btn" type="button" @click=${retry}>Try again</button>
            </div>
          `,
      })}
    </section>
  `;
}
