import { createRouter, createWebHistory } from 'vue-router';

// Each page's code is downloaded on first visit (route-level code splitting).
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./pages/Dashboard.vue'), meta: { title: 'Dashboard' } },
    { path: '/customers', component: () => import('./pages/Customers.vue'), meta: { title: 'Customers' } },
    { path: '/customers/new', component: () => import('./pages/NewCustomer.vue'), meta: { title: 'New customer' } },
    { path: '/customers/:id', component: () => import('./pages/Customer.vue'), meta: { title: 'Customer' } },
    { path: '/customers/:id/edit', component: () => import('./pages/EditCustomer.vue'), meta: { title: 'Edit customer' } },
    { path: '/:pathMatch(.*)*', component: () => import('./pages/NotFound.vue'), meta: { title: 'Not found' } },
  ],
});

router.afterEach((to) => {
  document.title = `${to.meta.title} · CRM`;
});
