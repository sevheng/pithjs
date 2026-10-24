// The example apps listed at /examples: what each shows, and where it lives.
/** @type {{ name: string, href: string, icon: string, text: string, shows: string[] }[]} */
export const apps = [
  {
    name: 'Settings', href: '/settings', icon: 'settings',
    text: 'A settings area: pages that share a side nav, and one that needs sign-in.',
    shows: ['Layouts that stay mounted between pages', 'A guard that redirects with a notice', 'provide / inject instead of passing props down'],
  },
];
