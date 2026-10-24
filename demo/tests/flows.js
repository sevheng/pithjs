// User flows: what a person does, and what they should see. Run by `npm run check`.
// Find things by the name a person sees (button text, label, aria-label), not by CSS classes,
// so flows keep working when the styling changes.
import { flow } from 'pith/testing';

flow('home: counter goes up and the double follows', async (app) => {
  await app.go('/');
  await app.see('The essential core of a web app.');
  await app.see('Double: 10');
  await app.click('Increase');
  await app.see('Double: 12');
  await app.click('Reset');
  await app.see('Double: 0');
});

flow('navigation: links, title, and the back button', async (app) => {
  await app.go('/');
  await app.click('Features');
  await app.expectPath('/features');
  await app.see('Selecting a row');
  app.expect(app.document.title === 'Features · Pith', `title should be "Features · Pith", got "${app.document.title}"`);
  await app.back();
  await app.expectPath('/');
  await app.see('The essential core of a web app.');
});

flow('navigation: the old example pages redirect to Examples, About to Benchmarks', async (app) => {
  await app.go('/todos');
  await app.expectPath('/examples');
  await app.go('/about');
  await app.expectPath('/benchmarks');
  await app.see('This page, right now');
});

flow('examples: the hub lists each app with what it shows', async (app) => {
  await app.go('/examples');
  await app.see('Settings');
  await app.see('Layouts that stay mounted');
});

flow('navigation: unknown URL shows not found, with a way home', async (app) => {
  await app.go('/no-such-page');
  await app.see('Page not found');
  await app.click('Go home');
  await app.expectPath('/');
});

// Has the page downloaded the script for `name` (e.g. 'features')? Matches the source file
// (/app/pages/features.js) in development and the fingerprinted chunk (/assets/features-3f9a1c.js) in a build.
const downloaded = (app, name) =>
  app.window.performance.getEntriesByType('resource').some((r) => {
    const path = new URL(r.name).pathname;
    return path.endsWith(`/${name}.js`) || new RegExp(`/assets/${name}-[\\w-]+\\.js$`).test(path);
  });

flow('lazy loading: a page downloads its code only when it is needed', async (app) => {
  await app.go('/');
  await app.see('The essential core of a web app.');
  app.expect(downloaded(app, 'home'), 'home.js should be downloaded on /');
  app.expect(!downloaded(app, 'features'), 'features.js should not be downloaded before it is needed');
  await app.click('Features');
  await app.see('Selecting a row');
  app.expect(downloaded(app, 'features'), 'features.js should be downloaded after visiting /features');
});

flow('lazy loading: pointing at a link starts downloading its page', async (app) => {
  await app.go('/');
  await app.see('The essential core of a web app.');
  app.expect(!downloaded(app, 'benchmarks'), 'benchmarks.js should not be downloaded yet');
  const link = app.queryAll('nav a').find((a) => a.textContent.trim() === 'Benchmarks');
  link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await app.waitFor(() => downloaded(app, 'benchmarks'), 'hovering the Benchmarks link should prefetch benchmarks.js');
  await app.expectPath('/'); // prefetch must not navigate
});

flow('settings: /settings opens Profile, and the layout keeps its state across pages', async (app) => {
  await app.go('/examples');
  await app.click('Open Settings');
  await app.expectPath('/settings/profile');
  await app.see('Type a display name');
  app.expect(app.document.title === 'Profile · Pith', `title should be "Profile · Pith", got "${app.document.title}"`);
  await app.type('Display name', 'Ann');
  await app.see('Hello, Ann!'); // the page reads the layout's value via inject()
  await app.click('Appearance');
  await app.expectPath('/settings/appearance');
  await app.see('Switch between light and dark');
  app.expect(app.query('#display-name').value === 'Ann', 'the layout should stay mounted, keeping the typed name');
  await app.see('Hello, Ann!');
  await app.click('Profile');
  await app.see('Type a display name');
  app.expect(app.query('#display-name').value === 'Ann', 'the name should survive going back to Profile');
});

flow('settings: Account needs sign-in; the guard sends you to Profile with a notice', async (app) => {
  await app.go('/settings/account');
  await app.expectPath('/settings/profile');
  app.expect(app.window.location.search === '?denied=1', `the URL should have ?denied=1, got "${app.window.location.search}"`);
  await app.see('Sign in to open Account.');
  await app.click('Sign in');
  await app.notSee('Sign in to open Account.');
  await app.click('Account');
  await app.expectPath('/settings/account');
  await app.see('Only signed-in visitors get here.');
});

