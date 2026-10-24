import { html } from 'pith';
import { theme, setTheme } from '../store.js';

const CHOICES = /** @type {const} */ ([['system', 'Match the device', 'Light or dark, the way your device is set'], ['light', 'Light', 'Always light'], ['dark', 'Dark', 'Always dark']]);

// The theme, for the whole site: the same setting as the moon/sun button in the header (app/store.js), saved.
export default function ShopAccountAppearance() {
  return html`
    <h1>Appearance</h1>
    <p class="muted">Pick how the whole site looks. Your choice is saved in this browser.</p>
    <fieldset class="card choice-list">
      <legend class="field-label">Theme</legend>
      ${CHOICES.map(([id, label, text]) => html`
        <label class="choice">
          <input type="radio" name="theme" value=${id} .checked=${() => theme.value === id} @change=${() => setTheme(id)}>
          <span class="choice-text"><strong>${label}</strong><span class="muted note">${text}</span></span>
          <span class=${`theme-chip ${id}`} aria-hidden="true"></span>
        </label>`)}
    </fieldset>
  `;
}
