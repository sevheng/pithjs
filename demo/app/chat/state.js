import { signal } from 'pith';

// Shared by the chat layout (the rooms list) and the room page: the page bumps it after loading a room
// (which marks it read), so the rooms list refetches its unread counts.
export const roomsVersion = signal(0);