flow('features: the list links to each feature, with its live example and code', async (app) => {
  await app.go('/features');
  await app.see('Selecting a row');
  await app.click('Forms');
  await app.expectPath('/features/forms');
  await app.see('The code');
  app.expect(app.query('pre.code').textContent.includes("form({"), 'the code panel should show forms.js');
  await app.click('Routing →');
  await app.expectPath('/features/router');
});

flow('features: an unknown feature name says so', async (app) => {
  await app.go('/features/nope');
  await app.see('No such feature');
});

flow('features/signals: +1 updates the count and its double', async (app) => {
  await app.go('/features/signals');
  await app.click('+1');
  await app.click('+1');
  await app.see('2 × 2 = 4');
});

flow('features/lists: add and remove an item', async (app) => {
  await app.go('/features/lists');
  await app.type('New item', 'Milk');
  await app.click('Add');
  await app.see('Milk');
  await app.click('Remove Milk');
  await app.notSee('Milk');
  await app.see('Coffee');
});

flow('features/selector: a click re-runs 2 rows with selector(), every row without it', async (app) => {
  await app.go('/features/selector');
  await app.click('7');
  await app.see('Rows re-run by the last click: 1 of 100'); // first pick: only row 7 changes
  await app.click('9');
  await app.see('Rows re-run by the last click: 2 of 100');
  await app.click('Compare in every row instead');
  await app.click('12');
  await app.see('Rows re-run by the last click: 100 of 100');
});

flow('features/components: clicking a star sets the rating', async (app) => {
  await app.go('/features/components');
  await app.see('A tiny framework');
  await app.click('2 stars');
  app.expect(!!app.query('[aria-label="Rating: 2 of 5"]'), 'the rating should be 2 of 5');
});

flow('features/errors: a crash shows the fallback, and Try again recovers', async (app) => {
  await app.go('/features/errors');
  await app.click('Break it');
  await app.see('Crashed: Something broke inside this panel.');
  await app.see('This text is outside the panel');
  await app.click('Try again');
  await app.see('Working fine.');
});

flow('features/store: the note survives a reload', async (app) => {
  await app.go('/features/store');
  await app.type('A note that survives reloads', 'remember me');
  await app.go('/features/store');
  app.expect(app.query('#store-note').value === 'remember me', 'the note should be restored after a reload');
});

flow('features/resource: searching loads matching people from the API', async (app) => {
  await app.go('/features/resource');
  await app.see('Ada Lovelace');
  await app.type('Search people', 'grace');
  await app.see('Grace Hopper');
  await app.notSee('Ada Lovelace');
});

flow('features/paginated: Load more appends the next page', async (app) => {
  await app.go('/features/paginated');
  await app.see('Susan Kare');
  await app.notSee('Margaret Hamilton');
  await app.click('Load more');
  await app.see('Margaret Hamilton');
});

flow('features/forms: required fields, a server error, then success', async (app) => {
  await app.go('/features/forms');
  await app.click('Send');
  await app.see('This field is required');
  await app.type('Name', 'Ann');
  await app.type('Email', 'ann@blocked.test');
  await app.type('Message', 'Hello there, Pith!');
  await app.click('Send');
  await app.see('This address is blocked');
  await app.type('Email', 'ann@example.com');
  await app.click('Send');
  await app.see('Thanks, Ann!');
});

flow('features/router: a tab is kept in the ?query', async (app) => {
  await app.go('/features/router');
  await app.click('Tab two');
  await app.see('Showing tab two');
  app.expect(app.window.location.search === '?tab=two', `the URL should have ?tab=two, not ${app.window.location.search}`);
});

flow('features/dialogs: confirm, then a toast', async (app) => {
  await app.go('/features/dialogs');
  await app.click('Confirm…');
  await app.click('Delete');
  await app.see('Deleted');
});

// ---------- Chat (/chat) ----------

