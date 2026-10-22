// Data loading. resource(fetcher) runs the fetcher, tracks loading/error/data, re-runs it when a signal
// it read changes (cancelling the old request), and renders the right view for each state.
// paginated(fetcher) builds on it to load a list page by page.

import { signal, computed, effect, untrack, batch, onCleanup } from './signal.js';
import { html } from './html.js';
import { DEV, warn, describe, recording, record, silently } from './dev.js';

/** A non-2xx response. `body` is the parsed JSON (or text) the server sent back. */
export class HttpError extends Error {
  /**
   * @param {Response} response
   * @param {any} body
   */
  constructor(response, body) {
    super(body?.message ?? `Request failed: ${response.status} ${response.statusText}`.trim());
    this.name = 'HttpError';
    this.status = response.status;
    this.body = body;
  }
}

/**
 * fetch() for JSON APIs: sends `json` as the body (POST by default), parses the reply,
 * and throws HttpError for non-2xx responses (with the server's JSON on `error.body`).
 * @param {string} url
 * @param {RequestInit & { json?: unknown }} [options]
 * @returns {Promise<any>}
 */
export async function fetchJSON(url, { json, headers, method, ...init } = {}) {
  const hasJson = json !== undefined;
  const response = await fetch(url, {
    ...init,
    method: method ?? (hasJson ? 'POST' : 'GET'),
    headers: { Accept: 'application/json', ...(hasJson ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: hasJson ? JSON.stringify(json) : init.body,
  });
  const text = await response.text();
  let body = text || null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // not JSON: keep the text
  }
  if (!response.ok) throw new HttpError(response, body);
  return body;
}

const defaultLoading = () => html`<p class="loading" role="status">Loading…</p>`;
const defaultError = (err, retry) => html`
  <div class="load-error" role="alert">
    <p>Couldn't load this. ${err?.message ?? String(err)}</p>
    <button class="btn" type="button" @click=${retry}>Try again</button>
  </div>
`;

/**
 * Load async data. Signals read by `fetcher` before its first `await` are tracked:
 * when they change, the old request is aborted and the fetcher runs again.
 * @template T
 * @param {(ctx: { signal: AbortSignal }) => Promise<T> | T} fetcher pass ctx.signal to fetch/fetchJSON
 */
export function resource(fetcher) {
  if (DEV && recording()) return record('resource', silently(() => resource(fetcher)));
  const data = signal(/** @type {T | undefined} */ (undefined));
  const error = signal(/** @type {any} */ (null));
  const loading = signal(false);
  const hasData = signal(false);
  const version = signal(0);
  let latest = 0;
  // Optimistic updates: data = the confirmed value with every unsaved update applied on top, in order.
  /** @type {T | undefined} */
  let base;
  /** @type {{ update: (data: T) => T }[]} */
  let unsaved = [];
  const show = () => unsaved.reduce((d, u) => u.update(d), /** @type {T} */ (base));
  /** @param {T} value */
  const confirm = (value) => {
    base = value;
    batch(() => {
      data.value = show();
      hasData.value = true;
      error.value = null;
    });
  };

  effect(() => {
    version.value; // refetch() bumps this
    const id = ++latest;
    const controller = new AbortController();
    let request;
    try {
      request = Promise.resolve(fetcher({ signal: controller.signal }));
    } catch (err) {
      request = Promise.reject(err);
    }
    untrack(() => batch(() => {
      loading.value = true;
      error.value = null;
    }));
    request.then(
      (value) => {
        if (id !== latest) return; // a newer request replaced this one
        batch(() => {
          confirm(value);
          loading.value = false;
        });
      },
      (err) => {
        if (id !== latest || controller.signal.aborted) return;
        batch(() => {
          error.value = err;
          loading.value = false;
        });
      }
    );
    return () => controller.abort();
  });

  /** @type {import('./signal.js').ReadonlySignal<'loading' | 'error' | 'ready'>} */
  const status = computed(() => (error.value ? 'error' : hasData.value ? 'ready' : 'loading'));
  const refetch = () => { version.value++; };

  return {
    /** The latest loaded data (undefined until the first load finishes). */
    data: /** @type {import('./signal.js').ReadonlySignal<T | undefined>} */ (data),
    /** The error from the latest request, or null. */
    error: /** @type {import('./signal.js').ReadonlySignal<any>} */ (error),
    /** True while any request is in flight, including refetches that keep old data on screen. */
    loading: /** @type {import('./signal.js').ReadonlySignal<boolean>} */ (loading),
    /** 'loading' (nothing loaded yet), 'error', or 'ready'. */
    status,
    /** Run the fetcher again. */
    refetch,
    /**
     * Replace the data locally, e.g. right after a successful save.
     * @param {T} value
     */
    mutate(value) {
      confirm(value);
    },
    /**
     * Show a change before the server confirms it: applies `update(data)` now, then awaits `save()`.
     * If save resolves to a value (not undefined) that becomes the data; otherwise the update is kept.
     * If save rejects, the update is undone and the error rethrown (so form() shows it as submitError).
     * Concurrent calls are independent: a failure undoes only its own update, and the others stay
     * applied on top of whatever is confirmed (so `update` must be pure: it may run more than once).
     * @template R
     * @param {(data: T) => T} update
     * @param {() => Promise<R> | R} save
     * @returns {Promise<R>}
     */
    async optimistic(update, save) {
      const entry = { update };
      unsaved = [...unsaved, entry];
      batch(() => {
        data.value = show();
        hasData.value = true;
      });
      const drop = () => { unsaved = unsaved.filter((u) => u !== entry); };
      let result;
      try {
        result = await save();
      } catch (err) {
        drop();
        data.value = show();
        throw err;
      }
      drop();
      // Confirmed: the server's value, or the update applied to the confirmed data.
      confirm(result !== undefined ? /** @type {T} */ (/** @type {unknown} */ (result)) : update(/** @type {T} */ (base)));
      return result;
    },
    /**
     * Use as a template hole: ${people.render((list) => html`...`)}.
     * Shows `loading` until the first data arrives, `error` (with a retry function) on failure, else `ready`.
     * During a refetch the previous data stays on screen.
     * @param {((data: T) => unknown) | { ready: (data: T) => unknown, loading?: () => unknown, error?: (err: any, retry: () => void) => unknown }} views
     */
    render(views) {
      const v = typeof views === 'function' ? { ready: views } : views;
      return () => {
        const s = status.value;
        if (s === 'loading') return untrack(v.loading ?? defaultLoading);
        if (s === 'error') {
          const err = error.value;
          return untrack(() => (v.error ?? defaultError)(err, refetch));
        }
        const value = /** @type {T} */ (data.value);
        return untrack(() => v.ready(value));
      };
    },
  };
}

/**
 * @template I
 * @typedef {I[] | { items: I[], next?: unknown }} Page  an array, or items plus a cursor (null/undefined = last page)
 */

/**
 * Load a list page by page. `fetcher` gets `{ page, next, signal }` (page starts at 1; `next` is the
 * previous page's cursor) and returns an array or `{ items, next }`. Like resource(), signals it reads
 * before its first `await` are tracked: a change aborts everything and reloads from page 1.
 * @template I
 * @param {(ctx: { page: number, next: unknown, signal: AbortSignal }) => Promise<Page<I>> | Page<I>} fetcher
 * @param {{ pageSize?: number }} [options] with pageSize, an array shorter than it is the last page
 *   (without, an empty array is)
 */
export function paginated(fetcher, { pageSize } = {}) {
  if (DEV && recording()) return record('paginated', silently(() => paginated(fetcher, { pageSize })));
  const loadingMore = signal(false);
  const moreError = signal(/** @type {any} */ (null));
  /** @type {AbortController | null} */
  let more = null;

  /** @param {Page<I>} result @param {number} page */
  const toPage = (result, page) => {
    if (Array.isArray(result)) {
      return { items: result, next: undefined, page, hasMore: pageSize ? result.length >= pageSize : result.length > 0 };
    }
    if (!Array.isArray(result?.items)) {
      DEV && warn('W040', `paginated(): the fetcher returned ${describe(result)} for page ${page}. Return an array or { items, next }.`);
      return { items: [], next: undefined, page, hasMore: false };
    }
    return { items: result.items, next: result.next, page, hasMore: result.next != null };
  };

  const stopMore = () => {
    more?.abort();
    more = null;
    batch(() => {
      loadingMore.value = false;
      moreError.value = null;
    });
  };
  onCleanup(() => more?.abort());

  // Page 1 is a plain resource: it handles tracking, aborting, late replies and the render states.
  const pages = resource((ctx) => {
    untrack(stopMore);
    return Promise.resolve(fetcher({ page: 1, next: undefined, signal: ctx.signal })).then((r) => toPage(r, 1));
  });

  const items = computed(() => pages.data.value?.items ?? []);
  const hasMore = computed(() => pages.data.value?.hasMore ?? false);

  function loadMore() {
    const current = pages.data.peek();
    if (!current?.hasMore || pages.loading.peek() || loadingMore.peek()) return;
    const controller = (more = new AbortController());
    const page = current.page + 1;
    batch(() => {
      loadingMore.value = true;
      moreError.value = null;
    });
    let request;
    try {
      request = Promise.resolve(untrack(() => fetcher({ page, next: current.next, signal: controller.signal })));
    } catch (err) {
      request = Promise.reject(err);
    }
    request.then(
      (result) => {
        if (more !== controller) return; // reset or removed meanwhile
        more = null;
        const next = toPage(result, page);
        batch(() => {
          pages.mutate({ ...next, items: [...(pages.data.peek()?.items ?? []), ...next.items] });
          loadingMore.value = false;
        });
      },
      (err) => {
        if (more !== controller) return;
        more = null;
        batch(() => {
          moreError.value = err;
          loadingMore.value = false;
        });
      }
    );
  }

  return {
    /** Every item loaded so far. */
    items: /** @type {import('./signal.js').ReadonlySignal<I[]>} */ (items),
    /** True while page 1 is loading (first load, refetch or a tracked signal changed). */
    loading: pages.loading,
    /** True while loadMore() is fetching the next page. */
    loadingMore: /** @type {import('./signal.js').ReadonlySignal<boolean>} */ (loadingMore),
    /** The page 1 error or the last loadMore() error, or null. */
    error: /** @type {import('./signal.js').ReadonlySignal<any>} */ (computed(() => pages.error.value ?? moreError.value)),
    /** False once the last page is loaded. */
    hasMore: /** @type {import('./signal.js').ReadonlySignal<boolean>} */ (hasMore),
    /** Fetch the next page and append it. Does nothing while loading or when there is no more. Retries after an error. */
    loadMore,
    /** Reload from page 1. */
    refetch: pages.refetch,
    /**
     * Like resource().render, over the loaded items. A loadMore() error keeps the items on screen
     * (show `error` next to your "Load more" button).
     * @param {((items: I[]) => unknown) | { ready: (items: I[]) => unknown, loading?: () => unknown, error?: (err: any, retry: () => void) => unknown }} views
     */
    render(views) {
      const v = typeof views === 'function' ? { ready: views } : views;
      return pages.render({ ...v, ready: (page) => v.ready(page.items) });
    },
  };
}
