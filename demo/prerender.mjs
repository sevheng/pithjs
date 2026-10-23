// The URLs of :param routes to prerender at build time (npm run build). Runs in Node, like api/*.mjs.
// Each page bakes in the data api/ returned during the build.
import { readdirSync } from 'node:fs';
import { team } from './api/team.mjs';

// One page per feature example (app/examples/<name>.js).
const features = readdirSync(new URL('./app/examples/', import.meta.url))
  .filter((f) => f.endsWith('.js') && f !== 'index.js' && f !== 'sources.js')
  .map((f) => `/features/${f.replace(/\.js$/, '')}`);

export default async function paths() {
  return [...team.map((p) => `/team/${p.id}`), ...features];
}
