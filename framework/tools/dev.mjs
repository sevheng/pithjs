// npm run dev: the Vite dev server with the Pith plugin. The browser reloads when you save a file,
// CSS updates in place, and errors show as an overlay. The dev API (api/*.mjs) and the test pages
// (/__pith/) work as on the no-build server, which is still there: npm run dev:no-build.
//   PORT=3000 npm run dev   for another port

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { projectRoot } from './dev-server.mjs';
import { pith } from './vite-plugin.mjs';

let vite;
try {
  vite = await import(createRequire(join(projectRoot, 'package.json')).resolve('vite'));
} catch {
  console.error('✗ Vite is not installed in this project. Run:  npm install\n  (or use the no-build server: npm run dev:no-build)');
  process.exit(1);
}

const server = await vite.createServer({
  configFile: false,
  root: projectRoot,
  plugins: [pith({ projectRoot })],
  server: { port: Number(process.env.PORT) || 8000 },
});
await server.listen();
server.printUrls();
server.bindCLIShortcuts({ print: true });
