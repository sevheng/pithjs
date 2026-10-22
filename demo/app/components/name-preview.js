import { define, html, inject } from 'mini';

// Shows the display name typed in the settings layout, provided by <settings-context>.
define('name-preview', () => {
  const settings = inject('settings', null);
  const name = () => settings?.displayName.value.trim() || 'friend';

  return html`
    <div class="card name-preview">
      <span class="muted small">Preview</span>
      <p class="name-preview-text">Hello, ${name}!</p>
    </div>
  `;
});
