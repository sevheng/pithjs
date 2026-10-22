import { useParams } from 'react-router';
import { useFetch } from '../lib/api.js';
import { Loading, LoadError } from '../lib/status.jsx';
import CustomerForm from './CustomerForm.jsx';

export function Component() {
  const { id } = useParams();
  const { data: c, error, refetch } = useFetch(`/api/customers/${id}`);

  return (
    <section className="section narrow">
      {error ? (
        <LoadError error={error} retry={refetch} />
      ) : !c ? (
        <Loading />
      ) : (
        <>
          <h1>Edit {c.name}</h1>
          <CustomerForm key={c.id} customer={c} />
        </>
      )}
    </section>
  );
}
