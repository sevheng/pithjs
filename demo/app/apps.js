// The example apps listed at /examples: what each shows, and where it lives.
/** @type {{ name: string, href: string, icon: string, text: string, shows: string[], uses: [string, string][] }[]} */
// uses: the Pith parts the app is built on, as [docs page, label].
export const apps = [
  {
    name: 'Chat', href: '/chat/general', icon: 'chat',
    text: 'Rooms and conversations with rich messages: code, images, files, link previews, replies and reactions.',
    shows: ['Messages appear at once, with Retry if sending fails', 'Typing indicator and a bot that answers in #help',
      'A layout that stays mounted while you switch rooms', 'Each room prerendered with its messages'],
    uses: [['resource', 'live()'], ['resource', 'optimistic()'], ['lists', 'repeat()'], ['selector', 'selector()'], ['router', 'layouts'], ['deploying', 'prerendered']],
  },
  {
    name: 'Settings', href: '/settings', icon: 'settings',
    text: 'A settings area: pages that share a side nav, and one that needs sign-in.',
    shows: ['Layouts that stay mounted between pages', 'A guard that redirects with a notice', 'provide / inject instead of passing props down'],
    uses: [['router', 'layouts'], ['router', 'guard'], ['components', 'provide / inject'], ['store', 'createStore()']],
  },
  // ---------- Inbox (/inbox) ----------
  {
    name: 'Inbox', href: '/inbox', icon: 'inbox',
    text: 'A three-pane mail app: folders with counts, a searchable list, a reading pane, and Compose.',
    shows: ['Star, archive and delete with Undo, one or many at once', 'Search and the open message kept in the URL',
      'Load more with paginated(), and rows that change in place', 'Compose with form(): rules here, and 422 errors from the server'],
    uses: [['paginated', 'paginated()'], ['forms', 'form()'], ['router', 'setQuery()'], ['selector', 'selector()'], ['dialogs', 'confirm / toast']],
  },
  // ---------- end Inbox ----------
  // ---------- Kanban (/kanban) ----------
  {
    name: 'Kanban', href: '/kanban', icon: 'board',
    text: 'A project board: cards with labels, people and due dates, moved by drag and drop or the keyboard.',
    shows: ['Drag and drop, or Move buttons and Alt+arrow keys', 'Moves animated with transition()',
      'Filters by label and person kept in the URL', 'Saved in a store that survives reloads and syncs tabs'],
    uses: [['store', 'createStore()'], ['animation', 'transition()'], ['forms', 'form()'], ['router', 'queryAll()'], ['dialogs', 'dialog()']],
  },
  // ---------- Dashboard (/dashboard) ----------
  {
    name: 'Dashboard', href: '/dashboard', icon: 'chart',
    text: 'Analytics for a small online shop: KPIs, charts and a table of orders, all from a date range in the URL.',
    shows: ['KPI cards with trends vs the previous period', 'SVG line and bar charts with tooltips and a data table',
      'A sortable, filterable orders table with pages and a detail panel', 'Skeletons while loading, errors with Try again'],
    uses: [['resource', 'resource()'], ['resource', 'live()'], ['templates', 'svg``'], ['selector', 'selector()'], ['router', 'router.query']],
  },
  // ---------- end Dashboard ----------
  // ---------- Trading (/trade) ----------
  {
    name: 'Trading', href: '/trade', icon: 'trade',
    text: 'A live trading screen for a made-up exchange: a ticking watchlist, candlesticks, an order book and an order ticket.',
    shows: ['Prices that tick in place, over 2,000 updates a second', 'A candlestick chart whose last candle grows live',
      'An order ticket with live cost, Pending then Filled, and server errors', 'Pause, speed, and a lost connection with Retry'],
    uses: [['lists', 'signal per row'], ['signals', 'batch()'], ['selector', 'selector()'], ['resource', 'optimistic()'], ['forms', 'form()'], ['router', 'layouts']],
  },
  // ---------- end Trading ----------
];
