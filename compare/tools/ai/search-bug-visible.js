// Reproduces the bug report: after searching, clearing the search box should show every customer again.
import { flow } from 'pith/testing';

const api = async (path, init) => {
  const res = await fetch(path, init);
  return res.status === 204 ? null : res.json();
};
const reset = () => api('/api/__reset', { method: 'POST' });
const count = (n) => `${n} customer${n === 1 ? '' : 's'}`;

flow('search: clearing the search box shows every customer again', async (app) => {
  await reset();
  const all = await api('/api/customers');
  const some = await api('/api/customers?q=ada');
  await app.go('/customers');
  await app.see(count(all.length));
  await app.type('Search customers', 'ada');
  await app.see(count(some.length));
  await app.type('Search customers', '');
  await app.see(count(all.length));
});
