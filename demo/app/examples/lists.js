import { html, signal, repeat, transition } from 'pith';

// repeat() keeps each item's DOM by key and moves it instead of rebuilding it.
// transition() animates the change: removed items fade out, moved ones slide.
export default function ListsExample() {
  let nextId = 4;
  const items = signal([
    { id: 1, name: 'Apples' },
    { id: 2, name: 'Bread' },
    { id: 3, name: 'Coffee' },
  ]);
  const draft = signal('');

  const add = (e) => {
    e.preventDefault();
    const name = draft.value.trim();
    if (!name) return;
    transition(() => (items.value = [...items.value, { id: nextId++, name }]));
    draft.value = '';
  };
  const remove = (id) => transition(() => (items.value = items.value.filter((i) => i.id !== id)));
  const shuffle = () => transition(() => (items.value = [...items.value].sort(() => Math.random() - 0.5)));

  return html`
    <form class="row" @submit=${add}>
      <label class="sr-only" for="list-new">New item</label>
      <input id="list-new" class="input" placeholder="New item" .value=${draft}
             @input=${(e) => (draft.value = e.target.value)}>
      <button class="btn primary">Add</button>
      <button class="btn" type="button" @click=${shuffle}>Shuffle</button>
    </form>
    <ul class="example-list">
      ${repeat(items, (i) => i.id, (i) => html`
        <li class="example-item" style=${`view-transition-name: item-${i.id}`}>
          <span>${i.name}</span>
          <button class="icon-btn danger" type="button" aria-label=${`Remove ${i.name}`} @click=${() => remove(i.id)}>×</button>
        </li>
      `)}
    </ul>
  `;
}
