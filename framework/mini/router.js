// History-API router. Put ${router.view} in a template and it renders the matching page.
// Lazy routes ({ load: () => import('./pages/x.js') }) download a page's code only when it's needed:
// on first visit, or earlier when the user points at or focuses a link to it (prefetch).
// Also: router.query (the URL's ?search), redirects and a guard, scroll restore on back/forward,
// and layouts that stay mounted while the user moves between pages that share them.

import { signal, computed, effect, untrack, batch, catchError } from './signal.js';
import { html } from './html.js';
import { transition } from './transition.js';
import { DEV, warn, error, describe, registry, recording, collect, silently } from './dev.js';

/**
 * @typedef {(params: Record<string, string>) => unknown} View
 * @typedef {{ default: View }} PageModule
 * @typedef {(page: () => unknown) => unknown} Layout  page is a reactive hole: put it in as ${page}
 * @typedef {Layout | { load: () => Promise<{ default: Layout }> }} LayoutOption
 * @typedef {{
 *   title?: string,
 *   layout?: LayoutOption,
 *   redirect?: string | ((params: Record<string, string>) => string),
 *   [key: string]: unknown,
 * }} RouteOptions
 * @typedef {View | (RouteOptions & { view: View }) | (RouteOptions & { load: () => Promise<PageModule> }) | (RouteOptions & { redirect: string | ((params: Record<string, string>) => string) })} Route
 * @typedef {{ path: string, params: Record<string, string>, query: Record<string, string>, route: RouteOptions & { pattern: string } }} GuardTarget
 */

const MAX_REDIRECTS = 10;

const parseQuery = (search) => Object.fromEntries(new URLSearchParams(search));

/**
 * Create the app router. Patterns: '/', '/todos', '/user/:id', and '*' for not found.
 * @param {Record<string, Route>} routes
 * @param {{
 *   title?: (t: string) => string,
 *   focus?: string | null,
 *   transitions?: boolean,
 *   prefetch?: boolean,
 *   loading?: () => unknown,
 *   guard?: (to: GuardTarget) => true | string,
 * }} [options]
 *   title: formats document.title · focus: selector focused after navigation ·
 *   transitions: animate with View Transitions · prefetch: load a page's code on link hover/focus ·
 *   loading: shown only on first visit while the page's code downloads ·
 *   guard: runs before every page change; return true to allow it or a path to redirect there
 */
