import { useState } from 'react';
import { Link } from 'react-router';
import { useFetch } from '../lib/api.js';
import { money, STATUS_LABELS } from '../lib/format.js';
import { Loading, LoadError } from '../lib/status.jsx';

const STATUS_OPTIONS = [['all', 'All statuses'], ['active', 'Active'], ['lead', 'Lead'], ['churned', 'Churned']];

export function Component() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const { data: rows, error, refetch } = useFetch(`/api/customers?${new URLSearchParams({ q, status })}`);

  return (
    <section className="section">
      <h1>Customers</h1>
      <div className="toolbar">
        <label className="sr-only" htmlFor="search">Search customers</label>
        <input id="search" className="input" type="search" placeholder="Search by name, email or company"
               value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Link className="btn primary" to="/customers/new">New customer</Link>
      </div>

      {error ? (
        <LoadError error={error} retry={refetch} />
      ) : !rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="empty">No customers match.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Company</th><th>Status</th><th>Revenue</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
                    <td>{c.company}</td>
                    <td><span className={`badge badge-${c.status}`}>{STATUS_LABELS[c.status]}</span></td>
                    <td>{money(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">{rows.length} customer{rows.length === 1 ? '' : 's'}</p>
        </>
      )}
    </section>
  );
}
