import { html, signal } from 'pith';

export default function HomePage() {
  const count = signal(0);

  return html`
    <section class="hero">
      <h1>__APP_NAME__</h1>
      <p class="lead">Built with Pith: no build step, no runtime dependencies.</p>
    </section>

    <section class="section">
      <h2>A signal</h2>
      <p class="muted">Each click changes one signal, and only this number updates.</p>
      <button class="btn primary" type="button" @click=${() => count.value++}>Clicked ${count} times</button>
    </section>
  `;
}