export function createRouter(
  routes,
  { title = (t) => t, focus = null, transitions = true, prefetch = true, loading = () => null, guard = null } = {}
) {
  // Made inside a setup: its signals aren't that component's state.
  if (DEV && recording()) {
    return silently(() => createRouter(routes, { title, focus, transitions, prefetch, loading, guard }));
  }
  const normalize = (pattern, route) => {
    const r = typeof route === 'function' ? { view: route } : route;
    const layout = r?.layout;
    const lazyLayout = typeof layout?.load === 'function';
    if (layout != null && typeof layout !== 'function' && !lazyLayout) {
      DEV && warn('W021', `Route "${pattern}" has a layout that is ${describe(layout)}. Use (page) => html\`...\${page}...\` or { load: () => import('./layouts/x.js') }.`);
    }
    return {
      ...(r?.redirect != null && !r.view && !r.load ? { view: () => null } : {}), // shown only if a redirect loop is cut off
      ...r,
      pattern,
      // The layout function once known: null = no layout, undefined = lazy and not downloaded yet.
      layoutFn: typeof layout === 'function' ? layout : lazyLayout ? undefined : null,
      status: signal('idle'), // idle | loading | ready | failed
      error: null,
      pending: null,
    };
  };

  for (const [pattern, route] of Object.entries(routes)) {
    if (pattern !== '*' && !pattern.startsWith('/')) {
      DEV && warn('W011', `Route "${pattern}" should start with "/" (like "/${pattern}"), otherwise it never matches.`);
    }
    /** @type {{ view?: unknown, load?: unknown, redirect?: unknown }} */
    const r = typeof route === 'function' ? { view: route } : route;
    if (typeof r?.view !== 'function' && typeof r?.load !== 'function' && r?.redirect == null) {
      DEV && warn('W012', `Route "${pattern}" needs { title, load: () => import('./pages/x.js') } or a view function.`);
    }
  }
  if (!routes['*']) DEV && warn('W013', 'No "*" route: unknown URLs will show plain "Not found" text.');

  const table = Object.entries(routes)
    .filter(([pattern]) => pattern !== '*')
    .map(([pattern, route]) => {
      const keys = [];
      const source = pattern
        .replace(/\/+$/, '')
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
      return { re: new RegExp(`^${source}/?$`), keys, route: normalize(pattern, route) };
    });
  const fallback = normalize('*', routes['*'] ?? (() => 'Not found'));

  function resolve(pathname) {
    for (const { re, keys, route } of table) {
      const m = re.exec(pathname);
      if (m) return { route, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return { route: fallback, params: {} };
  }

  // Follow route redirects and the guard until a URL is allowed. Returns the URL to show.
  function allowed(url) {
    const from = url.pathname;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const { route, params } = resolve(url.pathname);
      let to = null;
      if (route.redirect != null) {
        to = typeof route.redirect === 'function' ? untrack(() => route.redirect(params)) : route.redirect;
      } else if (guard) {
        const result = untrack(() => guard({ path: url.pathname, params, query: parseQuery(url.search), route }));
        if (typeof result === 'string') to = result;
        else if (result !== true) {
          DEV && warn('W022', `The router guard returned ${describe(result)} for "${url.pathname}". Return true to allow the page, or a path like '/login' to redirect.`);
        }
      }
      if (typeof to !== 'string') return url;
      const next = new URL(to, url);
      if (next.href === url.href || next.origin !== location.origin) return next;
      url = next;
    }
    DEV && warn('W020', `Redirects from "${from}" went on for more than ${MAX_REDIRECTS} steps (a redirect or guard loop?). Stopped at "${url.pathname}".`);
    return url;
  }

  // Download a lazy route's code (and its lazy layout) once. Concurrent callers share the request;
  // a failure can be retried.
  const isReady = (route) => !!route.view && route.layoutFn !== undefined;
  const defaultOf = (mod, what) => {
    if (typeof mod?.default !== 'function') {
      throw error('E005', `The ${what} has no default export. Write "export default function MyPage() { ... }".`);
    }
    return mod.default;
  };
  function load(route) {
    if (isReady(route)) return Promise.resolve();
    if (!route.pending) {
      route.status.value = 'loading';
      route.pending = Promise.all([
        route.view ?? Promise.resolve()
          .then(() => route.load())
          .then((mod) => (route.view = defaultOf(mod, `page file for route "${route.pattern}"`))),
        route.layoutFn !== undefined ? null : Promise.resolve()
          .then(() => route.layout.load())
          .then((mod) => (route.layoutFn = defaultOf(mod, `layout file for route "${route.pattern}"`))),
      ])
        .then(() => {
          route.status.value = 'ready';
        })
        .catch((err) => {
          console.error(`[mini] Route "${route.pattern}" failed to load:`, err);
          route.pending = null;
          route.error = err;
          route.status.value = 'failed';
          throw err;
        });
    }
    return route.pending;
  }

  // The first URL goes through redirects and the guard too, replacing the entry it landed on.
  const first = allowed(new URL(location.href));
  if (first.origin !== location.origin) location.replace(first.href);
  else if (first.href !== location.href) history.replaceState(history.state, '', first);

  const path = signal(location.pathname);
  const search = signal(location.search);
  const query = computed(() => parseQuery(search.value));
  const match = computed(() => resolve(path.value));
  const ready = load(match.peek().route).catch(() => {});
  const params = computed(() => match.value.params);
  if (DEV) registry.router = { path, search };

  effect(() => {
    const t = match.value.route.title;
    if (t) document.title = title(t);
  });

  const errorView = (err, retry) => html`
    <section class="section narrow" role="alert">
      <h1>This page didn't load</h1>
      <p class="muted">${String(err?.message ?? err)}</p>
      <button class="btn primary" type="button" @click=${retry}>Try again</button>
    </section>
  `;
  const failedView = (route) => errorView(route.error, () => load(route).catch(() => {}));

  // Dev only: registry.pages lists the current layout (when it holds state of its own), then the page.
  /** @type {{ path: string, name: string, layout?: boolean, state: [string, string, unknown][] } | null} */
  let layoutEntry = null, pageEntry = null;
  const showPages = () => {
    registry.pages = [layoutEntry, pageEntry].filter(Boolean);
  };
  const recordPage = (fn, run) =>
    collect(fn, run, (state) => {
      pageEntry = { path: path.peek(), name: fn.name, state };
      showPages();
    });
  const recordLayout = (fn, run) =>
    collect(fn, run, (state) => {
      layoutEntry = state.length ? { path: path.peek(), name: fn.name, layout: true, state } : null;
      showPages();
    });

  // A page that throws (while rendering or later, in one of its holes) shows errorView instead of
  // breaking the app. Try again renders it from scratch. Components with their own fallback catch first.
  const attempt = signal(0);
  function renderPage(route, params) {
    attempt.value;
    const failed = DEV ? silently(() => signal(/** @type {unknown} */ (null))) : signal(/** @type {unknown} */ (null));
    let stop = () => {};
    const nodes = catchError(
      (dispose) => ((stop = dispose), untrack(() => (DEV ? recordPage(route.view, () => route.view(params)) : route.view(params)))),
      (err) => {
        if (failed.peek()) return;
        console.error(`[mini] Page "${route.pattern}" failed:`, err);
        stop();
        failed.value = err;
      }
    );
    return html`${() => (failed.value ? errorView(failed.value, () => attempt.value++) : nodes)}`;
  }

  // The current route's layout, once it can be shown. Changes only when the layout itself changes.
  const layoutOf = (route) => (route.status.value, isReady(route) ? route.layoutFn : null);
  const layout = computed(() => layoutOf(match.value.route));

  // Re-renders only when the path changes or the *current* route finishes loading.
  // The page body is untracked so signals it reads don't re-render the whole page.
  const page = () => {
    const { route, params } = match.value;
    const status = route.status.value;
    if (isReady(route)) return renderPage(route, params);
    if (status === 'failed') return failedView(route);
    if (status === 'idle') queueMicrotask(() => load(route).catch(() => {}));
    return untrack(loading);
  };
  // The page inside one layout. Empty for a moment when the layout is about to be swapped,
  // so a page is never rendered into the wrong layout.
  const pageIn = (shell) => () => (layoutOf(match.value.route) === shell ? page() : null);

  // Only a different layout re-renders the outer part: pages sharing one keep its DOM and state.
  const view = () => {
    const shell = layout.value;
    if (DEV) {
      layoutEntry = null;
      showPages();
    }
    return untrack(() =>
      shell ? (DEV ? recordLayout(shell, () => shell(pageIn(shell))) : shell(pageIn(shell))) : html`${pageIn(null)}`
    );
  };

  // Scroll positions live in each history entry's state, so back/forward can put them back.
  const restoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  let saveTimer = 0;
  const saveScroll = () => {
    clearTimeout(saveTimer);
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    if (state.scroll !== scrollY) history.replaceState({ ...state, scroll: scrollY }, '');
  };
  const onScroll = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveScroll, 100); // browsers limit how often replaceState may run
  };

  // Now (the new page is already in the DOM) and again next frame, once layout has settled.
  let frame = 0;
  const scrollBack = (y) => {
    window.scrollTo(0, y);
    frame = requestAnimationFrame(() => window.scrollTo(0, y));
  };

  let navigation = 0;

  /**
   * @param {URL} url
   * @param {{ scroll?: boolean, animate?: boolean, restore?: number | null }} [options]
   *   scroll: to the top (or the #hash) · restore: back/forward scroll position
   */
  async function go(url, { scroll = false, animate = false, restore = null } = {}) {
    const id = ++navigation;
    // Keep the current page on screen until the next page's code has arrived.
    await load(resolve(url.pathname).route).catch(() => {}); // a failure renders failedView
    if (id !== navigation) return; // the user already went somewhere else

    const apply = () => {
      batch(() => {
        path.value = url.pathname;
        search.value = url.search;
      });
      cancelAnimationFrame(frame); // a newer page must not get an older page's scroll position
      if (restore != null) {
        scrollBack(restore);
      } else if (scroll) {
        const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (target) target.scrollIntoView();
        else window.scrollTo(0, 0);
      }
      if (focus) /** @type {HTMLElement | null} */ (document.querySelector(focus))?.focus({ preventScroll: true });
    };
    if (animate && transitions) transition(apply); // never blocks: applies within 300 ms regardless
    else apply();
  }

  /**
   * Go to a URL in code, e.g. after saving a form. Plain <a href> links are handled automatically.
   * The same page with a new ?query only updates router.query (the page doesn't re-render).
   * @param {string} to
   * @param {{ replace?: boolean }} [options] replace: don't add a history entry
   */
  function navigate(to, { replace = false } = {}) {
    const url = allowed(new URL(to, location.href));
    if (url.origin !== location.origin) {
      location.href = url.href;
      return;
    }
    if (url.href === location.href) return;
    if (replace) {
      history.replaceState(history.state, '', url);
    } else {
      saveScroll();
      history.pushState(null, '', url);
    }
    if (url.pathname !== path.peek()) {
      go(url, { scroll: true, animate: true });
    } else {
      navigation++; // cancels a slower navigation that is still loading
      search.value = url.search;
    }
  }

  /**
   * Merge values into the URL's ?query. null, '' or [] removes a key; an array writes it once per value
   * (?tag=a&tag=b). The page doesn't re-render.
   * @param {Record<string, string | number | boolean | null | undefined | (string | number)[]>} values
   * @param {{ replace?: boolean }} [options] replace (default): don't add a history entry
   */
  function setQuery(values, { replace = true } = {}) {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(values)) {
      if (Array.isArray(value)) {
        url.searchParams.delete(key);
        for (const v of value) url.searchParams.append(key, String(v));
      } else if (value == null || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    }
    if (url.href === location.href) return;
    if (replace) {
      history.replaceState(history.state, '', url);
    } else {
      saveScroll();
      history.pushState(null, '', url);
    }
    search.value = url.search;
  }

  const linkFrom = (e) => {
    const a = e.composedPath().find((n) => n instanceof HTMLAnchorElement);
    return a && a.href && a.origin === location.origin ? a : null;
  };

  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = linkFrom(e);
    if (!a) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-reload')) return;
    // In-page anchor: let the browser scroll.
    if (a.pathname === location.pathname && a.search === location.search && a.hash) return;
    e.preventDefault();
    navigate(a.href);
  }

  // Start downloading a page's code as soon as the user shows interest in a link to it.
  function onIntent(e) {
    const a = linkFrom(e);
    if (a && !a.hasAttribute('data-reload')) load(resolve(a.pathname).route).catch(() => {});
  }

  // Back/forward isn't animated: browsers (and swipe-back on phones) already animate it.
  function onPopState() {
    clearTimeout(saveTimer); // a pending save belongs to the entry we just left
    const url = allowed(new URL(location.href));
    if (url.origin !== location.origin) return location.replace(url.href);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
    if (url.pathname === path.peek() && url.search === search.peek()) return; // only the #hash changed
    const restore = history.state?.scroll ?? 0;
    if (url.pathname !== path.peek()) {
      go(url, { restore });
    } else {
      navigation++;
      search.value = url.search;
      cancelAnimationFrame(frame);
      scrollBack(restore);
    }
  }

  const intents = prefetch ? ['mouseover', 'focusin', 'touchstart'] : [];
  document.addEventListener('click', onClick);
  for (const type of intents) document.addEventListener(type, onIntent, { passive: true });
  window.addEventListener('popstate', onPopState);
  window.addEventListener('scroll', onScroll, { passive: true });

  return {
    path,
    params,
    /** The URL's ?query as a plain object, e.g. { q: 'ann', page: '2' } (a repeated key keeps its last value). */
    query,
    /** Every value of a repeated ?query key, e.g. queryAll('tag') → ['a', 'b'] for ?tag=a&tag=b. Reactive. */
    queryAll: (key) => new URLSearchParams(search.value).getAll(key),
    view,
    navigate,
    setQuery,
    /** Download the code for the page at `pathname` now (e.g. the next step of a wizard). */
    preload: (pathname) => load(resolve(pathname).route),
    /** Resolves once the first page's code (and layout) has loaded, or failed to. Await it before
     * replacing prerendered HTML, so the page never flashes empty. */
    ready,
    dispose() {
      clearTimeout(saveTimer);
      cancelAnimationFrame(frame);
      document.removeEventListener('click', onClick);
      for (const type of intents) document.removeEventListener(type, onIntent);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('scroll', onScroll);
      history.scrollRestoration = restoration;
    },
  };
}
