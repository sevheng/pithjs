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
  await app.click('Docs');
  await app.expectPath('/docs');
  await app.see('What Pith is, what it does for you');
  await app.waitFor(() => app.document.title === 'Introduction · Pith', `title should be "Introduction · Pith", got "${app.document.title}"`);
  await app.back();
  await app.expectPath('/');
  await app.see('The essential core of a web app.');
});

flow('navigation: older URLs redirect into the docs', async (app) => {
  await app.go('/features/forms');
  await app.expectPath('/docs/forms');
  await app.go('/todos');
  await app.expectPath('/docs/examples');
  await app.go('/about');
  await app.expectPath('/docs/benchmarks');
  await app.see('This page, right now');
});

flow('docs: the sidebar moves between pages, keeps its place, and each page has its title', async (app) => {
  await app.go('/docs');
  await app.click('Forms');
  await app.expectPath('/docs/forms');
  await app.see('Validation, accessible errors');
  await app.waitFor(() => app.document.title === 'Forms · Pith', `title should be "Forms · Pith", got "${app.document.title}"`);
  app.expect(app.query('.docs-side [aria-current="page"]')?.textContent === 'Forms', 'the sidebar marks the open page');
  await app.click('Next: Animation');
  await app.expectPath('/docs/animation');
});

flow('examples: the docs list each app with what it shows, and an app links back to its docs', async (app) => {
  await app.go('/docs/examples');
  await app.see('Every product page prerendered');
  await app.click('Open Kanban');
  await app.expectPath('/kanban');
  await app.see('Reset board'); // the board, not the examples page it came from
  await app.click('How it\'s built');
  await app.expectPath('/docs/kanban');
});

flow('navigation: unknown URL shows not found, with a way home', async (app) => {
  await app.go('/no-such-page');
  await app.see('Page not found');
  await app.click('Go home');
  await app.expectPath('/');
});

// Has the page downloaded the script for `name` (e.g. 'doc')? Matches the source file
// (/app/pages/doc.js) in development and the fingerprinted chunk (/assets/doc-3f9a1c.js) in a build.
const downloaded = (app, name) =>
  app.window.performance.getEntriesByType('resource').some((r) => {
    const path = new URL(r.name).pathname;
    return path.endsWith(`/${name}.js`) || new RegExp(`/assets/${name}-[\\w-]+\\.js$`).test(path);
  });

flow('lazy loading: a page downloads its code only when it is needed', async (app) => {
  await app.go('/');
  await app.see('The essential core of a web app.');
  app.expect(downloaded(app, 'home'), 'home.js should be downloaded on /');
  app.expect(!downloaded(app, 'doc'), 'doc.js should not be downloaded before it is needed');
  await app.click('Docs');
  await app.see('What Pith is, what it does for you');
  app.expect(downloaded(app, 'doc'), 'doc.js should be downloaded after visiting /docs');
});

flow('lazy loading: pointing at a link starts downloading its page', async (app) => {
  await app.go('/');
  await app.see('The essential core of a web app.');
  app.expect(!downloaded(app, 'doc'), 'doc.js should not be downloaded yet');
  const link = app.queryAll('nav a').find((a) => a.textContent.trim() === 'Docs');
  link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await app.waitFor(() => downloaded(app, 'doc'), 'hovering the Docs link should prefetch doc.js');
  await app.expectPath('/'); // prefetch must not navigate
});

// Every docs page opens with its title and no warnings (npm run check samples only one /docs/:page URL).
// The list comes from the sidebar (app/docs/index.js draws it): flows can't import app/ files, because a build
// (npm run check -- --build) serves only dist/, where they're bundled.
flow('docs: every page opens, with its title in the heading', async (app) => {
  await app.go('/docs');
  const pages = app.queryAll('.docs-side .docs-link').map((a) => [a.getAttribute('href'), a.textContent.trim()]);
  app.expect(pages.length > 20, `the sidebar should list every docs page, got ${pages.length}`);
  for (const [href, title] of pages) {
    await app.go(href);
    await app.waitFor(() => app.query('h1')?.textContent.trim() === title && !app.query('.doc-skeleton'), `${href} should show "${title}"`);
  }
});

flow('docs: a feature page has its live example and its code', async (app) => {
  await app.go('/docs/forms');
  await app.see('Try it');
  await app.see('The code');
  app.expect(app.query('[aria-label="Source of app/examples/forms.js"]').textContent.includes('form({'), 'the code panel should show forms.js');
});

