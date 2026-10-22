import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import Layout from './Layout.jsx';
import { Loading } from './lib/status.jsx';

// Each page's code is downloaded on first visit (route-level code splitting).
const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    hydrateFallbackElement: <Loading />,
    children: [
      { index: true, handle: { title: 'Dashboard' }, lazy: () => import('./pages/Dashboard.jsx') },
      { path: 'customers', handle: { title: 'Customers' }, lazy: () => import('./pages/Customers.jsx') },
      { path: 'customers/new', handle: { title: 'New customer' }, lazy: () => import('./pages/NewCustomer.jsx') },
      { path: 'customers/:id', handle: { title: 'Customer' }, lazy: () => import('./pages/Customer.jsx') },
      { path: 'customers/:id/edit', handle: { title: 'Edit customer' }, lazy: () => import('./pages/EditCustomer.jsx') },
      { path: '*', handle: { title: 'Not found' }, lazy: () => import('./pages/NotFound.jsx') },
    ],
  },
]);

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
