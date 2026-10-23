import { html } from 'pith';
import { router } from '../router.js';
import { session } from '../store.js';
import '../components/name-preview.js';

export default function SettingsProfilePage() {
  return html`
    <h1>Profile</h1>
    ${() => (router.query.value.denied && !session.signedIn.value
      ? html`<p class="notice" role="alert">Sign in to open Account.</p>`
      : null)}
    <p class="muted">Type a display name in the settings panel. It stays while you switch settings pages.</p>
    <name-preview></name-preview>
  `;
}
