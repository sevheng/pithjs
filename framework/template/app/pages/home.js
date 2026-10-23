import { html, signal, resource, fetchJSON } from 'pith';

export default function HomePage() {
  const count = signal(0);
  // Data from api/hello.mjs (the dev API). In production, a real backend answers /api/hello.
  const hello = resource(({ signal }) => fetchJSON('/api/hello', { signal }));

  return html`
    <section class="hero">
      <h1>__APP_NAME__</h1>
      <p class="lead">${hello.render((data) => data.message)}</p>
    </section>

    <section class="section">
      <h2>A signal</h2>
      <p class="muted">Each click changes one signal, and only this number updates.</p>
      <button class="btn primary" type="button" @click=${() => count.value++}>Clicked ${count} times</button>
    </section>
  `;
}
