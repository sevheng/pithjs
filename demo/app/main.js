import { html, root, computed } from 'pith';
import { router } from './router.js';
import { apps } from './apps.js';
import './components/nav-bar.js';

// The example apps open full width, under a bar that leads back to their docs page.
const section = (href) => `/${href.split('/')[1]}`;
const openApp = computed(() => apps.find((a) => router.path.value.startsWith(section(a.href))) ?? null);
const appBar = () => {
  const app = openApp.value;
  return app ? html`
    <nav class="app-bar" aria-label="Breadcrumb">
      <a href="/docs/examples">← Docs</a><span class="muted" aria-hidden="true">/</span>
      <a href="/docs/examples">Examples</a><span class="muted" aria-hidden="true">/</span>
      <span aria-current="page">${app.name}</span>
      <a class="app-bar-how" href=${`/docs/${app.name.toLowerCase()}`}>How it's built</a>
    </nav>` : null;
};

// Wait for the first page's code, so prerendered HTML is swapped for the live page without a blank flash.
await router.ready;

root(() => {
  document.getElementById('app').replaceChildren(html`
    <a class="skip-link" href="#main">Skip to content</a>
    <nav-bar></nav-bar>
    <main id="main" class="page" tabindex="-1">${appBar}${router.view}</main>
    <footer class="site-footer">
      Built with Pith · no runtime dependencies · no build step
    </footer>
  `);
});
