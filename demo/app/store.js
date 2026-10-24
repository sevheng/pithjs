import { createStore } from 'pith';

// A pretend sign-in, for the guarded /settings/account page. Not saved: a reload signs you out.
export const session = createStore({ signedIn: false }, { name: 'session' });
