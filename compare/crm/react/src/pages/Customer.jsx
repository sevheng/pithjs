import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchJSON, useFetch } from '../lib/api.js';
import { money, STATUS_LABELS } from '../lib/format.js';
import { Loading, LoadError } from '../lib/status.jsx';

export function Component() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: c, error, refetch } = useFetch(`/api/customers/${id}`);
  const [confirming, setConfirming] = useState(false);

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await fetchJSON(`/api/customers/${id}`, { method: 'DELETE' });
    navigate('/customers');
  };

  if (error?.status === 404) {
    return (
      <section className="section narrow">
        <h1>Customer not found</h1>
        <Link to="/customers">Back to customers</Link>
      </section>
    );
  }

  return (
    <section className="section narrow">
      {error ? (
        <LoadError error={error} retry={refetch} />
      ) : !c ? (
        <Loading />
      ) : (
        <>
          <h1>{c.name}</h1>
          <dl className="card details">
            {[
              ['Email', c.email],
              ['Company', c.company],
              ['Phone', c.phone],
              ['Status', STATUS_LABELS[c.status]],
              ['Revenue', money(c.revenue)],
              ['Notes', c.notes],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="row">
            <Link className="btn" to={`/customers/${c.id}/edit`}>Edit</Link>
            <button className="btn danger" type="button" onClick={remove}>
              {confirming ? 'Confirm delete' : 'Delete'}
            </button>
            {confirming && <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>Cancel</button>}
          </div>
        </>
      )}
    </section>
  );
}
