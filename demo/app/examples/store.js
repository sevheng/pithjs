import { html, createStore } from 'pith';

// createStore() turns each key into a signal. With `persist` it's saved to localStorage, restored on
// reload, and kept in step across tabs: open this page in a second tab and change the note there.
const notes = createStore({ note: '', saves: 0 }, { persist: 'pith-features-note' });

export default function StoreExample() {
  const save = (e) => {
    notes.note.value = e.target.value;
    notes.saves.value++;
  };

  return html`
    <label class="field-label" for="store-note">A note that survives reloads</label>
    <textarea id="store-note" class="input" rows="3" .value=${notes.note} @input=${save}></textarea>
    <p class="muted">Saved ${notes.saves} times. Reload the page, or open it in another tab.</p>
  `;
}
