import { html, resource, fetchJSON } from 'pith';
import { money } from '../format.js';

export default function DashboardPage() {
  const stats = resource(({ signal }) => fetchJSON('/api/stats', { signal }));

  return html`
    <section class="section">
      <h1>Dashboard</h1>
      ${stats.render((s) => html`
        <div class="grid stats">
          ${[['Customers', s.total], ['Active', s.active], ['Leads', s.leads], ['Revenue', money(s.revenue)]].map(([label, value]) => html`
            <div class="card stat">
              <span class="stat-value">${value}</span>
              <span class="stat-label">${label}</span>
            </div>
          `)}
        </div>
      `)}
    </section>
  `;
}
