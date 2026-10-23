import { html } from 'pith';
import '../components/name-preview.js';

// Guarded: the router only shows it when session.signedIn is true (see `auth: true` in app/router.js).
export default function SettingsAccountPage() {
  return html`
    <h1>Account</h1>
    <p class="muted">Only signed-in visitors get here. Signing out keeps you on this page until you leave it.</p>
    <name-preview></name-preview>
  `;
}
