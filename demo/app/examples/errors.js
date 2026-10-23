import { html, define, signal } from 'pith';

// A component that throws (in setup, a ${} hole, or a @click handler) shows its fallback instead,
// and the rest of the page keeps working. "Try again" runs its setup again, from scratch.
define('flaky-panel', () => {
  const broken = signal(false);
  const status = () => {
    if (broken.value) throw new Error('Something broke inside this panel.');
    return 'Working fine.';
  };
  return html`
    <p>${status}</p>
    <button class="btn" type="button" @click=${() => (broken.value = true)}>Break it</button>
  `;
}, {
  fallback: (err, retry) => html`
    <div class="card widget-crashed" role="alert">
      <p>Crashed: ${err.message}</p>
      <button class="btn primary" type="button" @click=${retry}>Try again</button>
    </div>
  `,
});

export default function ErrorsExample() {
  return html`
    <flaky-panel></flaky-panel>
    <p class="muted">This text is outside the panel, so it stays when the panel crashes.</p>
  `;
}
