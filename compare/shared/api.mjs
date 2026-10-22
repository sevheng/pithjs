// The CRM API, shared by every implementation so they all talk to the exact same backend.
// In memory; POST /api/__reset restores the seed data (used between test flows).

const LATENCY_MS = 100;
const STATUSES = ['active', 'lead', 'churned'];

const FIRST = ['Ada', 'Grace', 'Alan', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Tim', 'Frances', 'John'];
const LAST = ['Lovelace', 'Hopper', 'Turing', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Perlman', 'Berners-Lee'];
const COMPANIES = ['Analytical Engines', 'Cobol Co', 'Enigma Labs', 'Kernel Works', 'Apollo Systems', 'Unix Union', 'Clu Corp', 'Spanning Tree Ltd'];

function seed() {
  const people = [];
  for (let i = 0; i < 24; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    people.push({
      id: String(i + 1),
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase().replace(/[^a-z0-9.@]/g, ''),
      company: COMPANIES[(i * 3) % COMPANIES.length],
      phone: i % 3 === 0 ? '' : `+1 555 01${String(i).padStart(2, '0')}`,
      status: STATUSES[i % 3],
      revenue: ((i * 7919) % 50) * 1000,
      notes: i % 4 === 0 ? 'Prefers email. Renewal due next quarter.' : '',
    });
  }
  return people;
}

let customers = seed();
let nextId = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = ({ id, name, email, company, status, revenue }) => ({ id, name, email, company, status, revenue });

function validate(input, currentId) {
  const errors = {};
  const name = String(input?.name ?? '').trim();
  const email = String(input?.email ?? '').trim();
  if (!name) errors.name = 'This field is required';
  else if (name.length < 2) errors.name = 'Use at least 2 characters';
  if (!email) errors.email = 'This field is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
  else if (customers.some((c) => c.email.toLowerCase() === email.toLowerCase() && c.id !== currentId)) {
    errors.email = 'A customer with this email already exists';
  }
  if (!STATUSES.includes(input?.status)) errors.status = 'Choose a status';
  return Object.keys(errors).length ? errors : null;
}

const clean = (input) => ({
  name: String(input.name).trim(),
  email: String(input.email).trim(),
  company: String(input.company ?? '').trim(),
  phone: String(input.phone ?? '').trim(),
  status: input.status,
  notes: String(input.notes ?? '').trim(),
});

const reply = (status, json) => ({ status, json });

/**
 * Handle one API request.
 * @param {string} method
 * @param {URL} url
 * @param {any} body parsed JSON body or null
 * @returns {Promise<{ status: number, json?: unknown }>}
 */
export async function handleApi(method, url, body) {
  const path = url.pathname.replace(/\/+$/, '');
  if (method === 'POST' && path === '/api/__reset') {
    customers = seed();
    nextId = 100;
    return reply(204);
  }
  await sleep(LATENCY_MS);

  if (path === '/api/stats' && method === 'GET') {
    return reply(200, {
      total: customers.length,
      active: customers.filter((c) => c.status === 'active').length,
      leads: customers.filter((c) => c.status === 'lead').length,
      churned: customers.filter((c) => c.status === 'churned').length,
      revenue: customers.reduce((sum, c) => sum + c.revenue, 0),
    });
  }

  if (path === '/api/customers') {
    if (method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const status = url.searchParams.get('status') ?? 'all';
      const list = customers
        .filter((c) => status === 'all' || c.status === status)
        .filter((c) => !q || `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(summary);
      return reply(200, list);
    }
    if (method === 'POST') {
      const errors = validate(body);
      if (errors) return reply(422, { message: 'Please fix the highlighted fields', errors });
      const customer = { id: String(nextId++), revenue: 0, ...clean(body) };
      customers.push(customer);
      return reply(201, customer);
    }
  }

  const match = path.match(/^\/api\/customers\/([^/]+)$/);
  if (match) {
    const customer = customers.find((c) => c.id === match[1]);
    if (!customer) return reply(404, { message: 'Customer not found' });
    if (method === 'GET') return reply(200, customer);
    if (method === 'PUT') {
      const errors = validate(body, customer.id);
      if (errors) return reply(422, { message: 'Please fix the highlighted fields', errors });
      Object.assign(customer, clean(body));
      return reply(200, customer);
    }
    if (method === 'DELETE') {
      customers = customers.filter((c) => c !== customer);
      return reply(204);
    }
  }
  return reply(404, { message: `No API at ${method} ${url.pathname}` });
}
