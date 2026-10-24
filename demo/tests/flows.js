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

// ---------- Benchmarks (/benchmarks) ----------
import bench from '../app/data/benchmarks.js';

// The chart whose caption starts with `title`, and its row for one framework (e.g. 'react').
const benchRow = (app, title, impl) => {
  const chart = app.queryAll('.bar-chart').find((f) => f.querySelector('figcaption')?.textContent.trim().startsWith(title));
  return chart?.querySelector(`[data-impl="${impl}"]`) ?? null;
};
const benchText = (el) => (el?.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

flow('benchmarks: each view shows its charts, and the choice is kept in ?view=', async (app) => {
  await app.go('/benchmarks');
  await app.see('Loading on a slow phone');
  await app.waitFor(() => benchRow(app, 'Ready', 'pith'), 'the Load view should chart Ready');
  await app.click('Runtime');
  await app.see('Pith is fastest or within the ±10% noise');
  app.expect(app.window.location.search === '?view=runtime', `the URL should have ?view=runtime, got "${app.window.location.search}"`);
  await app.waitFor(() => benchRow(app, 'Swap two rows', 'vue'), 'the Runtime view should chart swapping rows');
  await app.click('Memory');
  await app.see('With 10,000 rows Pith holds');
  await app.waitFor(() => benchRow(app, '10,000 rows', 'react'), 'the Memory view should chart 10,000 rows');
  await app.click('Size');
  await app.see("The CRM's start page needs");
  app.expect(app.queryAll('.bar-chart').length === 3, `Size should chart 3 pages, found ${app.queryAll('.bar-chart').length}`);
  await app.click('Load');
  app.expect(app.window.location.search === '', 'Load is the default, so it has no ?view=');
  await app.see('Loading on a slow phone');
  await app.see('This page, right now');
});

flow('benchmarks: ?view= and ?protocol= survive a reload', async (app) => {
  await app.go('/benchmarks');
  await app.click('Memory');
  await app.go(`/benchmarks${app.window.location.search}`);
  await app.see('With 10,000 rows Pith holds');
  const pressed = app.query('[aria-label="Benchmark"] [aria-pressed="true"]')?.textContent.trim();
  app.expect(pressed === 'Memory', `Memory should be the selected view after a reload, got "${pressed}"`);
  await app.click('Load');
  await app.click('HTTP/2');
  app.expect(app.window.location.search === '?protocol=h2', `the URL should have ?protocol=h2, got "${app.window.location.search}"`);
  await app.go('/benchmarks?protocol=h2');
  const want = `React ${bench.load.h2.todo.react.ready.toLocaleString('en-US')} ms`;
  await app.waitFor(() => benchText(benchRow(app, 'Ready', 'react')) === want, `after a reload the first Ready chart should read "${want}" (HTTP/2)`);
});

flow('benchmarks: the numbers shown match the measurements, and the best is marked', async (app) => {
  await app.go('/benchmarks?view=runtime');
  const update = bench.runtime['update every 10th row'];
  await app.waitFor(() => benchRow(app, 'Update every 10th row', 'react'), 'the update chart should be shown');
  const react = benchRow(app, 'Update every 10th row', 'react');
  app.expect(benchText(react) === `React ${update.react} ms`, `React's row should read "React ${update.react} ms", got "${benchText(react)}"`);
  const max = Math.max(...Object.values(update));
  const width = Number(react.querySelector('.bar').style.getPropertyValue('--w'));
  app.expect(Math.abs(width - update.react / max) < 0.001, `React's bar should be ${update.react}/${max} wide, got ${width}`);
  const best = Object.entries(update).sort((a, b) => a[1] - b[1])[0][0];
  app.expect(benchText(benchRow(app, 'Update every 10th row', best)).endsWith('Best'), `${best} has the lowest time, so it should be marked Best`);
  await app.see('Where Pith is behind');
  await app.see(`Pith ${update.pith} ms, React ${update.react} ms`);
});

// ---------- Inbox (/inbox) ----------
// The dev server keeps what flows change, so flows that move or delete mail work on messages they sent
// themselves (unique subjects), and the fixtures in the Inbox are only read and starred (then unstarred).

/** Send a message from the Compose dialog; it lands in Sent. */
async function sendMail(app, subject, to = 'ann@example.com') {
  await app.click('Compose');
  await app.see('New message');
  await app.type('To', to);
  await app.type('Subject', subject);
  await app.type('Message', 'Hello from a flow.');
  await app.click('Send message');
}

flow('inbox: /inbox opens the Inbox with folders, counts and nothing selected', async (app) => {
  await app.go('/inbox');
  await app.expectPath('/inbox/inbox');
  await app.see('Mail sent to you');
  await app.see('No message selected');
  app.expect(app.queryAll('.folder-link').length === 5, 'five folders');
  app.expect(app.queryAll('.mail-row').length === 20, `the first page has 20 messages, found ${app.queryAll('.mail-row').length}`);
  await app.click('[href="/inbox/sent"]');
  await app.expectPath('/inbox/sent');
  await app.see('Mail you sent');
});

flow('inbox: opening a message shows it, keeps ?m= in the URL, and marks it read', async (app) => {
  await app.go('/inbox/inbox?q=Lisbon');
  await app.see('Your trip to Lisbon is confirmed');
  await app.click('.mail-open');
  await app.see('Booking reference: SKY-7Q2LX');
  app.expect(/[?&]m=\d+/.test(app.window.location.search), `the URL should have ?m=, not ${app.window.location.search}`);
  app.expect(app.query('.mail-row.selected'), 'the open message is marked in the list');
  app.expect(!app.query('.mail-row.unread'), 'an opened message is no longer bold');
  await app.back(); // opening a message is a history step (the phone's Back goes back to the list)
  await app.see('No message selected');
  await app.expectPath('/inbox/inbox');
});

flow('inbox: Load more adds the next page, then says that is all', async (app) => {
  await app.go('/inbox/inbox');
  await app.see('Load more');
  await app.click('Load more');
  await app.waitFor(() => app.queryAll('.mail-row').length > 20, 'Load more should add messages');
  await app.see('That’s all');
});

flow('inbox: search is kept in ?q=, and no results says so', async (app) => {
  await app.go('/inbox/inbox');
  await app.type('Search mail', 'invoice');
  await app.see('Your invoice for October is ready');
  await app.notSee('Coffee next week?');
  app.expect(app.window.location.search === '?q=invoice', `the URL should have ?q=invoice, not ${app.window.location.search}`);
  await app.type('Search mail', 'zebra crossing');
  await app.see('No messages match "zebra crossing"');
  await app.click('Clear search');
  await app.see('Coffee next week?');
});

flow('inbox: a list that fails to load says so, with Try again', async (app) => {
  await app.go('/inbox/inbox?q=/fail');
  await app.see("Couldn't load Inbox");
  await app.see('Try again');
});

flow('inbox: starring a message, then unstarring it', async (app) => {
  await app.go('/inbox/inbox?q=Coffee');
  const star = () => app.query('[aria-label="Star: Coffee next week?"]');
  await app.waitFor(star, 'the star button');
  const before = star().getAttribute('aria-pressed');
  await app.click('Star: Coffee next week?');
  app.expect(star().getAttribute('aria-pressed') !== before, 'the star should toggle at once');
  await app.click('Star: Coffee next week?');
  app.expect(star().getAttribute('aria-pressed') === before, 'and toggle back');
});

flow('inbox: compose checks fields here, and the server rejects @blocked.test (422)', async (app) => {
  await app.go('/inbox/inbox');
  await app.click('Compose');
  await app.click('Send message');
  await app.see('Add at least one address');
  await app.see('Write a message');
  await app.type('To', 'not an email');
  await app.see('"not an email" isn\'t an email address');
  await sendMail(app, `Blocked ${Date.now()}`, 'ann@example.com, spam@blocked.test').catch(() => {});
  await app.see("blocked.test doesn't accept mail");
  app.expect(app.query('dialog[open]'), 'the dialog stays open, with what was typed');
});

flow('inbox: a sent message shows in Sent', async (app) => {
  await app.go('/inbox/inbox');
  const subject = `Hello ${Date.now()}`;
  await sendMail(app, subject);
  await app.see('Sent to ann@example.com');
  await app.click('[href="/inbox/sent"]');
  await app.see('Mail you sent');
  await app.see(subject);
});

flow('inbox: delete asks first, then Undo brings the message back', async (app) => {
  const subject = `Delete me ${Date.now()}`;
  await app.go('/inbox/sent');
  await sendMail(app, subject);
  await app.see('Sent to ann@example.com');
  await app.type('Search mail', subject);
  await app.see(subject);
  await app.click(`Select: ${subject}`);
  await app.see('1 selected');
  await app.click('Delete');
  await app.see(`Move "${subject}" to Trash?`);
  await app.click('Cancel');
  await app.see('1 selected');
  await app.click('Delete');
  await app.click('Move to Trash');
  await app.see('Moved to Trash');
  await app.see(`No messages match "${subject}"`);
  await app.click('Undo');
  await app.see('Message restored');
  await app.see(subject);
});

flow('inbox: bulk archive moves the checked messages to Archive', async (app) => {
  const tag = `Bulk ${Date.now()}`;
  await app.go('/inbox/sent');
  await sendMail(app, `${tag} one`);
  await app.see('Sent to ann@example.com');
  await sendMail(app, `${tag} two`);
  await app.see(`${tag} two`);
  await app.type('Search mail', tag);
  await app.waitFor(() => app.queryAll('.mail-row').length === 2, 'both sent messages are listed');
  await app.click('Select all');
  await app.see('2 selected');
  await app.click('Archive');
  await app.see('Archived 2 messages');
  await app.click('[href="/inbox/archive"]');
  await app.expectPath('/inbox/archive');
  await app.see('Out of the inbox');
  await app.type('Search mail', tag);
  await app.waitFor(() => app.queryAll('.mail-row').length === 2, 'both are in Archive');
});

flow('inbox: an unknown folder says so', async (app) => {
  await app.go('/inbox/spam');
  await app.see('No such folder');
  await app.click('Go to Inbox');
  await app.expectPath('/inbox/inbox');
});
