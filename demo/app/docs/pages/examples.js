import { html } from 'pith';
import { apps } from '../../apps.js';
import { icon } from '../../icons.js';
import { preview } from '../../previews.js';

// Chat first and biggest; the others follow in a grid.
const ORDER = ['Chat', 'Inbox', 'Kanban', 'Dashboard', 'Trading', 'Settings'];

export default () => html`
  <p>Each example is a complete app in this demo: its own pages, a fake backend in <code>api/</code>, and user
    flows in <code>tests/flows.js</code> that <code>npm run check</code> runs. Every state is handled (loading,
    empty, errors), on phones and in dark mode. Open one, or read how it's built.</p>
  <ul class="example-grid">
    ${ORDER.map((name) => apps.find((a) => a.name === name)).map((a) => html`
      <li class=${`example-tile tile-${a.name.toLowerCase()}`}>
        ${preview(a.name)}
        <div class="example-body">
          <h2><span class="icon-tile">${icon(a.icon)}</span>${a.name}</h2>
          <p class="muted">${a.text}</p>
          <ul class="check-list">${a.shows.map((s) => html`<li>${icon('check')}<span>${s}</span></li>`)}</ul>
          <p class="uses"><span class="muted small">Built with</span>
            ${a.uses.map(([page, label]) => html`<a class="tag" href=${`/docs/${page}`}>${label}</a>`)}</p>
          <p class="row"><a class="btn primary" href=${a.href}>Open ${a.name}</a>
            <a class="btn ghost" href=${`/docs/${a.name.toLowerCase()}`}>How it's built</a></p>
        </div>
      </li>`)}
  </ul>`;