flow('docs: an unknown page says so', async (app) => {
  await app.go('/docs/nope');
  await app.see('No such page');
});

flow('features/signals: +1 updates the count and its double', async (app) => {
  await app.go('/docs/signals');
  await app.click('+1');
  await app.click('+1');
  await app.see('2 × 2 = 4');
});

flow('features/lists: add and remove an item', async (app) => {
  await app.go('/docs/lists');
  await app.type('New item', 'Milk');
  await app.click('Add');
  await app.see('Milk');
  await app.click('Remove Milk');
  await app.notSee('Milk');
  await app.see('Coffee');
});

flow('features/selector: a click re-runs 2 rows with selector(), every row without it', async (app) => {
  await app.go('/docs/selector');
  await app.click('7');
  await app.see('Rows re-run by the last click: 1 of 100'); // first pick: only row 7 changes
  await app.click('9');
  await app.see('Rows re-run by the last click: 2 of 100');
  await app.click('Compare in every row instead');
  await app.click('12');
  await app.see('Rows re-run by the last click: 100 of 100');
});

flow('features/components: clicking a star sets the rating', async (app) => {
  await app.go('/docs/components');
  await app.see('A tiny framework');
  await app.click('2 stars');
  app.expect(!!app.query('[aria-label="Rating: 2 of 5"]'), 'the rating should be 2 of 5');
});

flow('features/errors: a crash shows the fallback, and Try again recovers', async (app) => {
  await app.go('/docs/errors');
  await app.click('Break it');
  await app.see('Crashed: Something broke inside this panel.');
  await app.see('This text is outside the panel');
  await app.click('Try again');
  await app.see('Working fine.');
});

flow('features/store: the note survives a reload', async (app) => {
  await app.go('/docs/store');
  await app.type('A note that survives reloads', 'remember me');
  await app.go('/docs/store');
  app.expect(app.query('#store-note').value === 'remember me', 'the note should be restored after a reload');
});

flow('features/resource: searching loads matching people from the API', async (app) => {
  await app.go('/docs/resource');
  await app.see('Ada Lovelace');
  await app.type('Search people', 'grace');
  await app.see('Grace Hopper');
  await app.notSee('Ada Lovelace');
});

flow('features/paginated: Load more appends the next page', async (app) => {
  await app.go('/docs/paginated');
  await app.see('Susan Kare');
  await app.notSee('Margaret Hamilton');
  await app.click('Load more');
  await app.see('Margaret Hamilton');
});

flow('features/forms: required fields, a server error, then success', async (app) => {
  await app.go('/docs/forms');
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
  await app.go('/docs/router');
  await app.click('Tab two');
  await app.see('Showing tab two');
  app.expect(app.window.location.search === '?tab=two', `the URL should have ?tab=two, not ${app.window.location.search}`);
});

