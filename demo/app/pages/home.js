import { html } from 'pith';
import '../components/counter.js';

const features = [
  ['Tiny', 'The whole framework is a few KB of plain JavaScript. No download step before the page shows.'],
  ['Native', 'Built on Web Components, ES modules and template literals the browser already ships.'],
  ['Precise updates', 'Signals update only the exact text or attribute that changed, never the whole page.'],
];

export default function HomePage() {
  return html`
    <section class="hero">
      <h1>Simple is fast.</h1>
      <p class="lead">
        Pith is a small framework built on native web tech: the speed of old-school HTML
        with the feel of a modern app.
      </p>
      <div class="row">
        <a class="btn primary" href="/todos">Try the todo app</a>
        <a class="btn" href="/about">How fast is it?</a>
      </div>
    </section>

    <section class="section">
      <h2>A reactive counter</h2>
      <p class="muted">Each click changes one signal. Only the two numbers re-render.</p>
      <pith-counter start="5"></pith-counter>
    </section>

    <section class="section grid">
      ${features.map(([title, text]) => html`
        <article class="card feature">
          <h3>${title}</h3>
          <p>${text}</p>
        </article>
      `)}
    </section>
  `;
}
