// Hidden acceptance flows for the search bug (never shown to the agents).
import { flow } from 'pith/testing';

const api = async (path, init) => {
  const res = await fetch(path, init);
  return res.status === 204 ? null : res.json();
};
const reset = () => api('/api/__reset', { method: 'POST' });
const count = (n) => `${n} customer${n === 1 ? '' : 's'}`;

flow('hidden: clearing the search box shows every customer again', async (app) => {
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

flow('hidden: a one-letter search filters too (every change refetches)', async (app) => {
  await reset();
  const all = await api('/api/customers');
  const z = await api('/api/customers?q=z');
  await app.go('/customers');
  await app.see(count(all.length));
  await app.type('Search customers', 'z');
  await app.see(z.length ? count(z.length) : 'No customers match.');
});

flow('hidden: search and status combine, and clearing the search keeps the status', async (app) => {
  await reset();
  const all = await api('/api/customers');
  const both = await api('/api/customers?q=ada&status=active');
  const active = await api('/api/customers?status=active');
  await app.go('/customers');
  await app.see(count(all.length));
  await app.select('Status', 'Active');
  await app.see(count(active.length));
  await app.type('Search customers', 'ada');
  await app.see(both.length ? count(both.length) : 'No customers match.');
  await app.type('Search customers', '');
  await app.see(count(active.length));
});
