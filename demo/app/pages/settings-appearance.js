import { html } from 'mini';
import '../components/name-preview.js';

export default function SettingsAppearancePage() {
  return html`
    <h1>Appearance</h1>
    <p class="muted">Switch between light and dark with the moon/sun button in the header. Your choice is saved.</p>
    <name-preview></name-preview>
  `;
}
