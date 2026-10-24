import { createStore } from 'pith';
import { seedCards } from './data.js';

// The Kanban board, saved in localStorage: it survives a reload and follows changes made in other tabs.
// Here, not in app/store.js, so its seed cards download only with the board page.
export const board = createStore({ cards: seedCards() }, { persist: 'pith-kanban' });
