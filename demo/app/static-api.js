// A static host (GitHub Pages) has no server to answer /api/..., so the published demo answers it in the browser,
// with the same handlers the dev server runs (api/*.mjs). Each visitor gets their own copy of the data, kept until
// they reload. Only in a build made with VITE_STATIC_API=1 (see .github/workflows/pages.yml), and not while that
// build prerenders: its own server answers then, so the answers are baked into the pages as usual.

// @ts-ignore: import.meta.env is Vite's (undefined without a build)
const enabled = import.meta.env?.VITE_STATIC_API === '1' && !document.getElementById('pith-prerender-data');

if (enabled) {
  // @ts-ignore: Vite's, and it must be written exactly like this for Vite to see it
  const modules = import.meta.glob('../api/*.mjs');
  const base = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="pith-base"]'))?.content || '/';
  const prefix = `${base}api/`;
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const network = window.fetch.bind(window);

  // The dev server's contract (framework/tools/dev-server.mjs handleApi): api/<name>.mjs exports a function per
  // HTTP method, which gets { query, body, method } and returns data (sent as JSON) or a Response.
  async function answer(url, init = {}) {
    const name = url.pathname.slice(prefix.length).replace(/\/+$/, '');
    const load = modules[`../api/${name}.mjs`];
    if (!load) return json(404, { message: `No API at ${url.pathname}` });
    const method = (init.method ?? 'GET').toUpperCase();
    const handler = (await load())[method];
    if (typeof handler !== 'function') return json(405, { message: `api/${name}.mjs has no ${method} export` });
    try {
      const body = typeof init.body === 'string' && init.body ? JSON.parse(init.body) : null;
      const result = await handler({ query: Object.fromEntries(url.searchParams), body, method });
      return result instanceof Response ? result : json(200, result ?? null);
    } catch (err) {
      return json(err.status ?? 500, { message: err.message });
    }
  }

  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    return url.origin === location.origin && url.pathname.startsWith(prefix) ? answer(url, init) : network(input, init);
  };
}
