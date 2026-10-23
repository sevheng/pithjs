// Hidden acceptance flows for the "sortable table" task (not shown to the AI agents).
import { flow } from 'pith/testing';

const api = async (path, init) => {
  const res = await fetch(path, init);
  return res.status === 204 ? null : res.json();
};
const reset = () => api('/api/__reset', { method: 'POST' });
const names = (app) => app.queryAll('.table tbody tr td:first-child').map((td) => td.textContent.trim());
const sortOf = (app, label) =>
  app.queryAll('.table thead th').find((th) => th.textContent.trim() === label)?.getAttribute('aria-sort') ?? null;
const byName = (a, b) => a.name.localeCompare(b.name);

flow('sort: default is Name ascending, marked with aria-sort', async (app) => {
  await reset();
  const all = await api('/api/customers');
  await app.go('/customers');
  await app.see(`${all.length} customers`);
  app.expect(sortOf(app, 'Name') === 'ascending', `Name header should have aria-sort="ascending", got ${sortOf(app, 'Name')}`);
  app.expect(sortOf(app, 'Revenue') === null, 'Revenue header should have no aria-sort');
  app.expect(names(app).join('|') === all.map((c) => c.name).join('|'), 'rows should be in name order');
  app.expect(app.queryAll('.table thead th button').map((b) => b.textContent.trim()).join(',') === 'Name,Revenue',
    'Name and Revenue headers should each contain a button');
});

flow('sort: clicking Name toggles to descending', async (app) => {
  await reset();
  const all = await api('/api/customers');
  await app.go('/customers');
  await app.see(all[0].name);
  await app.click('Name');
  await app.waitFor(() => sortOf(app, 'Name') === 'descending', 'Name should become descending');
  app.expect(names(app).join('|') === all.map((c) => c.name).reverse().join('|'), 'rows should be in reverse name order');
  await app.click('Name');
  await app.waitFor(() => sortOf(app, 'Name') === 'ascending', 'a second click should go back to ascending');
});

flow('sort: Revenue sorts numerically, ties by name, and toggles', async (app) => {
  await reset();
  const all = await api('/api/customers');
  const asc = [...all].sort((a, b) => a.revenue - b.revenue || byName(a, b)).map((c) => c.name);
  const desc = [...all].sort((a, b) => b.revenue - a.revenue || byName(a, b)).map((c) => c.name);
  await app.go('/customers');
  await app.see(all[0].name);
  await app.click('Revenue');
  await app.waitFor(() => sortOf(app, 'Revenue') === 'ascending', 'Revenue should become ascending');
  app.expect(sortOf(app, 'Name') === null, 'Name should lose aria-sort');
  app.expect(names(app).join('|') === asc.join('|'), `rows should be by revenue ascending.\nexpected ${asc.join(', ')}\ngot      ${names(app).join(', ')}`);
  await app.click('Revenue');
  await app.waitFor(() => sortOf(app, 'Revenue') === 'descending', 'Revenue should become descending');
  app.expect(names(app).join('|') === desc.join('|'), `rows should be by revenue descending (ties by name).\nexpected ${desc.join(', ')}\ngot      ${names(app).join(', ')}`);
});

flow('sort: stays active while searching and filtering', async (app) => {
  await reset();
  const all = await api('/api/customers');
  await app.go('/customers');
  await app.see(all[0].name);
  await app.click('Revenue');
  await app.click('Revenue');
  const active = await api('/api/customers?status=active');
  const expected = [...active].sort((a, b) => b.revenue - a.revenue || byName(a, b)).map((c) => c.name);
  await app.select('Status', 'Active');
  await app.see(`${active.length} customers`);
  app.expect(sortOf(app, 'Revenue') === 'descending', 'the sort should stay Revenue descending');
  app.expect(names(app).join('|') === expected.join('|'), 'filtered rows should stay sorted by revenue descending');
});
