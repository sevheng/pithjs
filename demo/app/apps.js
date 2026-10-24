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
  // ---------- Dashboard (/dashboard) ----------
  {
    name: 'Dashboard', href: '/dashboard', icon: 'chart',
    text: 'Analytics for a small online shop: KPIs, charts and a table of orders, all from a date range in the URL.',
    shows: ['KPI cards with trends vs the previous period', 'SVG line and bar charts with tooltips and a data table',
      'A sortable, filterable orders table with pages and a detail panel', 'Skeletons while loading, errors with Try again'],
  },
  // ---------- end Dashboard ----------
];
