import { html } from 'mini';
import '../components/todo-list.js';

export default function TodosPage() {
  return html`
    <section class="section narrow">
      <h1>Todos</h1>
      <p class="muted">Saved in your browser. Typing keeps focus while the list updates.</p>
      <todo-list></todo-list>
    </section>
  `;
}
