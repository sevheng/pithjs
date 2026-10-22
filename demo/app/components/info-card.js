import { define, html } from 'mini';

// A card with a title slot: <info-card><span slot="title">Title</span><p>Body</p></info-card>
define('info-card', (props, ctx) => html`
  <article class="card info-card">
    <h2>${ctx.slot('title')}</h2>
    ${ctx.slot()}
  </article>
`);
