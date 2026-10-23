import { createRouter, html } from 'pith';

export const router = createRouter(
  {
    '/': { title: 'Dashboard', load: () => import('./pages/dashboard.js') },
    '/customers': { title: 'Customers', load: () => import('./pages/customers.js') },
    '/customers/new': { title: 'New customer', load: () => import('./pages/new-customer.js') },
    '/customers/:id': { title: 'Customer', load: () => import('./pages/customer.js') },
    '/customers/:id/edit': { title: 'Edit customer', load: () => import('./pages/edit-customer.js') },
    '*': { title: 'Not found', load: () => import('./pages/not-found.js') },
  },
  {
    title: (t) => `${t} · CRM`,
    focus: '#main',
    loading: () => html`<p class="loading" role="status">Loading…</p>`,
  }
);
