import { html, signal } from 'pith';

const nextSteps = [
  ['Make it yours', html`Edit <code>app/pages/home.js</code>: the page reloads when you save.`],
  ['Add a page', html`<code>npm run new page about -- --nav</code> adds the page, its route and a nav link.`],
  ['Check it', html`<code>npm run check</code> tests every page and flow. It must say “All good”.`],
  ['Work with AI', html`Agents read <code>AGENTS.md</code>: the rules, patterns and commands for this site.`],
];

export default function HomePage() {
  const count = signal(0);

  return html`
    <section class="hero">
      <h1>__APP_NAME__</h1>
      <p class="lead">Your new site, built with Pith: no build step, no runtime dependencies.</p>
      <button class="btn primary" type="button" @click=${() => count.value++}>Clicked ${count} times</button>
    </section>

    <section class="section" aria-labelledby="next">
      <h2 id="next">Next steps</h2>
      <ul class="step-grid">
        ${nextSteps.map(([title, text]) => html`<li class="card"><h3>${title}</h3><p>${text}</p></li>`)}
      </ul>
    </section>
  `;
}
