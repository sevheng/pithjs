import { define, html, signal } from 'pith';
import { router } from '../router.js';
import { brandMark } from '../brand.js';

const links = [
  ['/', 'Home'],
  ['/features', 'Features'],
  ['/todos', 'Todos'],
  ['/team', 'Team'],
  ['/contact', 'Contact'],
  ['/about', 'About'],
  ['/settings', 'Settings'],
];

// A section link (e.g. /settings) is current on its sub-pages too (/settings/profile).
const isCurrent = (path, href) => path === href || (href !== '/' && path.startsWith(`${href}/`));

const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

define('nav-bar', () => {
  const theme = signal(document.documentElement.dataset.theme || (systemDark() ? 'dark' : 'light'));

  const toggleTheme = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme.value;
    try {
      localStorage.setItem('pith-theme', theme.value);
    } catch {
      // storage blocked: theme still applies for this visit
    }
  };

  return html`
    <header class="site-header">
      <a class="brand" href="/">${brandMark()} Pith</a>
      <nav aria-label="Main">
        <ul class="nav-links">
          ${links.map(([href, label]) => html`
            <li>
              <a class="nav-link" href=${href}
                 aria-current=${() => (isCurrent(router.path.value, href) ? 'page' : null)}>${label}</a>
            </li>
          `)}
        </ul>
      </nav>
      <button class="icon-btn" type="button" @click=${toggleTheme}
              aria-label=${() => `Switch to ${theme.value === 'dark' ? 'light' : 'dark'} theme`}>
        ${() => (theme.value === 'dark' ? '☀' : '☾')}
      </button>
    </header>
  `;
});
