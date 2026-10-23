import { createRouter } from 'pith';

// One line per page. Each page's code downloads only when it's first needed (or when a link to it is hovered).
// Add pages with: npm run new page <name> [--nav]
export const router = createRouter(
  {
    '/': { title: 'Home', load: () => import('./pages/home.js') },
    '*': { title: 'Not found', load: () => import('./pages/not-found.js') },
  },
  {
    title: (t) => `${t} · __APP_NAME__`,
    focus: '#main',
  }
);