flow('features/dialogs: confirm, then a toast', async (app) => {
  await app.go('/docs/dialogs');
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
// The measurements, to compare with what the page shows. Only in development: a build doesn't serve app/ as
// source files (they're bundled into dist/), so there the comparisons are skipped and the rest still runs.
const bench = await import('../app/data/benchmarks.js').then((m) => m.default, () => null);

// The chart whose caption starts with `title`, and its row for one framework (e.g. 'react').
const benchRow = (app, title, impl) => {
  const chart = app.queryAll('.bar-chart').find((f) => f.querySelector('figcaption')?.textContent.trim().startsWith(title));
  return chart?.querySelector(`[data-impl="${impl}"]`) ?? null;
};
const benchText = (el) => (el?.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

flow('benchmarks: each view shows its charts, and the choice is kept in ?view=', async (app) => {
  await app.go('/docs/benchmarks');
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
  await app.go('/docs/benchmarks');
  await app.click('Memory');
  await app.go(`/docs/benchmarks${app.window.location.search}`);
  await app.see('With 10,000 rows Pith holds');
  const pressed = app.query('[aria-label="Benchmark"] [aria-pressed="true"]')?.textContent.trim();
  app.expect(pressed === 'Memory', `Memory should be the selected view after a reload, got "${pressed}"`);
  await app.click('Load');
  await app.click('HTTP/2');
  app.expect(app.window.location.search === '?protocol=h2', `the URL should have ?protocol=h2, got "${app.window.location.search}"`);
  await app.go('/docs/benchmarks?protocol=h2');
  if (!bench) return;
  const want = `React ${bench.load.h2.todo.react.ready.toLocaleString('en-US')} ms`;
  await app.waitFor(() => benchText(benchRow(app, 'Ready', 'react')) === want, `after a reload the first Ready chart should read "${want}" (HTTP/2)`);
});

flow('benchmarks: the numbers shown match the measurements, and the best is marked', async (app) => {
  await app.go('/docs/benchmarks?view=runtime');
  if (!bench) return;
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
  // The list loads after the page shows: wait for it, not just its frame (slower browsers lose that race).
  await app.waitFor(() => app.queryAll('.mail-row').length === 20, `the first page has 20 messages, found ${app.queryAll('.mail-row').length}`);
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

// ---------- Kanban (/kanban) ----------

// Adds a card to To do with a unique title, and returns the title.
async function addKanbanCard(app, prefix) {
  const title = `${prefix} ${Date.now()}`;
  await app.go('/kanban');
  await app.see('Dark mode for the docs site');
  await app.click('Add a card to To do');
  await app.type('New card in To do', title);
  await app.click('Add card');
  await app.waitFor(() => kanbanColumnOf(app, title) === 'todo', 'the new card should be in To do');
  return title;
}
const kanbanColumnOf = (app, title) =>
  app.queryAll('.kcard').find((el) => el.querySelector('.kcard-title')?.textContent.trim() === title)?.closest('.kcol')?.dataset.col;
const kanbanCount = (app, column) => app.query(`[aria-labelledby="kcol-${column}"] .kcol-count`)?.textContent.trim();

flow('kanban: the board shows its columns, counts, labels and overdue cards', async (app) => {
  await app.go('/kanban');
  await app.see('In progress');
  await app.see('Router drops the hash on redirect');
  await app.see('Overdue');
  await app.see('3 overdue');
  app.expect(kanbanCount(app, 'todo') === '5', `To do should count 5 cards, got ${kanbanCount(app, 'todo')}`);
});

flow('kanban: an empty title is refused, a new card is added to its column', async (app) => {
  await app.go('/kanban');
  await app.click('Add a card to Review');
  await app.click('Add card');
  await app.see('Give the card a title');
  const title = `Review me ${Date.now()}`;
  await app.type('New card in Review', title);
  await app.click('Add card');
  await app.waitFor(() => kanbanColumnOf(app, title) === 'review', 'the card should be in Review');
  app.expect(kanbanCount(app, 'review') === '4', `Review should count 4 cards, got ${kanbanCount(app, 'review')}`);
});

flow('kanban: a card moves by keyboard, between and within columns', async (app) => {
  const title = await addKanbanCard(app, 'Move me');
  await app.click(`Move "${title}" right`);
  await app.waitFor(() => kanbanColumnOf(app, title) === 'doing', 'the card should move to In progress');
  await app.waitFor(() => app.document.activeElement?.getAttribute('aria-label') === `Move "${title}" right`, 'focus should stay on its Move right button');
  await app.hear(`Moved "${title}" to In progress`);
  const titles = () => app.queryAll('[aria-labelledby="kcol-doing"] .kcard-title').map((b) => b.textContent.trim());
  await app.click(`Move "${title}" up`);
  await app.waitFor(() => titles().indexOf(title) === titles().length - 2, 'the card should move up one place');
  await app.click(`Move "${title}" left`);
  await app.waitFor(() => kanbanColumnOf(app, title) === 'todo', 'the card should move back to To do');
});

flow('kanban: edit a card in its dialog', async (app) => {
  const title = await addKanbanCard(app, 'Edit me');
  await app.click(title);
  await app.see('Edit card');
  const edited = `${title} (edited)`;
  await app.type('Title', edited);
  await app.type('Description', 'Now with a description.');
  await app.select('Label', 'Bug');
  await app.select('Assignee', 'Grace Hopper');
  await app.select('Column', 'Review');
  await app.click('Save changes');
  await app.see('Card saved');
  await app.see(edited);
  await app.see('Now with a description.');
  await app.waitFor(() => kanbanColumnOf(app, edited) === 'review', 'the card should be in Review');
});

flow('kanban: filter by label and person, kept in the URL, then clear', async (app) => {
  await app.go('/kanban');
  await app.click('Bug');
  await app.see('Showing 3 of 14 cards');
  await app.notSee('Dark mode for the docs site');
  await app.click('.kchip[style*="label-docs"]'); // not the Docs link in the site nav
  app.expect(app.window.location.search === '?label=bug&label=docs', `the URL should keep both labels, got ${app.window.location.search}`);
  await app.go('/kanban?label=bug&label=docs');
  await app.see('Showing 5 of 14 cards');
  await app.click('Bug');
  await app.click('Mia Chen');
  app.expect(app.window.location.search === '?label=docs&who=mia', `got ${app.window.location.search}`);
  await app.see('No cards match these filters');
  await app.click('Clear filters');
  await app.see('Dark mode for the docs site');
  app.expect(app.window.location.search === '', `clearing should empty the query, got ${app.window.location.search}`);
});

flow('kanban: delete a card, after confirming', async (app) => {
  const title = await addKanbanCard(app, 'Delete me');
  await app.click(title);
  await app.click('Delete card');
  await app.see(`Delete "${title}"?`);
  await app.click('Keep card');
  await app.waitFor(() => app.queryAll('dialog').length === 1, 'Keep card should close only the question');
  await app.click('Delete card');
  await app.click('Delete');
  await app.see('Card deleted');
  await app.waitFor(() => !kanbanColumnOf(app, title), 'the card should be gone from the board');
});

flow('kanban: the board survives a reload', async (app) => {
  const title = await addKanbanCard(app, 'Keep me');
  await app.click(`Move "${title}" right`);
  await app.waitFor(() => kanbanColumnOf(app, title) === 'doing', 'the card should move to In progress');
  await app.go('/kanban');
  await app.waitFor(() => !!kanbanColumnOf(app, title), 'the card should be on the board after a reload');
  app.expect(kanbanColumnOf(app, title) === 'doing', 'after a reload the card should still be in In progress');
});

// The harness can't drive a real mouse drag, so this sends the drag events a drop makes (dragstart, dragover,
// drop, dragend), to check the handlers: where a drop lands, the indicators, and that they clear.
flow('kanban: drag and drop events move a card to the top of a column, or to the end of another', async (app) => {
  await app.go('/kanban');
  await app.see('Pricing page layout');
  const W = /** @type {any} */ (app.window);
  const wait = () => new Promise((r) => setTimeout(r, 50));
  const card = app.queryAll('.kcard').find((el) => el.textContent.includes('Pricing page layout'));
  const target = app.query('[data-col="todo"]');
  const first = target.querySelector('.kcard');
  const dt = new W.DataTransfer();
  card.dispatchEvent(new W.DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  await wait();
  app.expect(card.classList.contains('dragging'), 'dragging class');
  const r = first.getBoundingClientRect();
  first.dispatchEvent(new W.DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 5, clientY: r.top + 2 }));
  await wait();
  app.expect(first.classList.contains('drop-before'), 'drop-before on first card');
  app.expect(target.hasAttribute('data-drop'), 'column highlighted');
  first.dispatchEvent(new W.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 5, clientY: r.top + 2 }));
  card.dispatchEvent(new W.DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  await app.waitFor(() => app.query('[data-col="todo"] .kcard-title')?.textContent.trim() === 'Pricing page layout', 'card should be first in To do');
  app.expect(!app.query('.drop-before, [data-drop], .dragging'), 'indicators cleared');
  const c2 = app.queryAll('.kcard').find((el) => el.textContent.includes('Dark mode for the docs site'));
  const rev = app.query('[data-col="review"]');
  const dt2 = new W.DataTransfer();
  c2.dispatchEvent(new W.DragEvent('dragstart', { bubbles: true, dataTransfer: dt2 }));
  await wait();
  const rr = rev.getBoundingClientRect();
  rev.dispatchEvent(new W.DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt2, clientX: rr.left + 5, clientY: rr.bottom - 5 }));
  rev.dispatchEvent(new W.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt2, clientX: rr.left + 5, clientY: rr.bottom - 5 }));
  c2.dispatchEvent(new W.DragEvent('dragend', { bubbles: true, dataTransfer: dt2 }));
  await app.waitFor(() => [...rev.querySelectorAll('.kcard-title')].pop()?.textContent.trim() === 'Dark mode for the docs site', 'card should be last in Review');
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

// ---------- Trading (/trade) ----------
// The candles and the account come from api/trade.mjs (a fixed seed and a fixed day); the ticks after that
// from a seeded feed in the browser. Ticks still arrive on a timer, so these flows wait for a change instead
// of naming prices, and the account is shared by every run of the dev server, so they compare before and after.

const quotePrice = (app) => app.query('.quote-price')?.textContent.replace(/[^\d.,]/g, '');
const chartLabel = (app) => app.query('.candle-svg')?.getAttribute('aria-label') ?? '';
const sleepFor = (ms) => new Promise((r) => setTimeout(r, ms));

flow('trading: /trade opens NWX with live prices, the chart, the book and the account', async (app) => {
  await app.go('/trade');
  await app.expectPath('/trade/NWX');
  await app.see('Northwind Exchange Group');
  await app.see('Watchlist');
  await app.see('Order book');
  await app.see('Your account');
  await app.waitFor(() => chartLabel(app).startsWith('NWX, 5 min candles'), 'the chart should have a text summary for NWX');
  app.expect(app.queryAll('.wl-row').length === 40, `the watchlist should list 40 symbols, got ${app.queryAll('.wl-row').length}`);
  app.expect(app.queryAll('.book-row').length === 20, 'the book shows 10 asks and 10 bids');
  await app.waitFor(() => app.queryAll('.tape-row').length > 0, 'trades should arrive');
  await app.hear('NWX 1'); // the price, said politely (at most every 5 s)
});

flow('trading: picking a symbol in the watchlist changes the URL, the chart and the selected row', async (app) => {
  await app.go('/trade/NWX');
  await app.see('Northwind Exchange Group');
  await app.click('[href="/trade/HLXB"]');
  await app.expectPath('/trade/HLXB');
  await app.waitFor(() => app.query('h1')?.textContent.includes('Helix Biosystems'), 'the heading should name Helix Biosystems');
  await app.waitFor(() => chartLabel(app).startsWith('HLXB,'), 'the chart should be HLXB’s');
  await app.see('Trade HLXB');
  app.expect(app.queryAll('.wl-row.selected').length === 1, 'exactly one watchlist row is selected');
  app.expect(app.query('.wl-row.selected .wl-sym')?.textContent === 'HLXB', 'the selected row is HLXB');
});

flow('trading: the timeframe is kept in ?tf, also when switching symbols', async (app) => {
  await app.go('/trade/NWX');
  await app.waitFor(() => chartLabel(app).startsWith('NWX, 5 min'), 'the day’s chart first');
  await app.click('1W');
  await app.waitFor(() => chartLabel(app).startsWith('NWX, 1 hour'), 'a week of hourly candles');
  app.expect(app.window.location.search === '?tf=1W', `the URL should have ?tf=1W, got "${app.window.location.search}"`);
  await app.click('[href="/trade/QUIL?tf=1W"]');
  await app.expectPath('/trade/QUIL');
  await app.waitFor(() => chartLabel(app).startsWith('QUIL, 1 hour'), 'QUIL’s week');
  await app.click('1D');
  await app.waitFor(() => app.window.location.search === '', 'the default timeframe has no ?tf=');
});

flow('trading: prices tick; Pause stops them, Resume and Stress start them again', async (app) => {
  await app.go('/trade/NWX');
  await app.see('Live');
  const first = quotePrice(app);
  await app.waitFor(() => quotePrice(app) !== first, 'the price should tick');
  await app.click('Pause');
  await app.see('Prices are paused');
  await app.see('Paused');
  const paused = quotePrice(app);
  await sleepFor(1200);
  app.expect(quotePrice(app) === paused, 'a paused feed keeps the price still');
  await app.click('Resume');
  await app.waitFor(() => quotePrice(app) !== paused, 'the price should tick again');
  await app.click('Stress');
  const perSec = () => Number(app.query('.feed-readout')?.textContent.match(/^([\d,]+) updates/)?.[1].replace(/,/g, '') ?? 0);
  await app.waitFor(() => perSec() > 400, `Stress should apply hundreds of updates a second, got ${perSec()}`);
  await app.click('1×');
});

flow('trading: a limit order at or above the price shows Pending, then Filled, and the position appears', async (app) => {
  await app.go('/trade/HLXB');
  await app.see('Trade HLXB');
  await app.click('Limit');
  await app.type('Shares', '1');
  await app.type('Limit price ($)', '90');
  await app.waitFor(() => app.query('.ticket-sum .total dd')?.textContent === '$90.00', 'the cost follows the limit: 1 × $90.00');
  // The order shows as Pending before the server answers: check it right after the click, before any await
  // (a test browser's clock may answer the dev API's delay at once).
  /** @type {HTMLButtonElement} */ (app.queryAll('button').find((b) => b.textContent.trim() === 'Buy 1 HLXB')).click();
  app.expect(app.query('.ticket-status')?.textContent.includes('Pending'), 'the order should show as Pending at once');
  await app.see('Filled');
  await app.see('Bought 1 HLXB at $');
  await app.waitFor(() => app.queryAll('.trade-account tbody th').some((th) => th.textContent.trim() === 'HLXB'), 'HLXB should be in the positions');
});

flow('trading: the ticket checks the shares, and the server refuses an order over the buying power', async (app) => {
  await app.go('/trade/NWX');
  await app.see('Trade NWX');
  await app.type('Shares', '0');
  await app.click('Buy NWX');
  await app.see('Whole shares, at least 1');
  await app.type('Shares', '100000');
  await app.see('More than your buying power');
  await app.click('Buy 100,000 NWX');
  await app.see('Not enough buying power: this order needs');
  app.expect(app.query('[name="qty"]')?.value === '100000', 'the shares typed stay in the form');
});

flow('trading: an open order can be cancelled, after confirming', async (app) => {
  await app.go('/trade/NWX');
  await app.see('Trade NWX');
  await app.click('Limit');
  await app.type('Shares', '1');
  await app.type('Limit price ($)', '1');
  await app.click('Buy 1 NWX');
  await app.see('Order placed: Buy 1 NWX at $1.00');
  await app.click('[data-tab="orders"]');
  const name = 'Cancel order: Buy 1 NWX at $1.00';
  const open = () => app.queryAll('.trade-account button').filter((b) => b.getAttribute('aria-label') === name).length;
  await app.waitFor(() => open() > 0, 'the open order is listed with Cancel');
  const before = open();
  await app.click(name);
  await app.see('Cancel the order to buy 1 NWX at $1.00?');
  await app.click('Keep order');
  app.expect(open() === before, 'Keep order leaves it open');
  await app.click(name);
  await app.click('Cancel order');
  await app.see('Order cancelled');
  await app.waitFor(() => open() === before - 1, 'the order is no longer open');
});

flow('trading: a lost feed says so, counts down, and Retry reconnects', async (app) => {
  await app.go('/trade/NWX?feed=down');
  await app.see('Disconnected from the price feed.');
  await app.see('Reconnecting in');
  app.expect(app.query('.feed-tools .btn')?.disabled, 'Pause is disabled while disconnected');
  await app.click('Retry now');
  await app.waitFor(() => app.query('.feed-state')?.textContent.trim() === 'Live', 'the feed should be live again');
  await app.notSee('Disconnected from the price feed.');
  app.expect(app.window.location.search === '', `Retry takes ?feed=down out of the URL, got "${app.window.location.search}"`);
});

flow('trading: searching the watchlist, starring a symbol, and an unknown symbol', async (app) => {
  await app.go('/trade/NWX');
  await app.see('Watchlist');
  await app.type('Search symbols', 'zzzz');
  await app.see('No symbols match “zzzz”');
  await app.click('Clear search');
  await app.waitFor(() => app.queryAll('.wl-row').length === 40, 'all 40 again');
  await app.type('Search symbols', 'harbor');
  await app.waitFor(() => app.queryAll('.wl-row').length === 1, 'one match for "harbor"');
  app.expect(app.window.location.search === '?q=harbor', `the search is kept in the URL, got "${app.window.location.search}"`);
  await app.click('Star HRBR');
  await app.waitFor(() => app.query('[aria-label="Star HRBR"]')?.getAttribute('aria-pressed') === 'true', 'HRBR is starred');
  await app.click('Star HRBR');
  await app.waitFor(() => app.query('[aria-label="Star HRBR"]')?.getAttribute('aria-pressed') === 'false', 'and unstarred again');
  await app.go('/trade/ZZZZ');
  await app.see('No such symbol');
  await app.click('Go to NWX');
  await app.expectPath('/trade/NWX');
});

// ---------- Shop (/shop) ----------
const shopCards = (app) => app.queryAll('.product-grid[aria-label="Products"] .product-card h2').map((h) => h.textContent.trim());
const cartButton = (app) => app.query('.cart-btn')?.getAttribute('aria-label');
// The cart is saved in localStorage, which flows share: start from an empty one.
async function emptyCart(app) {
  await app.go('/shop');
  app.window.localStorage.removeItem('pith-shop-cart');
}

flow('shop: /shop lists the products; category, sort and search are kept in the URL', async (app) => {
  await app.go('/docs/examples');
  await app.click('Open Shop');
  await app.expectPath('/shop');
  await app.see('Good things for home and garden.');
  await app.waitFor(() => shopCards(app).length === 24, 'the shop should list 24 products');
  await app.click('Garden');
  await app.waitFor(() => shopCards(app).length === 6, 'Garden should have 6 products');
  app.expect(app.window.location.search === '?category=garden', `the category should be in the URL, got "${app.window.location.search}"`);
  await app.see('6 products in Garden');
  await app.select('Sort', 'Price, low to high');
  await app.waitFor(() => shopCards(app)[0] === 'Seed collection', 'the cheapest garden product should come first');
  await app.type('Search the shop', 'zzz');
  await app.see('Nothing matches “zzz” in Garden');
  await app.click('Clear filters');
  await app.waitFor(() => shopCards(app).length === 24, 'Clear filters should show every product again');
  await app.go('/shop?category=desk&sort=price-asc');
  await app.waitFor(() => shopCards(app).join() === 'Postcard set,Pencil set,Recipe cards,Notebook set,Desk calendar', `a reload keeps the filter and the sort, got ${shopCards(app).join()}`);
});

flow('shop: a product page has its colours and sizes, and Add to cart counts in the header', async (app) => {
  await emptyCart(app);
  await app.go('/shop');
  await app.click('Ceramic mug');
  await app.expectPath('/shop/p/ceramic-mug');
  await app.waitFor(() => app.document.title === 'Ceramic mug · Shop · Pith', `title should be "Ceramic mug · Shop · Pith", got "${app.document.title}"`);
  await app.see('You may also like');
  app.expect(cartButton(app) === 'Cart, empty', `the cart should start empty, got "${cartButton(app)}"`);
  await app.click('Charcoal');
  app.expect(app.window.location.search === '?colour=charcoal', 'the colour should be in the URL');
  await app.click('One more');
  await app.click('Add to cart');
  await app.see('Added Ceramic mug (Charcoal)');
  await app.waitFor(() => cartButton(app) === 'Cart, 2 items', `the header should count 2, got "${cartButton(app)}"`);
  await app.go('/shop/p/olive-wood-board');
  await app.click('Large');
  await app.click('Add to cart');
  await app.waitFor(() => cartButton(app) === 'Cart, 3 items', 'a second product adds to the count');
  await app.go('/shop/p/woven-basket');
  await app.see('More are being made'); // loaded: the heading shows while it loads too
  app.expect(app.queryAll('button').find((b) => b.textContent.trim() === 'Sold out')?.disabled, 'a sold-out product cannot be added');
});

flow('shop: the cart changes quantities, removes with Undo, and survives a reload', async (app) => {
  await emptyCart(app);
  await app.go('/shop/p/linen-tote');
  await app.click('Add to cart');
  await app.click('Cart, 1 item');
  await app.see('Your cart');
  await app.see('Add $37 more for free standard delivery.');
  await app.click('One more Linen tote');
  await app.waitFor(() => cartButton(app) === 'Cart, 2 items', 'the + button adds one');
  await app.see('Free standard delivery on this order.');
  await app.go('/shop');
  await app.waitFor(() => cartButton(app) === 'Cart, 2 items', 'the cart should survive a reload');
  await app.click('Cart, 2 items');
  await app.click('Remove Linen tote');
  await app.see('Your cart is empty.');
  await app.click('Undo');
  await app.waitFor(() => app.query('.cart-line-name')?.textContent.trim() === 'Linen tote', 'Undo should put the tote back');
  app.expect(cartButton(app) === 'Cart, 2 items', 'with its quantity');
  await app.click('Close cart');
  await app.notSee('Your cart');
});

flow('shop: checkout in three steps, with a server error and a declined card, then the order', async (app) => {
  await emptyCart(app);
  await app.go('/shop/p/ceramic-mug');
  await app.click('Add to cart');
  await app.click('Cart, 1 item');
  await app.click('Check out');
  await app.expectPath('/shop/checkout/shipping');
  await app.click('Continue to delivery');
  await app.see('Enter the name to deliver to');
  await app.type('Full name', 'Ann Adams');
  await app.type('Email', 'ann@example.com');
  await app.type('Street address', '12 Alder Street');
  await app.type('Town or city', 'Portland, OR');
  await app.type('Postcode', '00000');
  await app.click('Continue to delivery');
  await app.see("We can't deliver to 00000"); // the server's 422, under the field
  await app.expectPath('/shop/checkout/shipping');
  await app.type('Postcode', '97214');
  await app.click('Continue to delivery');
  await app.expectPath('/shop/checkout/delivery');
  await app.see('To Ann Adams, 12 Alder Street');
  await app.click('[value="express"]');
  await app.see('Delivery (Express)'); // the summary follows the choice at once
  await app.click('Continue to payment');
  await app.expectPath('/shop/checkout/payment');
  await app.see('This is a demo shop.');
  await app.type('Card number', '1234 5678 9012 3456');
  await app.type('Expiry (MM/YY)', '12/30');
  await app.type('Security code', '123');
  await app.click('Pay $38');
  await app.see('This demo takes test numbers only'); // a 422 under the card number
  await app.click("Use a card that's declined");
  await app.click('Pay $38');
  await app.see('Your card was declined.'); // a 402, in the form, with what was typed kept
  app.expect(app.query('input[name="cardName"]').value === 'Ann Adams', 'the form keeps what was typed');
  await app.click('Use the test card');
  await app.click('Pay $38');
  await app.see('Thank you, Ann.');
  app.expect(/^\/shop\/order\/FF-\d+$/.test(app.window.location.pathname), `the order page should open, got ${app.window.location.pathname}`);
  await app.see('1–2 working days');
  app.expect(cartButton(app) === 'Cart, empty', 'the cart is empty after the order');
});

flow('shop: checkout steps need a cart, and the steps before them', async (app) => {
  await emptyCart(app);
  await app.go('/shop/checkout/payment');
  await app.expectPath('/shop');
  await app.see("Your cart is empty, so there's nothing to check out yet.");
  await app.go('/shop/p/pencil-set');
  await app.click('Add to cart');
  await app.go('/shop/checkout/payment');
  await app.expectPath('/shop/checkout/shipping'); // no address yet
});

flow('shop: an unknown product and a shop that fails to load say so', async (app) => {
  await app.go('/shop/p/no-such-thing');
  await app.see('No such product');
  await app.click('Browse the shop');
  await app.expectPath('/shop');
  await app.go('/shop?fail');
  await app.see("Couldn't load the shop.");
  await app.see('Try again');
});

// The account took over what the old Settings example showed: a layout kept mounted, a guard, provide / inject.
flow('shop account: the layout keeps the display name across its pages (provide / inject)', async (app) => {
  await app.go('/shop');
  await app.click('Account');
  await app.expectPath('/shop/account/profile');
  await app.see('Hello, there');
  await app.type('Display name', 'Ann');
  await app.type('Email', 'ann@example.com');
  await app.click('Save changes');
  await app.see('Hello, Ann'); // the layout's value, read with inject() in the greeting
  await app.click('Appearance');
  await app.expectPath('/shop/account/appearance');
  await app.see('Pick how the whole site looks');
  await app.see('Hello, Ann');
  await app.click('Profile');
  await app.waitFor(() => app.query('input[name="displayName"]')?.value === 'Ann', 'the name should survive going back to Profile');
});

flow('shop account: Orders needs sign-in; the guard sends you to Sign in with a notice, then back', async (app) => {
  await app.go('/shop/account/orders');
  await app.expectPath('/shop/account/sign-in');
  await app.see('Sign in to see your orders.');
  await app.click('Sign in');
  await app.see('Enter your email address');
  await app.type('Email', 'ann@example.com');
  await app.type('Password', 'secret1');
  await app.click('Sign in');
  await app.expectPath('/shop/account/orders');
  await app.see('Order FF-1043');
  await app.see('On its way');
  await app.click('Order FF-1043');
  await app.expectPath('/shop/order/FF-1043');
  await app.see('Placed Oct 19, 2026');
});

flow('shop account: Appearance sets the theme for the whole site', async (app) => {
  await app.go('/shop/account/appearance');
  await app.click('[value="dark"]');
  app.expect(app.document.documentElement.dataset.theme === 'dark', 'Dark should set the theme');
  app.expect(app.query('nav-bar .icon-btn')?.getAttribute('aria-label') === 'Switch to light theme', 'the header button should follow');
  await app.click('[value="system"]');
  app.expect(!app.document.documentElement.dataset.theme, 'Match the device should clear it');
  app.expect(app.window.localStorage.getItem('pith-theme') === null, 'and forget the saved choice');
});

flow('shop: the old /settings URLs open the account', async (app) => {
  await app.go('/settings');
  await app.expectPath('/shop/account/profile');
  await app.go('/settings/appearance');
  await app.expectPath('/shop/account/appearance');
  await app.go('/settings/account');
  await app.expectPath('/shop/account/sign-in'); // Orders, behind the guard
});
// ---------- end Shop ----------
