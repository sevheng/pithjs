import { define, html, signal } from 'mini';

// Throws from one of its holes when broken. The custom fallback replaces only this widget;
// "Try again" re-runs setup, so `broken` starts as false again.
define(
  'risky-widget',
  () => {
    const broken = signal(false);
    const status = () => {
      if (broken.value) throw new Error('The widget hit a bug.');
      return 'This widget is working.';
    };

    return html`
      <div class="widget">
        <p>${status}</p>
        <button class="btn" type="button" @click=${() => (broken.value = true)}>Break this widget</button>
      </div>
    `;
  },
  {
    fallback: (err, retry) => html`
      <div class="card widget-crashed" role="alert">
        <p>This widget crashed: ${String(err?.message ?? err)}</p>
        <button class="btn primary" type="button" @click=${retry}>Try again</button>
      </div>
    `,
  }
);
