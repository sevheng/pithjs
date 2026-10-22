import { html, root } from 'mini';
import './todos.js';

root(() => {
  document.getElementById('app').replaceChildren(html`
    <main class="page">
      <section class="section narrow">
        <h1>Todos</h1>
        <todo-app></todo-app>
      </section>
    </main>
  `);
});
