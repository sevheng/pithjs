import { html, root } from 'mini';
import { router } from './router.js';
import './components/nav-bar.js';

// Wait for the first page's code, so prerendered HTML is swapped for the live page without a blank flash.
await router.ready;

root(() => {
  document.getElementById('app').replaceChildren(html`
    <a class="skip-link" href="#main">Skip to content</a>
    <nav-bar></nav-bar>
    <main id="main" class="page" tabindex="-1">${router.view}</main>
    <footer class="site-footer">
      Built with Mini · no dependencies · no build step
    </footer>
  `);
});
