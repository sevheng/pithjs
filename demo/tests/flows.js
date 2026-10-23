// User flows: what a person does, and what they should see. Run by `npm run check`.
// Find things by the name a person sees (button text, label, aria-label), not by CSS classes,
// so flows keep working when the styling changes.
import { flow } from 'pith/testing';

flow('home: counter goes up and the double follows', async (app) => {
  await app.go('/');
  await app.see('Simple is fast.');
  await app.see('Double: 10');
  await app.click('Increase');
  await app.see('Double: 12');
  await app.click('Reset');
  await app.see('Double: 0');
});

flow('todos: add, complete and delete', async (app) => {
  await app.go('/todos');
  await app.see('2 items left');
  await app.type('New todo', 'Buy milk');
  await app.click('Add');
  await app.see('Buy milk');
  await app.see('3 items left');
  app.expect(app.query('#todo-input').value === '', 'the input should be cleared after adding');

  await app.click('Buy milk'); // the checkbox, named by its label
  await app.see('2 items left');
  await app.click('Delete "Buy milk"');
  await app.notSee('Buy milk');
});

flow('todos: Enter adds a todo and keeps focus in the input', async (app) => {
  await app.go('/todos');
  await app.type('New todo', 'Call mom');
  await app.pressEnter();
  await app.see('Call mom');
  app.expect(app.document.activeElement === app.query('#todo-input'), 'focus should stay in the input');
});

flow('todos: filters show the right items', async (app) => {
  await app.go('/todos');
  await app.click('Try adding a todo'); // mark the first one done
  await app.click('done');
  await app.see('Try adding a todo');
  await app.notSee('Reload the page');
  await app.click('active');
  await app.see('Reload the page');
  await app.notSee('Try adding a todo');
});

flow('todos: saved after a reload', async (app) => {
  await app.go('/todos');
  await app.type('New todo', 'Water plants');
  await app.click('Add');
  await app.go('/todos');
  await app.see('Water plants');
});

flow('todos: HTML typed by a user is shown as text', async (app) => {
  await app.go('/todos');
  await app.type('New todo', '<img src=x onerror="window.hacked=true">');
  await app.click('Add');
  await app.see('<img src=x');
  app.expect(!app.query('.todo-list img'), 'no <img> element should be created');
  app.expect(!(/** @type {any} */ (app.window).hacked), 'the onerror code must not run');
});

flow('navigation: links, title, and the back button', async (app) => {
  await app.go('/');
  await app.click('Todos');
  await app.expectPath('/todos');
  await app.see('Saved in your browser');
  app.expect(app.document.title === 'Todos · Pith', `title should be "Todos · Pith", got "${app.document.title}"`);
  await app.back();
  await app.expectPath('/');
  await app.see('Simple is fast.');
});

flow('navigation: unknown URL shows not found, with a way home', async (app) => {
  await app.go('/no-such-page');
  await app.see('Page not found');
  await app.click('Go home');
  await app.expectPath('/');
});

// Has the page downloaded the script for `name` (e.g. 'todos')? Matches the source file
// (/app/pages/todos.js) in development and the fingerprinted chunk (/assets/todos-3f9a1c.js) in a build.
const downloaded = (app, name) =>
  app.window.performance.getEntriesByType('resource').some((r) => {
    const path = new URL(r.name).pathname;
    return path.endsWith(`/${name}.js`) || new RegExp(`/assets/${name}-[\\w-]+\\.js$`).test(path);
  });

flow('lazy loading: a page downloads its code only when it is needed', async (app) => {
  await app.go('/');
  await app.see('Simple is fast.');
  app.expect(downloaded(app, 'home'), 'home.js should be downloaded on /');
  app.expect(!downloaded(app, 'todos'), 'todos.js should not be downloaded before it is needed');
  app.expect(!downloaded(app, 'todo-list'), 'todo-list.js should not be downloaded yet');
  await app.click('Todos');
  await app.see('Saved in your browser');
  app.expect(downloaded(app, 'todos'), 'todos.js should be downloaded after visiting /todos');
});

flow('lazy loading: pointing at a link starts downloading its page', async (app) => {
  await app.go('/');
  await app.see('Simple is fast.');
  app.expect(!downloaded(app, 'about'), 'about.js should not be downloaded yet');
  const link = app.queryAll('nav a').find((a) => a.textContent.trim() === 'About');
  link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await app.waitFor(() => downloaded(app, 'about'), 'hovering the About link should prefetch about.js');
  await app.expectPath('/'); // prefetch must not navigate
});

flow('team: loads from the API, and search filters on the server', async (app) => {
  await app.go('/team');
  await app.see('Ada Lovelace');
  await app.type('Search the team', 'designer');
  await app.see('Dieter Rams');
  await app.notSee('Ada Lovelace');
  await app.type('Search the team', 'zzz');
  await app.see('No one matches "zzz"');
});

flow('team: clicking a person opens their page, with their role', async (app) => {
  await app.go('/team');
  await app.click('Dieter Rams');
  await app.expectPath('/team/3');
  await app.waitFor(() => app.query('h1')?.textContent === 'Dieter Rams', 'the page heading should be the person');
  await app.see('Product designer');
  await app.notSee('Grace Hopper'); // the list is gone
  app.expect(app.document.title === 'Member · Pith', `title should be "Member · Pith", got "${app.document.title}"`);
});

