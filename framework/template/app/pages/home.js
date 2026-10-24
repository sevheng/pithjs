import { html, signal } from 'pith';

// Small line icons (inline SVG, in the accent color through currentColor).
const icon = (path) => html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d=${path} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONS = {
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  add: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  ai: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z',
};

const nextSteps = [
  ['edit', 'Make it yours', html`Edit <code>app/pages/home.js</code>. The page reloads when you save.`],
  ['add', 'Add a page', html`<code>npm run new page about -- --nav</code> adds the page, its route and a nav link.`],
  ['check', 'Check it', html`<code>npm run check</code> tests every page and flow. It must say “All good”.`],
  ['ai', 'Build with AI', html`Agents read <code>AGENTS.md</code> and the skills in <code>.claude/skills/</code>.`],
];

export default function HomePage() {
  const count = signal(0);

  return html`
    <section class="hero tinted">
      <span class="badge soft">New site</span>
      <h1>__APP_NAME__</h1>
      <p class="lead">Your site is running. It's built with Pith: no build step, no runtime dependencies.</p>
      <div class="row">
        <a class="btn primary" href="#next">See next steps</a>
        <button class="btn" type="button" @click=${() => count.value++}>Clicked ${count} times</button>
      </div>
    </section>

    <section class="section" id="next" aria-labelledby="next-title">
      <h2 id="next-title">Next steps</h2>
      <ul class="step-grid">
        ${nextSteps.map(([name, title, text]) => html`
          <li class="card lift">
            <span class="icon-tile">${icon(ICONS[name])}</span>
            <h3>${title}</h3>
            <p>${text}</p>
          </li>`)}
      </ul>
    </section>
  `;
}
