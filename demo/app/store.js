import { createStore } from 'pith';

export const todoStore = createStore(
  {
    todos: [
      { id: 'welcome-1', text: 'Try adding a todo', done: false },
      { id: 'welcome-2', text: 'Reload the page: todos are saved', done: false },
    ],
    filter: 'all',
  },
  { persist: 'pith-todos' }
);

// A pretend sign-in, for the guarded /settings/account page. Not saved: a reload signs you out.
export const session = createStore({ signedIn: false }, { name: 'session' });