flow('team: an unknown person id shows "No such person" on that URL', async (app) => {
  await app.go('/team/999');
  await app.see('No such person');
  await app.expectPath('/team/999');
  await app.notSee('Page not found');
});

flow('contact: empty submit shows every error and focuses the first field', async (app) => {
  await app.go('/contact');
  await app.click('Send message');
  await app.see('This field is required');
  await app.see('Please agree so we can reply');
  app.expect(app.document.activeElement === app.query('input[name="name"]'), 'focus should move to the name field');
});

flow('contact: the server rejects a blocked email, shown under the email field', async (app) => {
  await app.go('/contact');
  await app.type('Your name', 'Ann');
  await app.type('Email', 'ann@blocked.test');
  await app.type('Message', 'Hello, I have a question about Pith.');
  await app.click('I agree to be contacted by email');
  await app.click('Send message');
  await app.see('This address is blocked');
  app.expect(app.document.activeElement === app.query('input[name="email"]'), 'focus should move to the email field');
  await app.type('Email', 'ann@mail.test'); // fixing the field clears the server error
  await app.notSee('This address is blocked');
});

flow('contact: a valid message is sent and can be followed by another', async (app) => {
  await app.go('/contact');
  await app.type('Your name', 'Ann');
  await app.type('Email', 'ann@mail.test');
  await app.type('Message', 'Hello, I have a question about Pith.');
  await app.click('I agree to be contacted by email');
  await app.click('Send message');
  await app.see('Thanks, Ann!');
  await app.click('Send another');
  await app.see('Send message');
  app.expect(app.query('input[name="name"]').value === '', 'the form should be empty again');
});

flow('team: "Load more" adds the next page until there is none', async (app) => {
  await app.go('/team');
  await app.see('Susan Kare'); // page 1 holds 4 people
  await app.notSee('Margaret Hamilton');
  await app.click('Load more');
  await app.see('Margaret Hamilton');
  await app.see('Ada Lovelace'); // page 1 is still there
  await app.click('Load more');
  await app.see('Barbara Liskov'); // the last page
  await app.notSee('Load more');
});

flow('team: the search is kept in the URL, so a reload keeps it', async (app) => {
  await app.go('/team');
  await app.see('Ada Lovelace');
  await app.type('Search the team', 'designer');
  await app.see('Dieter Rams');
  app.expect(app.window.location.search === '?q=designer', `the URL should have ?q=designer, got "${app.window.location.search}"`);
  await app.go('/team?q=designer'); // a reload with the same URL
  await app.see('Dieter Rams');
  await app.notSee('Ada Lovelace');
  app.expect(app.query('#team-search').value === 'designer', 'the search box should show the search from the URL');
  await app.type('Search the team', '');
  await app.see('Ada Lovelace');
  app.expect(app.window.location.search === '', 'clearing the search should remove ?q from the URL');
});

flow('todos: adding a todo shows a toast', async (app) => {
  await app.go('/todos');
  await app.type('New todo', 'Book flights');
  await app.click('Add');
  await app.see('Todo added');
});

flow('todos: "Clear completed" asks first; Cancel keeps the items, Clear removes them', async (app) => {
  await app.go('/todos');
  await app.click('Try adding a todo'); // mark it done
  await app.click('Clear completed');
  await app.see('Delete 1 completed todo?');
  await app.click('Cancel');
  await app.notSee('Delete 1 completed todo?');
  await app.see('Try adding a todo');

  await app.click('Clear completed');
  await app.click('Clear');
  await app.see('Completed todos cleared');
  await app.notSee('Try adding a todo');
  await app.see('Reload the page'); // the active one stays
});

flow('todos: Esc closes the confirm, keeps the items, and gives focus back to the button', async (app) => {
  await app.go('/todos');
  await app.click('Try adding a todo'); // mark it done
  // A mouse click focuses the button; the harness's click() doesn't, so focus it like a person would.
  app.queryAll('button').find((b) => b.textContent.trim() === 'Clear completed').focus();
  await app.click('Clear completed');
  await app.see('Delete 1 completed todo?');
  // A dangerous action starts on Cancel, so Enter can't delete by accident.
  app.expect(app.document.activeElement?.textContent.trim() === 'Cancel', 'focus should start on Cancel');
  const dialog = app.query('dialog');
  const { Event } = /** @type {any} */ (app.window);
  dialog.dispatchEvent(new Event('cancel', { cancelable: true })); // what the browser fires on Esc
  await app.notSee('Delete 1 completed todo?');
  await app.see('Try adding a todo');
  app.expect(app.document.activeElement?.textContent.trim() === 'Clear completed', 'focus should return to "Clear completed"');
});

flow('todos: a toast can be dismissed', async (app) => {
  await app.go('/todos');
  await app.type('New todo', 'Water plants');
  await app.click('Add');
  await app.see('Todo added');
  await app.click('Dismiss');
  await app.notSee('Todo added');
});

flow('settings: /settings opens Profile, and the layout keeps its state across pages', async (app) => {
  await app.go('/');
  await app.click('Settings');
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

flow('about: a broken widget shows its fallback, the page keeps working, and it recovers', async (app) => {
  await app.go('/about');
  await app.see('Errors stay contained'); // the info-card's title slot
  await app.see('This widget is working.');
  await app.click('Break this widget');
  await app.see('This widget crashed: The widget hit a bug.');
  await app.see('How fast is it?'); // the rest of the page is still there
  await app.click('Try again');
  await app.see('This widget is working.');
  await app.notSee('This widget crashed');
});
