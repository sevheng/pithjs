import { html } from 'pith';
import { router } from '../router.js';

// The router keeps the path and the ?query in signals. setQuery() changes the URL without a re-render,
// so a reload or a shared link keeps the choice. Links are plain <a href>.
export default function RouterExample() {
  const tabs = ['one', 'two', 'three'];
  const tab = () => router.query.value.tab ?? 'one';

  return html`
    <p>Path: <code>${router.path}</code> · Query: <code>${() => new URLSearchParams(router.query.value).toString() || '(none)'}</code></p>
    <div class="row" role="group" aria-label="Pick a tab">
      ${tabs.map((t) => html`
        <button class="chip" type="button" aria-pressed=${() => String(tab() === t)}
                @click=${() => router.setQuery({ tab: t })}>Tab ${t}</button>`)}
    </div>
    <p>Showing tab <strong>${tab}</strong>. Reload: it stays.</p>
    <p class="row">
      <a href="/team/2">A :param route (/team/2)</a>
      <a href="/settings/account">A guarded route (needs sign-in)</a>
    </p>
  `;
}
