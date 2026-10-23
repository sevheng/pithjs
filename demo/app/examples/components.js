import { html, define, signal, provide, inject } from 'pith';

// define() makes a custom element: props come from attributes (as signals), slots from its children,
// and provide/inject passes a value to every component inside, without threading props.
define('rating-stars', (props) => {
  const max = () => Number(props.max.value) || 5;
  const value = signal(Number(props.value.value) || 0);
  const accent = inject('accent', 'currentColor');
  return html`
    <span class="stars" role="group" aria-label=${() => `Rating: ${value.value} of ${max()}`}>
      ${() => Array.from({ length: max() }, (_, i) => html`
        <button type="button" class="star" style=${`color: ${accent}`} aria-label=${`${i + 1} stars`}
                aria-pressed=${() => String(i < value.value)} @click=${() => (value.value = i + 1)}>
          ${() => (i < value.value ? '★' : '☆')}
        </button>`)}
    </span>
  `;
}, { props: ['max', 'value'] });

define('review-card', (props, ctx) => {
  provide('accent', '#b7791f'); // gold; stars are large text, so 3:1 contrast is enough
  return html`
    <article class="card">
      <h3>${ctx.slot('title')}</h3>
      ${ctx.slot()}
      <rating-stars max="5" value=${props.stars}></rating-stars>
    </article>
  `;
}, { props: ['stars'] });

export default function ComponentsExample() {
  return html`
    <review-card stars="4">
      <span slot="title">A tiny framework</span>
      <p>Click a star to change the rating.</p>
    </review-card>
  `;
}
