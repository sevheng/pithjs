// Hidden acceptance flows for the "phone validation + notes counter" task (not shown to the AI agents).
import { flow } from 'mini/testing';

const api = async (path, init) => {
  const res = await fetch(path, init);
  return res.status === 204 ? null : res.json();
};
const reset = () => api('/api/__reset', { method: 'POST' });
const counterOf = (app) => {
  const notes = app.query('textarea[name="notes"]');
  const ids = (notes?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  return ids.map((id) => app.document.getElementById(id)?.textContent.trim()).find((t) => /^\d+\/200$/.test(t ?? '')) ?? null;
};

flow('phone: letters are rejected after leaving the field', async (app) => {
  await reset();
  await app.go('/customers/new');
  await app.type('Phone', 'call me');
  await app.notSee('Enter a valid phone number'); // not while typing
  await app.type('Notes', 'x'); // leaving Phone
  await app.see('Enter a valid phone number');
  app.expect(app.query('input[name="phone"]').getAttribute('aria-invalid') === 'true', 'Phone should be aria-invalid');
});

flow('phone: valid formats pass, too few digits fail, empty is fine', async (app) => {
  await reset();
  await app.go('/customers/new');
  await app.type('Phone', '+1 (555) 010-2030');
  await app.type('Notes', 'x');
  await app.notSee('Enter a valid phone number');
  await app.type('Phone', '12 34 5');
  await app.type('Notes', 'y');
  await app.see('Enter a valid phone number');
  await app.type('Phone', '');
  await app.notSee('Enter a valid phone number');
});

flow('phone: an invalid phone blocks saving and gets focus', async (app) => {
  await reset();
  await app.go('/customers/new');
  await app.type('Name', 'Valid Name');
  await app.type('Email', 'valid@mail.test');
  await app.type('Phone', 'abc');
  await app.click('Save');
  await app.see('Enter a valid phone number');
  await app.expectPath('/customers/new');
  app.expect(app.document.activeElement === app.query('input[name="phone"]'), 'focus should move to Phone');
  await app.type('Phone', '555 0100 22');
  await app.click('Save');
  await app.waitFor(() => /^\/customers\/\d+$/.test(app.window.location.pathname), 'a valid phone should save');
});

flow('notes: live counter linked to the textarea', async (app) => {
  await reset();
  await app.go('/customers/new');
  await app.waitFor(() => counterOf(app) === '0/200', `the Notes textarea should be described by a "0/200" counter, got ${counterOf(app)}`);
  await app.type('Notes', 'hello');
  await app.waitFor(() => counterOf(app) === '5/200', `the counter should show 5/200, got ${counterOf(app)}`);
});

flow('notes: over 200 characters is an error and blocks saving', async (app) => {
  await reset();
  await app.go('/customers/new');
  await app.type('Name', 'Valid Name');
  await app.type('Email', 'valid@mail.test');
  await app.type('Notes', 'a'.repeat(201));
  await app.waitFor(() => counterOf(app) === '201/200', `the counter should show 201/200, got ${counterOf(app)}`);
  await app.click('Save');
  await app.see('Use at most 200 characters');
  await app.expectPath('/customers/new');
  await app.type('Notes', 'a'.repeat(200));
  await app.notSee('Use at most 200 characters');
});

flow('notes: the edit form counts the existing notes', async (app) => {
  await reset();
  const c = await api('/api/customers/1');
  await app.go('/customers/1/edit');
  await app.see(`Edit ${c.name}`);
  await app.waitFor(() => counterOf(app) === `${c.notes.length}/200`, `the counter should show ${c.notes.length}/200, got ${counterOf(app)}`);
});
