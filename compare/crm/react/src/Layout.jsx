import { useEffect } from 'react';
import { Link, Outlet, useLocation, useMatches } from 'react-router';

const LINKS = [
  ['/', 'Dashboard'],
  ['/customers', 'Customers'],
  ['/customers/new', 'New customer'],
];

// Which nav link is current for a path.
const section = (path) =>
  path === '/customers/new' ? '/customers/new' : path.startsWith('/customers') ? '/customers' : path === '/' ? '/' : null;

export default function Layout() {
  const { pathname } = useLocation();
  const title = useMatches().at(-1)?.handle?.title;

  useEffect(() => {
    if (title) document.title = `${title} · CRM`;
  }, [title]);

  return (
    <>
      <header className="site-header">
        <Link className="brand" to="/">CRM</Link>
        <nav aria-label="Main">
          <ul className="nav-links">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link className="nav-link" to={href} aria-current={section(pathname) === href ? 'page' : undefined}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
