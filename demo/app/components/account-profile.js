import { define, html, inject, form, rules } from 'pith';
import { session } from '../store.js';
import { toast } from '../ui.js';

// The Profile form. It saves the display name into the value the account layout provides (inject('account')),
// so the greeting in the side nav follows, and the name stays while you move between account pages.
define('account-profile', () => {
  const account = inject('account', null);
  const f = form({
    initial: { displayName: account?.displayName.peek() ?? '', email: session.user.peek()?.email ?? '', news: false },
    validate: {
      displayName: [rules.required('Enter the name we should greet you by'), rules.maxLength(40)],
      email: [rules.required('Enter your email address'), rules.email()],
    },
    onSubmit: (values) => {
      if (account) account.displayName.value = values.displayName.trim();
      toast('Profile saved', { type: 'success' });
    },
  });

  return html`
    <form class="form card account-form" novalidate @submit=${f.submit}>
      ${f.input('displayName', { label: 'Display name', autocomplete: 'nickname', hint: 'Shown at the top of your account' })}
      ${f.input('email', { label: 'Email', type: 'email', autocomplete: 'email', hint: 'Receipts and delivery updates go here' })}
      ${f.checkbox('news', { label: 'Tell me when new things arrive (about once a month)' })}
      <button class="btn primary" type="submit">Save changes</button>
    </form>`;
});
