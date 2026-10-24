import { html } from 'pith';
import { code, note, c } from '../ui.js';

export default () => html`
  <p>A small settings area with three pages that share one layout: a side nav, a display name field and a pretend
    Sign in button. The layout stays mounted while you move between the pages, so what you typed stays. One page,
    Account, needs sign-in: a guard in the router sends everyone else to Profile with a notice.</p>

  <h2 id="try">What to try</h2>
  <ul>
    <li>Type a name into "Display name" on <a href="/settings/profile">Profile</a>. The preview card says hello to it.</li>
    <li>Click Appearance, then Profile again. The name is still in the field and in the preview: the layout wasn't rebuilt.</li>
    <li>Open <a href="/settings/account">Account</a> while signed out. You land on ${c('/settings/profile?denied=1')}, which
      says "Sign in to open Account."</li>
    <li>Click Sign in, then Account: now it opens. Sign out there, and you stay on the page until you leave it.</li>
    <li>Reload the page. You're signed out again: the session isn't saved.</li>
  </ul>

  <h2 id="built">How it's built</h2>
  <ul>
    <li>${c('app/router.js')}: the three ${c('/settings/*')} routes share a layout, ${c('/settings')} redirects to Profile,
      Account is marked ${c('auth: true')}, and the guard checks that mark.</li>
    <li>${c('app/layouts/settings.js')}: the side nav, the display name (a signal of the layout's own) and the Sign in button.
      It wraps everything in ${c('<settings-context>')}.</li>
    <li>${c('app/components/settings-context.js')}: provides its value to every component inside it.</li>
    <li>${c('app/components/name-preview.js')}: injects that value and shows the name.</li>
    <li>${c('app/pages/settings-profile.js')}, ${c('settings-appearance.js')}, ${c('settings-account.js')}: the pages.
      Profile shows the notice when the URL has ${c('?denied=1')} and you're still signed out.</li>
    <li>${c('app/store.js')}: ${c('session')}, a store that isn't saved, so a reload signs you out.</li>
  </ul>

  <h2 id="pith">The Pith parts it uses</h2>
  <ul>
    <li><a href="/docs/router">Routing</a>: a layout shared by several routes, a redirect, and a guard.</li>
    <li><a href="/docs/components">Components</a>: ${c('provide()')} and ${c('inject()')} instead of passing the name down as a prop.</li>
    <li><a href="/docs/store">Shared state</a>: ${c('createStore()')} with a ${c('name')} and no ${c('persist')}.</li>
    <li><a href="/docs/signals">Signals</a>: the display name, shared by the layout and every page through one signal.</li>
  </ul>

  <h2 id="code">The interesting parts</h2>
  <h3 id="code-routes">A layout, and a guard</h3>
  <p>The layout downloads with the first settings page and stays mounted while you move between them. Guards are
    synchronous: this one returns a path to redirect to, or ${c('true')} to go ahead.</p>
  ${code(`
const settings = { load: () => import('./layouts/settings.js') };
// …
'/settings': { redirect: '/settings/profile' },
'/settings/profile': { title: 'Profile', layout: settings, load: () => import('./pages/settings-profile.js') },
'/settings/appearance': { title: 'Appearance', layout: settings, load: () => import('./pages/settings-appearance.js') },
'/settings/account': { title: 'Account', layout: settings, auth: true, load: () => import('./pages/settings-account.js') },
// …
// Routes marked \`auth: true\` need a signed-in visitor; others go to the profile page with a notice.
guard: (to) => (to.route.auth && !session.signedIn.value ? '/settings/profile?denied=1' : true),`, { file: 'app/router.js' })}
  ${note(html`A guard only decides what the browser shows. Anything private must be checked by the API too.`, 'warn')}

  <h3 id="code-context">provide and inject</h3>
  <p>The layout puts ${c('{ displayName }')} on ${c('<settings-context>')}, which provides it. Any component inside, on any
    page, can inject it. Because it's a signal, the preview updates as you type.</p>
  ${code(`
define(
  'settings-context',
  (props, ctx) => {
    provide('settings', props.value.value);
    return html\`\${ctx.children}\`;
  },
  { props: ['value'] }
);`, { file: 'app/components/settings-context.js' })}
  ${code(`
define('name-preview', () => {
  const settings = inject('settings', null);
  const name = () => settings?.displayName.value.trim() || 'friend';
  // …`, { file: 'app/components/name-preview.js' })}

  <h2 id="tests">Its tests</h2>
  <p>In ${c('tests/flows.js')}:</p>
  <ul>
    <li>settings: /settings opens Profile, and the layout keeps its state across pages</li>
    <li>settings: Account needs sign-in; the guard sends you to Profile with a notice</li>
  </ul>
`;
