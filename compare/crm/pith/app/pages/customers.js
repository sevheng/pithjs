import { html, signal, resource, fetchJSON } from 'pith';
import { money, STATUS_LABELS } from '../format.js';

const STATUS_OPTIONS = [['all', 'All statuses'], ['active', 'Active'], ['lead', 'Lead'], ['churned', 'Churned']];

export default function CustomersPage() {
  const q = signal('');
  const status = signal('all');
  // Re-runs when q or status changes; the previous request is cancelled.
  const customers = resource(({ signal }) =>
    fetchJSON(`/api/customers?${new URLSearchParams({ q: q.value, status: status.value })}`, { signal })
  );

  return html`
    <section class="section">
      <h1>Customers</h1>
      <div class="toolbar">
        <label class="sr-only" for="search">Search customers</label>
        <input id="search" class="input" type="search" placeholder="Search by name, email or company"
               .value=${q} @input=${(e) => (q.value = e.target.value)}>
        <label class="sr-only" for="status">Status</label>
        <select id="status" class="input" @change=${(e) => (status.value = e.target.value)}>
          ${STATUS_OPTIONS.map(([value, label]) => html`<option value=${value}>${label}</option>`)}
        </select>
        <a class="btn primary" href="/customers/new">New customer</a>
      </div>

      ${customers.render((rows) => rows.length === 0
        ? html`<p class="empty">No customers match.</p>`
        : html`
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Name</th><th>Company</th><th>Status</th><th>Revenue</th></tr></thead>
              <tbody>
                ${rows.map((c) => html`
                  <tr>
                    <td><a href=${`/customers/${c.id}`}>${c.name}</a></td>
                    <td>${c.company}</td>
                    <td><span class=${`badge badge-${c.status}`}>${STATUS_LABELS[c.status]}</span></td>
                    <td>${money(c.revenue)}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
          <p class="muted">${rows.length} customer${rows.length === 1 ? '' : 's'}</p>
        `)}
    </section>
  `;
}
