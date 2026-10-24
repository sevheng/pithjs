import { define, html } from 'pith';
import { router } from '../router.js';
import { theme, setTheme } from '../store.js';
import { brandMark } from '../brand.js';

const links = [
  ['/', 'Home'],
  ['/docs', 'Docs'],
];

// A section link (e.g. /docs) is current on its sub-pages too (/docs/forms).
const isCurrent = (path, href) => path === href || (href !== '/' && path.startsWith(`${href}/`));

const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

define('nav-bar', () => {
  // The theme is shared with the Shop's Appearance page (app/store.js); 'system' follows the device.
  const dark = () => (theme.value === 'system' ? systemDark() : theme.value === 'dark');
  const toggleTheme = () => setTheme(dark() ? 'light' : 'dark');

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
              aria-label=${() => `Switch to ${dark() ? 'light' : 'dark'} theme`}>
        ${() => (dark() ? '☀' : '☾')}
      </button>
    </header>
  `;
});