flow('chat: a room shows rich messages grouped by sender, and the rooms list', async (app) => {
  await app.go('/chat/general');
  await app.see('Ada Lovelace');
  await app.see('Selecting a row now re-runs 2 rows');
  app.expect(!!app.query('.msg-code code'), 'a code block should be shown');
  app.expect(!!app.query('.msg-file'), 'a file card should be shown');
  app.expect(!!app.query('.msg-link'), 'a link preview should be shown');
  app.expect(!!app.query('.msg-quote'), 'a quoted reply should be shown');
  await app.see('# design');
  await app.click('Copy code');
});

flow('chat: sending a message shows it, and the bot in #help answers', async (app) => {
  await app.go('/chat/help');
  await app.type('Message #help', 'How do forms work?');
  await app.pressEnter();
  await app.see('How do forms work?');
  await app.see('is typing');
  await app.see('Use form()');
});

// Messages sent by flows stay on the dev server while it runs, so flows don't assume a room is empty
// except #random, which no flow writes to.
flow('chat: an empty room says so', async (app) => {
  await app.go('/chat/random');
  await app.see('No messages yet.');
});

flow('chat: a message the server rejects shows Not sent, and can be deleted or sent', async (app) => {
  await app.go('/chat/general');
  const note = `please /fail ${Date.now()}`;
  await app.type('Message #general', note);
  await app.click('Send');
  await app.see('Not sent');
  await app.click('Delete');
  await app.notSee('Not sent');
  const hello = `hello ${Date.now()}`;
  await app.type('Message #general', hello);
  await app.click('Send');
  await app.see(hello);
  await app.notSee('Sending…');
});

flow('chat: replies and reactions', async (app) => {
  await app.go('/chat/design');
  await app.see('Love it.');
  const reply = app.queryAll('button[aria-label="Reply"]')[1];
  reply.click();
  await app.see('Replying to');
  await app.click('Cancel reply');
  await app.notSee('Replying to');
  await app.click('😍 2, react');
  app.expect(!!app.query('[aria-label="😍 3, remove your reaction"]'), 'reacting should add yours');
});

flow('chat: an unknown room says so', async (app) => {
  await app.go('/chat/nope');
  await app.see('No such room.');
});

flow('chat: after switching rooms there is one composer, and sending works', async (app) => {
  await app.go('/chat/general');
  await app.see('Selecting a row now re-runs 2 rows');
  await app.click('[href="/chat/design"]');
  await app.see('Love it.');
  await app.click('[href="/chat/general"]');
  await app.see('Selecting a row now re-runs 2 rows');
  app.expect(app.queryAll('form.composer').length === 1, `one composer, found ${app.queryAll('form.composer').length}`);
  const text = `after switching ${Date.now()}`;
  await app.type('Message #general', text);
  await app.pressEnter();
  await app.see(text);
});

flow('chat/#firehose: thousands of messages, only the newest on screen, Show older and Flood', async (app) => {
  await app.go('/chat/firehose?count=1000');
  await app.see('1,000 messages · 200 on screen');
  app.expect(app.queryAll('.msg-row').length === 200, `200 rows on screen, found ${app.queryAll('.msg-row').length}`);
  await app.click('Show older (800 more)');
  await app.see('700 on screen');
  await app.click('Flood · 100/s');
  await app.waitFor(() => app.queryAll('.msg-row').length > 700, 'the flood should add messages');
  await app.click('Stop flood');
  await app.click('10,000');
  await app.see('10,000 messages · 200 on screen');
  app.expect(app.window.location.search === '', 'the default size has no ?count=');
  // The size changed through the URL (like Back): still only the newest 200 on screen, not every message.
  app.window.history.pushState(null, '', '/chat/firehose?count=1000');
  app.window.dispatchEvent(new PopStateEvent('popstate'));
  await app.see('1,000 messages · 200 on screen');
  app.expect(app.queryAll('.msg-row').length === 200, `200 rows after a URL change, found ${app.queryAll('.msg-row').length}`);
});

// ---------- Dashboard (/dashboard) ----------
// The dev API makes the same numbers on every run (a fixed seed and a fixed last day), so flows can name them.

const revenue = (app) => app.query('[data-kpi="revenue"] .value')?.textContent.trim();

