import { html, signal } from 'pith';
import { router } from '../router.js';
import { session } from '../store.js';
import '../components/settings-context.js';

const links = [
  ['/settings/profile', 'Profile'],
  ['/settings/appearance', 'Appearance'],
  ['/settings/account', 'Account'],
];

// Shared by every /settings/* route. The router keeps it mounted while you move between them, so the
// side nav and the display name keep their state; only `page` changes. Pages read the display name
// with inject('settings') (see components/name-preview.js), instead of it being passed down as a prop.
export default function SettingsLayout(page) {
  const displayName = signal('');

  return html`
    <settings-context .value=${{ displayName }}>
      <div class="settings">
        <aside class="settings-side">
          <nav aria-label="Settings">
            <ul class="settings-nav">
              ${links.map(([href, label]) => html`
                <li>
                  <a class="settings-link" href=${href}
                     aria-current=${() => (router.path.value === href ? 'page' : null)}>${label}</a>
                </li>
              `)}
            </ul>
          </nav>
          <div class="field">
            <label for="display-name">Display name</label>
            <input id="display-name" class="input" autocomplete="nickname" placeholder="Ann"
                   .value=${displayName} @input=${(e) => (displayName.value = e.target.value)}>
          </div>
          <button class="btn" type="button" @click=${() => (session.signedIn.value = !session.signedIn.value)}>
            ${() => (session.signedIn.value ? 'Sign out' : 'Sign in')}
          </button>
        </aside>
        <div class="settings-body">${page}</div>
      </div>
    </settings-context>
  `;
}
