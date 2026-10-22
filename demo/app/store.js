import { createStore } from 'mini';

export const todoStore = createStore(
  {
    todos: [
      { id: 'welcome-1', text: 'Try adding a todo', done: false },
      { id: 'welcome-2', text: 'Reload the page: todos are saved', done: false },
    ],
    filter: 'all',
  },
  { persist: 'mini-todos' }
);

// A pretend sign-in, for the guarded /settings/account page. Not saved: a reload signs you out.
export const session = createStore({ signedIn: false }, { name: 'session' });
