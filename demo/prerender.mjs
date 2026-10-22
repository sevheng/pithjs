// The URLs of :param routes to prerender at build time (npm run build). Runs in Node, like api/*.mjs.
// Each page bakes in the data api/ returned during the build.
import { team } from './api/team.mjs';

export default async function paths() {
  return team.map((p) => `/team/${p.id}`);
}
