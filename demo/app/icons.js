import { html } from 'pith';

// Line icons (24px grid, stroke follows currentColor). Decorative: put the meaning in text or aria-label.
/** @type {Record<string, string>} */
const PATHS = {
  chat: 'M4 5h16v11H9l-5 4V5z',
  inbox: 'M3 13l3-8h12l3 8v6H3v-6zM3 13h5l1 2h6l1-2h5',
  board: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v7h-4z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 7.5 4 7 3 10l2 1v2l-2 1 1 3 2-.5 1.5 1.5-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1v-2z',
  check: 'M5 12.5l4.5 4.5L19 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  send: 'M4 12l16-8-6 16-2-6-8-2z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z',
  file: 'M6 3h8l4 4v14H6V3zM14 3v4h4',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  plus: 'M12 5v14M5 12h14',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  back: 'M15 5l-7 7 7 7',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  close: 'M6 6l12 12M18 6L6 18',
  reply: 'M10 9V5l-7 7 7 7v-4c5 0 8 1.5 11 5-1-6-4-10-11-11z',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  clip: 'M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7',
  down: 'M12 5v14M6 13l6 6 6-6',
  // ---------- Kanban (/kanban) ----------
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  filter: 'M3 5h18l-7 8v6l-4-2v-4L3 5z',
};

/** @param {string} name one of the names above @param {string} [className] */
export const icon = (name, className = 'icon') => html`
  <svg class=${className} viewBox="0 0 24 24" aria-hidden="true"><path d=${PATHS[name]} fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
