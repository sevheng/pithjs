import { html } from 'pith';

// Small drawings of each app for the showcase tiles (decorative: the tile's text says what it is).
const previews = {
  Chat: () => html`<div class="mini mini-chat" aria-hidden="true">
    <i class="b them w70"></i><i class="b them w45"></i><i class="b me w60"></i><i class="b them w55"></i><i class="b me w35"></i></div>`,
  Inbox: () => html`<div class="mini mini-inbox" aria-hidden="true">
    ${[1, 2, 3, 4].map((n) => html`<i class=${n === 2 ? 'row on' : 'row'}><b></b><s></s></i>`)}</div>`,
  Kanban: () => html`<div class="mini mini-kanban" aria-hidden="true">
    ${[3, 2, 2, 1].map((n) => html`<i class="col">${Array.from({ length: n }, () => html`<b></b>`)}</i>`)}</div>`,
  Dashboard: () => html`<div class="mini mini-dash" aria-hidden="true">
    ${[40, 65, 50, 80, 60, 95, 75].map((h) => html`<i style=${`--h: ${h}%`}></i>`)}</div>`,
  Trading: () => html`<div class="mini mini-trade" aria-hidden="true">
    ${[[18, 30, 1], [30, 24, 0], [22, 36, 1], [40, 22, 1], [34, 30, 0], [50, 26, 1], [44, 20, 0], [56, 32, 1]].map(([b, h, up]) => html`<i class=${up ? 'up' : 'down'} style=${`--b: ${b}%; --h: ${h}%`}></i>`)}</div>`,
  // ---------- Shop (/shop) ----------
  Shop: () => html`<div class="mini mini-shop" aria-hidden="true">${[0, 1, 2].map(() => html`<i><b></b><s></s></i>`)}</div>`,
  // ---------- end Shop ----------
  // ---------- Spreadsheet (/sheet) ----------
  Spreadsheet: () => html`<div class="mini mini-sheet" aria-hidden="true">
    ${[0, 1, 2, 3, 4].map((r) => html`<i class=${r === 2 ? 'row on' : 'row'}>${[0, 1, 2, 3].map((c) => html`<b class=${r === 2 && c === 2 ? 'cell on' : 'cell'}></b>`)}</i>`)}</div>`,
  // ---------- end Spreadsheet ----------
};

/** The drawing for an app in app/apps.js, by name. */
export const preview = (name) => (previews[name] ?? previews.Chat)();
