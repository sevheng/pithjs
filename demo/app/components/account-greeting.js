import { define, html, inject } from 'pith';
import { session } from '../store.js';

// "Hello, Ann": the display name set on the Profile page, provided by <account-context> in the account layout.
// Without one it uses the signed-in name, then "there".
define('account-greeting', () => {
  const account = inject('account', null);
  const name = () => account?.displayName.value.trim() || session.user.value?.name || 'there';

  return html`<p class="account-hello">Hello, <strong>${name}</strong></p>`;
});
