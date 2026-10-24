import { html } from 'pith';
import '../components/account-profile.js';

export default function ShopAccountProfile() {
  return html`
    <h1>Profile</h1>
    <p class="muted">The name you save here greets you beside the menu, and stays while you move between account pages.</p>
    <account-profile></account-profile>
  `;
}
