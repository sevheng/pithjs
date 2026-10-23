import { html, signal } from 'pith';
import { confirm, dialog, toast } from '../ui.js';

// App code, not framework: app/ui.js builds these on the browser's own <dialog> and popover.
// They're promises, so the code reads top to bottom.
export default function DialogsExample() {
  const choice = signal('nothing yet');

  const ask = async () => {
    if (await confirm('Delete the sample file?', { ok: 'Delete', danger: true })) toast('Deleted', { type: 'success' });
    else toast('Kept it');
  };
  const pick = async () => {
    const color = await dialog((close) => html`
      <h2>Pick a color</h2>
      <div class="row">
        ${['Red', 'Green', 'Blue'].map((c) => html`<button class="btn" type="button" @click=${() => close(c)}>${c}</button>`)}
      </div>`);
    choice.value = String(color ?? 'cancelled');
  };

  return html`
    <div class="row">
      <button class="btn" type="button" @click=${ask}>Confirm…</button>
      <button class="btn" type="button" @click=${pick}>Custom dialog…</button>
      <button class="btn" type="button" @click=${() => toast('Hello from a toast')}>Toast</button>
    </div>
    <p>Picked: <strong>${choice}</strong></p>
  `;
}
