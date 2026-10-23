// User flows: click, type and see, like a person. npm run check runs them. Add one for each feature.
import { flow } from 'pith/testing';

flow('home: shows the welcome', async (app) => {
  await app.go('/');
  await app.see('Built with Pith');
});

flow('home: the button counts clicks', async (app) => {
  await app.go('/');
  await app.click('Clicked 0 times');
  await app.see('Clicked 1 times');
});

flow('an unknown address shows the 404 page, with a way home', async (app) => {
  await app.go('/no-such-page');
  await app.see('Page not found');
  await app.see('/no-such-page');
  await app.click('Go home');
  await app.expectPath('/');
});
