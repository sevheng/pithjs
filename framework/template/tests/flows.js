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

flow('an unknown address shows the not-found page', async (app) => {
  await app.go('/no-such-page');
  await app.see('Page not found');
});
