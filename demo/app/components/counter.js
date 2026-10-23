import { define, html, signal, computed } from 'pith';

define(
  'pith-counter',
  (props) => {
    const count = signal(Number(props.start.value) || 0);
    const double = computed(() => count.value * 2);

    return html`
      <div class="card counter">
        <p class="counter-value" aria-live="polite">${count}</p>
        <p class="muted">Double: ${double}</p>
        <div class="row">
          <button class="btn" type="button" aria-label="Decrease" @click=${() => count.value--}>−</button>
          <button class="btn" type="button" @click=${() => (count.value = 0)}>Reset</button>
          <button class="btn primary" type="button" aria-label="Increase" @click=${() => count.value++}>+</button>
        </div>
      </div>
    `;
  },
  { props: ['start'] }
);
