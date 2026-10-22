<script setup>
import { computed, ref, watch } from 'vue';

const STORAGE_KEY = 'todos';
const FILTERS = {
  all: () => true,
  active: (t) => !t.done,
  done: (t) => t.done,
};
const WELCOME = [
  { id: 'welcome-1', text: 'Try adding a todo', done: false },
  { id: 'welcome-2', text: 'Reload the page: todos are saved', done: false },
];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.todos)) return saved;
  } catch {
    // storage blocked or corrupt: start fresh
  }
  return { todos: WELCOME, filter: 'all' };
}

const saved = load();
const todos = ref(saved.todos);
const filter = ref(saved.filter);
const draft = ref('');

watch([todos, filter], () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ todos: todos.value, filter: filter.value }));
  } catch {
    // storage full or blocked: keep working in memory
  }
}, { deep: true });

const visible = computed(() => todos.value.filter(FILTERS[filter.value] ?? FILTERS.all));
const left = computed(() => todos.value.filter((t) => !t.done).length);
const noneDone = computed(() => todos.value.every((t) => !t.done));

function add() {
  const text = draft.value.trim();
  if (!text) return;
  todos.value.push({ id: crypto.randomUUID(), text, done: false });
  draft.value = '';
}
const remove = (id) => (todos.value = todos.value.filter((t) => t.id !== id));
const clearDone = () => (todos.value = todos.value.filter((t) => !t.done));
const deleteLabel = (t) => `Delete "${t.text}"`;
</script>

<template>
  <main class="page">
    <section class="section narrow">
      <h1>Todos</h1>
      <div class="card todos">
        <form class="todo-form" @submit.prevent="add">
          <label class="sr-only" for="todo-input">New todo</label>
          <input id="todo-input" v-model="draft" class="input" placeholder="What needs doing?" autocomplete="off">
          <button class="btn primary" type="submit">Add</button>
        </form>

        <div class="filters" role="group" aria-label="Show">
          <button v-for="(_, f) in FILTERS" :key="f" class="chip" type="button"
                  :aria-pressed="String(filter === f)" @click="filter = f">{{ f }}</button>
        </div>

        <ul class="todo-list">
          <li v-for="t in visible" :key="t.id" :class="t.done ? 'todo done' : 'todo'">
            <label class="todo-label">
              <input v-model="t.done" type="checkbox" class="check">
              <span class="todo-text">{{ t.text }}</span>
            </label>
            <button class="icon-btn danger" type="button" :aria-label="deleteLabel(t)" @click="remove(t.id)">✕</button>
          </li>
        </ul>

        <p v-if="visible.length === 0" class="empty">Nothing here.</p>

        <div class="todo-footer">
          <span class="muted">{{ left }} item{{ left === 1 ? '' : 's' }} left</span>
          <button class="btn ghost" type="button" :disabled="noneDone" @click="clearDone">Clear done</button>
        </div>
      </div>
    </section>
  </main>
</template>
