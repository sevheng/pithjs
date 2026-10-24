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
  // ---------- Inbox (/inbox) ----------
  {
    name: 'Inbox', href: '/inbox', icon: 'inbox',
    text: 'A three-pane mail app: folders with counts, a searchable list, a reading pane, and Compose.',
    shows: ['Star, archive and delete with Undo, one or many at once', 'Search and the open message kept in the URL',
      'Load more with paginated(), and rows that change in place', 'Compose with form(): rules here, and 422 errors from the server'],
  },
  // ---------- end Inbox ----------
];