flow('dashboard: KPIs, charts and orders load; a new range is kept in the URL and changes the numbers', async (app) => {
  await app.go('/dashboard');
  await app.see('$86,962');
  await app.see('Orders by channel');
  await app.see('Showing 1–10 of 1,022');
  await app.waitFor(() => !!app.query('svg[role="img"][aria-label^="Revenue per day"]'), 'the revenue chart should have a text summary');
  await app.click('7 days');
  await app.waitFor(() => revenue(app) === '$19,256', `7 days of revenue should be $19,256, got ${revenue(app)}`);
  app.expect(app.window.location.search === '?range=7', `the URL should have ?range=7, got "${app.window.location.search}"`);
  await app.see('Showing 1–10 of 237');
  await app.click('Refresh');
  await app.see('Updated just now');
  await app.click('30 days');
  await app.waitFor(() => revenue(app) === '$86,962', 'back to 30 days');
  app.expect(app.window.location.search === '', 'the default range has no ?range=');
});

flow('dashboard: sorting the orders by a column (aria-sort follows)', async (app) => {
  await app.go('/dashboard');
  await app.see('Showing 1–10 of 1,022');
  const sorted = () => app.query('th[aria-sort="ascending"], th[aria-sort="descending"]');
  app.expect(sorted()?.textContent.trim() === 'Date' && sorted().getAttribute('aria-sort') === 'descending', 'newest first by default');
  await app.click('Total');
  await app.waitFor(() => app.window.location.search === '?sort=total', 'the sort is kept in the URL');
  app.expect(sorted()?.textContent.trim() === 'Total' && sorted().getAttribute('aria-sort') === 'descending', 'Total sorts biggest first');
  const firstTotal = () => app.query('.orders-table tbody tr td.num')?.textContent.trim();
  await app.waitFor(() => firstTotal() === '$480.00', `the biggest order first, got ${firstTotal()}`);
  await app.click('Total');
  await app.waitFor(() => sorted()?.getAttribute('aria-sort') === 'ascending', 'a second click reverses it');
  await app.waitFor(() => firstTotal() === '$22.00', `the smallest order first, got ${firstTotal()}`);
});

flow('dashboard: a status filter, and a search that matches nothing', async (app) => {
  await app.go('/dashboard');
  await app.see('Showing 1–10 of 1,022');
  await app.click('[data-status="refunded"]');
  await app.see('Showing 1–10 of 34');
  app.expect(app.window.location.search === '?status=refunded', `the filter is kept in the URL, got "${app.window.location.search}"`);
  app.expect(app.queryAll('.orders-table tbody .status-pill').every((p) => p.textContent.trim() === 'Refunded'), 'only refunded orders');
  await app.type('Search orders by customer', 'Nobody Here');
  await app.see('No orders match.');
  await app.see('Nothing refunded for “Nobody Here” in the last 30 days.');
  await app.click('Clear filters');
  await app.see('Showing 1–10 of 1,022');
  app.expect(app.query('#order-search').value === '', 'the search box is cleared too');
});

flow('dashboard: paging through the orders', async (app) => {
  await app.go('/dashboard');
  await app.see('Page 1 of 103');
  app.expect(app.query('.pager-buttons button').disabled, 'Previous is disabled on the first page');
  await app.click('Next');
  await app.see('Showing 11–20 of 1,022');
  await app.see('Page 2 of 103');
  app.expect(app.window.location.search === '?page=2', `the page is kept in the URL, got "${app.window.location.search}"`);
  await app.click('Previous');
  await app.see('Showing 1–10 of 1,022');
});

flow('dashboard: selecting an order opens its details, Close returns to the table', async (app) => {
  await app.go('/dashboard');
  await app.see('Showing 1–10 of 1,022');
  await app.click('Open order 15465');
  await app.see('Order #15465');
  await app.see('ann.haddad@example.com');
  await app.see('1 × Terracotta pot');
  app.expect(app.queryAll('.orders-table tr.selected').length === 1, 'exactly one row is marked selected');
  await app.click('Open order 15463');
  await app.see('Order #15463');
  app.expect(app.queryAll('.orders-table tr.selected').length === 1, 'still one selected row after picking another');
  await app.click('Close order details');
  await app.notSee('Order #15463');
  app.expect(!app.query('.orders-table tr.selected'), 'no row is selected after closing');
});

flow('dashboard: when the API fails, each part says so and offers a way out', async (app) => {
  await app.go('/dashboard?range=fail');
  await app.see("Couldn't load the numbers.");
  await app.see("Couldn't load the orders.");
  await app.click('Show the last 30 days');
  await app.see('$86,962');
  await app.see('Showing 1–10 of 1,022');
});
