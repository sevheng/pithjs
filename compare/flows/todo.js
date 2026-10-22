// User flows for spec/todo.md. The same file tests every implementation.
import { flow } from 'mini/testing';

flow('starts with the two welcome todos', async (app) => {
  await app.go('/');
  await app.see('Try adding a todo');
  await app.see('Reload the page: todos are saved');
  await app.see('2 items left');
  app.expect(app.query('button.btn.ghost').disabled, '"Clear done" should be disabled when nothing is done');
});

flow('add, complete and delete', async (app) => {
  await app.go('/');
  await app.type('New todo', 'Buy milk');
  await app.click('Add');
  await app.see('Buy milk');
  await app.see('3 items left');
  app.expect(app.query('#todo-input').value === '', 'the input should be cleared after adding');
  await app.click('Buy milk');
  await app.see('2 items left');
  app.expect(app.queryAll('li.todo.done').length === 1, 'the completed todo should have class "done"');
  await app.click('Delete "Buy milk"');
  await app.notSee('Buy milk');
});

flow('Enter adds a todo and keeps focus in the input', async (app) => {
  await app.go('/');
  await app.type('New todo', 'Call mom');
  await app.pressEnter();
  await app.see('Call mom');
  app.expect(app.document.activeElement === app.query('#todo-input'), 'focus should stay in the input');
});

flow('blank input adds nothing', async (app) => {
  await app.go('/');
  await app.type('New todo', '   ');
  await app.click('Add');
  await app.see('2 items left');
  app.expect(app.queryAll('li.todo').length === 2, 'no todo should be added');
});

flow('filters show the right items, and the empty message', async (app) => {
  await app.go('/');
  await app.click('Try adding a todo');
  await app.click('done');
  await app.see('Try adding a todo');
  await app.notSee('Reload the page');
  app.expect(app.query('[aria-pressed="true"]')?.textContent.trim() === 'done', 'the "done" filter should be pressed');
  await app.click('active');
  await app.see('Reload the page');
  await app.notSee('Try adding a todo');
  await app.click('Reload the page: todos are saved');
  await app.see('Nothing here.');
  await app.see('0 items left');
});

flow('"Clear done" removes completed todos', async (app) => {
  await app.go('/');
  await app.click('Try adding a todo');
  await app.click('Clear done');
  await app.notSee('Try adding a todo');
  await app.see('1 item left');
});

flow('todos and the filter survive a reload', async (app) => {
  await app.go('/');
  await app.type('New todo', 'Water plants');
  await app.click('Add');
  await app.click('active');
  await app.go('/');
  await app.see('Water plants');
  app.expect(app.query('[aria-pressed="true"]')?.textContent.trim() === 'active', 'the "active" filter should be restored');
});

flow('HTML typed by a user is shown as text', async (app) => {
  await app.go('/');
  await app.type('New todo', '<img src=x onerror="window.hacked=true">');
  await app.click('Add');
  await app.see('<img src=x');
  app.expect(!app.query('.todo-list img'), 'no <img> element should be created');
  app.expect(!(/** @type {any} */ (app.window).hacked), 'the onerror code must not run');
});
