import { define, html, repeat, signal, computed, transition } from 'mini';
import { confirm, toast } from '../ui.js';
import { todoStore } from '../store.js';

const FILTERS = {
  all: () => true,
  active: (t) => !t.done,
  done: (t) => t.done,
};

define('todo-list', () => {
  const { todos, filter } = todoStore;
  const draft = signal('');
  const visible = computed(() => todos.value.filter(FILTERS[filter.value] ?? FILTERS.all));
  const left = computed(() => todos.value.filter((t) => !t.done).length);

  const add = (e) => {
    e.preventDefault();
    const text = draft.value.trim();
    if (!text) return;
    todos.value = [...todos.value, { id: crypto.randomUUID(), text, done: false }];
    draft.value = '';
    toast('Todo added', { type: 'success' });
  };
  const toggle = (id) => {
    todos.value = todos.value.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  };
  // transition(): the removed rows fade out and the rest slide up, instead of jumping.
  const remove = (id) => transition(() => {
    todos.value = todos.value.filter((t) => t.id !== id);
  });
  const clearDone = async () => {
    const n = todos.value.filter((t) => t.done).length;
    const ok = await confirm(`Delete ${n} completed todo${n === 1 ? '' : 's'}?`, { ok: 'Clear', danger: true });
    if (!ok) return;
    transition(() => (todos.value = todos.value.filter((t) => !t.done)));
    toast('Completed todos cleared');
  };

  return html`
    <div class="card todos">
      <form class="todo-form" @submit=${add}>
        <label class="sr-only" for="todo-input">New todo</label>
        <input id="todo-input" class="input" placeholder="What needs doing?" autocomplete="off"
               .value=${draft} @input=${(e) => (draft.value = e.target.value)}>
        <button class="btn primary" type="submit">Add</button>
      </form>

      <div class="filters" role="group" aria-label="Show">
        ${Object.keys(FILTERS).map((f) => html`
          <button class="chip" type="button" aria-pressed=${() => String(filter.value === f)}
                  @click=${() => transition(() => (filter.value = f))}>${f}</button>
        `)}
      </div>

      <ul class="todo-list">
        ${repeat(visible, (t) => t.id, (t) => html`
          <li class=${t.done ? 'todo done' : 'todo'} style=${`view-transition-name: todo-${t.id}`}>
            <label class="todo-label">
              <input type="checkbox" class="check" .checked=${t.done} @change=${() => toggle(t.id)}>
              <span class="todo-text">${t.text}</span>
            </label>
            <button class="icon-btn danger" type="button" aria-label=${`Delete "${t.text}"`}
                    @click=${() => remove(t.id)}>✕</button>
          </li>
        `)}
      </ul>

      ${() => (visible.value.length === 0 ? html`<p class="empty">Nothing here.</p>` : null)}

      <div class="todo-footer">
        <span class="muted">${() => `${left.value} item${left.value === 1 ? '' : 's'} left`}</span>
        <button class="btn ghost" type="button" @click=${clearDone}
                ?disabled=${() => todos.value.every((t) => !t.done)}>Clear completed</button>
      </div>
    </div>
  `;
});
