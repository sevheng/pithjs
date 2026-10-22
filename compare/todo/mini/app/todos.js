import { define, html, repeat, signal, computed, createStore } from 'mini';

const FILTERS = {
  all: () => true,
  active: (t) => !t.done,
  done: (t) => t.done,
};

const store = createStore(
  {
    todos: [
      { id: 'welcome-1', text: 'Try adding a todo', done: false },
      { id: 'welcome-2', text: 'Reload the page: todos are saved', done: false },
    ],
    filter: 'all',
  },
  { persist: 'todos' }
);

define('todo-app', () => {
  const { todos, filter } = store;
  const draft = signal('');
  const visible = computed(() => todos.value.filter(FILTERS[filter.value] ?? FILTERS.all));
  const left = computed(() => todos.value.filter((t) => !t.done).length);

  const add = (e) => {
    e.preventDefault();
    const text = draft.value.trim();
    if (!text) return;
    todos.value = [...todos.value, { id: crypto.randomUUID(), text, done: false }];
    draft.value = '';
  };
  const toggle = (id) => {
    todos.value = todos.value.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  };
  const remove = (id) => {
    todos.value = todos.value.filter((t) => t.id !== id);
  };
  const clearDone = () => {
    todos.value = todos.value.filter((t) => !t.done);
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
                  @click=${() => (filter.value = f)}>${f}</button>
        `)}
      </div>

      <ul class="todo-list">
        ${repeat(visible, (t) => t.id, (t) => html`
          <li class=${t.done ? 'todo done' : 'todo'}>
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
                ?disabled=${() => todos.value.every((t) => !t.done)}>Clear done</button>
      </div>
    </div>
  `;
});
