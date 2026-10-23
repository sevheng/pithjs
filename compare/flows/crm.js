// User flows for spec/crm.md. The same file tests every implementation.
// Each flow resets the API's data first, and reads expected values from the API itself.
import { flow } from 'pith/testing';

const api = async (path, init) => {
  const res = await fetch(path, init);
  return res.status === 204 ? null : res.json();
};
const reset = () => api('/api/__reset', { method: 'POST' });
const money = (n) => `$${n.toLocaleString('en-US')}`;

flow('dashboard shows the stats', async (app) => {
  await reset();
  const stats = await api('/api/stats');
  await app.go('/');
  await app.see('Dashboard');
  await app.see(money(stats.revenue));
  const values = app.queryAll('.stat-value').map((el) => el.textContent.trim());
  app.expect(values.join('|') === [stats.total, stats.active, stats.leads, money(stats.revenue)].join('|'),
    `stat values should be ${stats.total}, ${stats.active}, ${stats.leads}, ${money(stats.revenue)}; got ${values.join(', ')}`);
  app.expect(app.document.title === 'Dashboard · CRM', `title should be "Dashboard · CRM", got "${app.document.title}"`);
  app.expect(app.query('nav [aria-current="page"]')?.textContent.trim() === 'Dashboard', 'Dashboard should be the current nav link');
});

flow('customer list: all customers, sorted, with a count', async (app) => {
  await reset();
  const all = await api('/api/customers');
  await app.go('/customers');
  await app.see(all[0].name);
  await app.see(`${all.length} customers`);
  const names = app.queryAll('.table tbody tr td:first-child').map((td) => td.textContent.trim());
  app.expect(names.join('|') === all.map((c) => c.name).join('|'), 'the table should list every customer in name order');
  app.expect(app.document.title === 'Customers · CRM', `title should be "Customers · CRM", got "${app.document.title}"`);
});

flow('customer list: search and status filter run on the server', async (app) => {
  await reset();
  const all = await api('/api/customers');
  const target = all[5];
  await app.go('/customers');
  await app.see(all[0].name);
  await app.type('Search customers', target.email);
  await app.see('1 customer');
  await app.see(target.name);

  await app.type('Search customers', '');
  const churned = await api('/api/customers?status=churned');
  await app.select('Status', 'Churned');
  await app.see(`${churned.length} customers`);
  app.expect(app.queryAll('.badge').every((b) => b.textContent.trim() === 'Churned'), 'only churned customers should show');

  await app.type('Search customers', 'zzzz-no-match');
  await app.see('No customers match.');
});

flow('customer detail: open from the list, then back', async (app) => {
  await reset();
  const all = await api('/api/customers');
  const c = await api(`/api/customers/${all[2].id}`);
  await app.go('/customers');
  await app.click(c.name);
  await app.expectPath(`/customers/${c.id}`);
  await app.see(c.email);
  await app.see(c.company);
  app.expect(app.query('h1')?.textContent.trim() === c.name, 'the heading should be the customer name');
  app.expect(app.document.title === 'Customer · CRM', `title should be "Customer · CRM", got "${app.document.title}"`);
  app.expect(app.query('nav [aria-current="page"]')?.textContent.trim() === 'Customers', 'Customers should be the current nav link');
  await app.back();
  await app.expectPath('/customers');
  await app.see(`${all.length} customers`);
});

flow('customer detail: unknown id shows "Customer not found"', async (app) => {
  await reset();
  await app.go('/customers/does-not-exist');
  await app.see('Customer not found');
  await app.click('Back to customers');
  await app.expectPath('/customers');
});

flow('new customer: empty submit shows errors and focuses Name', async (app) => {
  await reset();
  await app.go('/customers/new');
  await app.see('New customer');
  app.expect(app.query('nav [aria-current="page"]')?.textContent.trim() === 'New customer', 'New customer should be the current nav link');
  await app.click('Save');
  await app.see('This field is required');
  app.expect(app.document.activeElement === app.query('input[name="name"]'), 'focus should move to the Name field');
  app.expect(app.query('input[name="name"]')?.getAttribute('aria-invalid') === 'true', 'Name should be aria-invalid');
  await app.type('Name', 'A');
  await app.see('Use at least 2 characters');
  await app.type('Email', 'not-an-email');
  await app.see('Enter a valid email address');
});

flow('new customer: saving creates it and opens its page', async (app) => {
  await reset();
  await app.go('/customers/new');
  await app.type('Name', 'Katherine Johnson');
  await app.type('Email', 'katherine@nasa.test');
  await app.type('Company', 'NASA');
  await app.type('Phone', '+1 555 0199');
  await app.select('Status', 'Active');
  await app.type('Notes', 'Orbital mechanics.');
  await app.click('Save');
  await app.expectPath('/customers/100');
  await app.see('katherine@nasa.test');
  app.expect(app.query('h1')?.textContent.trim() === 'Katherine Johnson', 'the new customer page should open');
  await app.see('Orbital mechanics.');
});

flow('new customer: duplicate email error from the server shows under Email', async (app) => {
  await reset();
  const [first] = await api('/api/customers');
  await app.go('/customers/new');
  await app.type('Name', 'Someone New');
  await app.type('Email', first.email);
  await app.click('Save');
  await app.see('A customer with this email already exists');
  app.expect(app.document.activeElement === app.query('input[name="email"]'), 'focus should move to the Email field');
  await app.type('Email', 'someone@new.test');
  await app.notSee('A customer with this email already exists');
});

flow('edit customer: the form is prefilled and saves changes', async (app) => {
  await reset();
  const c = await api('/api/customers/1');
  await app.go('/customers/1');
  await app.click('Edit');
  await app.expectPath('/customers/1/edit');
  await app.see(`Edit ${c.name}`);
  app.expect(app.query('input[name="email"]')?.value === c.email, 'Email should be prefilled');
  await app.type('Name', 'Renamed Person');
  await app.click('Save');
  await app.expectPath('/customers/1');
  await app.waitFor(() => app.query('h1')?.textContent.trim() === 'Renamed Person', 'the detail page should show the new name');
});

flow('delete customer: confirm step, cancel, then delete', async (app) => {
  await reset();
  const c = await api('/api/customers/2');
  await app.go('/customers/2');
  await app.see(c.email);
  await app.click('Delete');
  await app.see('Confirm delete');
  await app.click('Cancel');
  await app.notSee('Confirm delete');
  await app.click('Delete');
  await app.click('Confirm delete');
  await app.expectPath('/customers');
  await app.see('23 customers');
  await app.notSee(c.name);
});

flow('unknown URL shows not found, with a way back', async (app) => {
  await reset();
  await app.go('/no-such-page');
  await app.see('Page not found');
  app.expect(app.document.title === 'Not found · CRM', `title should be "Not found · CRM", got "${app.document.title}"`);
  await app.click('Go to dashboard');
  await app.expectPath('/');
  await app.see('Revenue');
});
