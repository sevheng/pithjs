# Small app: Todo

One page, no router. Every implementation must match this text exactly, so the same user flows
(`flows/todo.js`) test all of them. Uses `/styles.css` (shared) and the class names below.

## Data
- A todo is `{ id: string, text: string, done: boolean }`. New ids: `crypto.randomUUID()`.
- Saved to `localStorage['todos']` as `{ "todos": [...], "filter": "all" | "active" | "done" }`
  on every change, and loaded on start. If nothing is saved, start with:
  `[{ id: 'welcome-1', text: 'Try adding a todo', done: false }, { id: 'welcome-2', text: 'Reload the page: todos are saved', done: false }]`, filter `all`.

## Page (inside `<main class="page">`)
```
<section class="section narrow">
  <h1>Todos</h1>
  <div class="card todos">
    <form class="todo-form">                        submit = add (trimmed; ignore empty), then clear the input, keep focus
      <label class="sr-only" for="todo-input">New todo</label>
      <input id="todo-input" class="input" placeholder="What needs doing?" autocomplete="off">
      <button class="btn primary" type="submit">Add</button>
    <div class="filters" role="group" aria-label="Show">
      3 × <button class="chip" type="button" aria-pressed="true|false">all | active | done</button>
    <ul class="todo-list">                           visible todos for the filter, in insertion order
      <li class="todo">  (class "todo done" when done)
        <label class="todo-label">
          <input type="checkbox" class="check">      toggles done
          <span class="todo-text">{text}</span>
        <button class="icon-btn danger" type="button" aria-label='Delete "{text}"'>✕</button>
    <p class="empty">Nothing here.</p>               only when the visible list is empty
    <div class="todo-footer">
      <span class="muted">{n} item(s) left</span>    "1 item left", "2 items left" (not-done count)
      <button class="btn ghost" type="button">Clear done</button>   disabled when nothing is done
```
- User text is shown as text (never as HTML).
- Typing must not lose focus or re-create the input.
