import { useEffect, useState } from 'react';

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

export default function App() {
  const [initial] = useState(load);
  const [todos, setTodos] = useState(initial.todos);
  const [filter, setFilter] = useState(initial.filter);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ todos, filter }));
    } catch {
      // storage full or blocked: keep working in memory
    }
  }, [todos, filter]);

  const visible = todos.filter(FILTERS[filter] ?? FILTERS.all);
  const left = todos.filter((t) => !t.done).length;

  const add = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setTodos([...todos, { id: crypto.randomUUID(), text, done: false }]);
    setDraft('');
  };
  const toggle = (id) => setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id) => setTodos(todos.filter((t) => t.id !== id));
  const clearDone = () => setTodos(todos.filter((t) => !t.done));

  return (
    <main className="page">
      <section className="section narrow">
        <h1>Todos</h1>
        <div className="card todos">
          <form className="todo-form" onSubmit={add}>
            <label className="sr-only" htmlFor="todo-input">New todo</label>
            <input id="todo-input" className="input" placeholder="What needs doing?" autoComplete="off"
                   value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn primary" type="submit">Add</button>
          </form>

          <div className="filters" role="group" aria-label="Show">
            {Object.keys(FILTERS).map((f) => (
              <button key={f} className="chip" type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          <ul className="todo-list">
            {visible.map((t) => (
              <li key={t.id} className={t.done ? 'todo done' : 'todo'}>
                <label className="todo-label">
                  <input type="checkbox" className="check" checked={t.done} onChange={() => toggle(t.id)} />
                  <span className="todo-text">{t.text}</span>
                </label>
                <button className="icon-btn danger" type="button" aria-label={`Delete "${t.text}"`} onClick={() => remove(t.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {visible.length === 0 && <p className="empty">Nothing here.</p>}

          <div className="todo-footer">
            <span className="muted">{left} item{left === 1 ? '' : 's'} left</span>
            <button className="btn ghost" type="button" onClick={clearDone} disabled={todos.every((t) => !t.done)}>
              Clear done
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
