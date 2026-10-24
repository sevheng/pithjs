// The example apps listed at /examples: what each shows, and where it lives.
/** @type {{ name: string, href: string, icon: string, text: string, shows: string[] }[]} */
export const apps = [
  {
    name: 'Chat', href: '/chat/general', icon: 'chat',
    text: 'Rooms and conversations with rich messages: code, images, files, link previews, replies and reactions.',
    shows: ['Messages appear at once, with Retry if sending fails', 'Typing indicator and a bot that answers in #help',
      'A layout that stays mounted while you switch rooms', 'Each room prerendered with its messages'],
  },
  {
    name: 'Settings', href: '/settings', icon: 'settings',
    text: 'A settings area: pages that share a side nav, and one that needs sign-in.',
    shows: ['Layouts that stay mounted between pages', 'A guard that redirects with a notice', 'provide / inject instead of passing props down'],
  },
  // ---------- Kanban (/kanban) ----------
  {
    name: 'Kanban', href: '/kanban', icon: 'board',
    text: 'A project board: cards with labels, people and due dates, moved by drag and drop or the keyboard.',
    shows: ['Drag and drop, or Move buttons and Alt+arrow keys', 'Moves animated with transition()',
      'Filters by label and person kept in the URL', 'Saved in a store that survives reloads and syncs tabs'],
  },
];
