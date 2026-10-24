import { html } from 'pith';
import { apps } from '../../apps.js';
import { icon } from '../../icons.js';

export default () => html`
  <p>Each example is a complete app in this demo: its own pages, a fake backend in <code>api/</code>, and user
    flows in <code>tests/flows.js</code> that <code>npm run check</code> runs. Open one, or read how it's built.</p>
  <ul class="app-grid">
    ${apps.map((a) => html`
      <li class="card lift app-card">
        <span class="icon-tile">${icon(a.icon)}</span>
        <h2>${a.name}</h2>
        <p class="muted">${a.text}</p>
        <ul class="check-list">${a.shows.map((s) => html`<li>${icon('check')}<span>${s}</span></li>`)}</ul>
        <p class="row"><a class="btn primary" href=${a.href}>Open ${a.name}</a>
          <a class="btn ghost" href=${`/docs/${a.name.toLowerCase()}`}>How it's built</a></p>
      </li>`)}
  </ul>`;
