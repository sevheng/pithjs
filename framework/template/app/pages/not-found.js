import { html } from 'pith';
import { statusPage } from '../brand.js';

export default function NotFoundPage() {
  return statusPage({
    code: '404',
    title: 'Page not found',
    text: html`Nothing lives at <code>${location.pathname}</code>. It may have moved, or the link has a typo.`,
    actions: html`<a class="btn primary" href="/">Go home</a>`,
  });
}
