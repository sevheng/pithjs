import { html, signal, computed } from 'pith';

// A signal holds a value. A computed derives one. Both are just put in the template:
// a click changes `count`, and only the two numbers on screen update.
export default function SignalsExample() {
  const count = signal(0);
  const double = computed(() => count.value * 2);

  return html`
    <p class="example-big">${count} <span class="muted">× 2 = ${double}</span></p>
    <div class="row">
      <button class="btn" type="button" @click=${() => count.value--}>−1</button>
      <button class="btn primary" type="button" @click=${() => count.value++}>+1</button>
      <button class="btn ghost" type="button" @click=${() => (count.value = 0)}>Reset</button>
    </div>
  `;
}
