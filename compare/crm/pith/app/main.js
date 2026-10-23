import { html, root } from 'pith';
import { router } from './router.js';

const links = [
  ['/', 'Dashboard'],
  ['/customers', 'Customers'],
  ['/customers/new', 'New customer'],
];

// Which nav link is current for a path.
const section = (path) =>
  path === '/customers/new' ? '/customers/new' : path.startsWith('/customers') ? '/customers' : path === '/' ? '/' : null;

root(() => {
  document.getElementById('app').replaceChildren(html`
    <header class="site-header">
      <a class="brand" href="/">CRM</a>
      <nav aria-label="Main">
        <ul class="nav-links">
          ${links.map(([href, label]) => html`
            <li><a class="nav-link" href=${href}
                   aria-current=${() => (section(router.path.value) === href ? 'page' : null)}>${label}</a></li>
          `)}
        </ul>
      </nav>
    </header>
    <main id="main" class="page" tabindex="-1">${router.view}</main>
  `);
});
