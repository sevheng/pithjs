import { useFetch } from '../lib/api.js';
import { money } from '../lib/format.js';
import { Loading, LoadError } from '../lib/status.jsx';

export function Component() {
  const { data: s, error, refetch } = useFetch('/api/stats');

  return (
    <section className="section">
      <h1>Dashboard</h1>
      {error ? (
        <LoadError error={error} retry={refetch} />
      ) : !s ? (
        <Loading />
      ) : (
        <div className="grid stats">
          {[['Customers', s.total], ['Active', s.active], ['Leads', s.leads], ['Revenue', money(s.revenue)]].map(([label, value]) => (
            <div key={label} className="card stat">
              <span className="stat-value">{value}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
