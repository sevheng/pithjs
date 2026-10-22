// define('my-tag', (props, ctx) => html`...`) turns a setup function into a Custom Element.
// setup runs once when the element is connected; everything it creates is cleaned up on removal.

import { signal, root, onCleanup, catchError } from './signal.js';
import { html, toNodes } from './html.js';
import { DEV, warn, error, describe } from './dev.js';

/**
 * @typedef {object} ComponentContext
 * @property {HTMLElement} host the element itself
 * @property {Node[]} children child nodes the element had before it rendered
 * @property {(name?: string) => Node[]} slot children with slot="name"; with no name, the rest (minus blank text)
 * @property {(fn: () => void | (() => void)) => void} onMount runs after first render; may return a cleanup
 * @property {(fn: () => void) => void} onCleanup runs when the element is removed
 * @property {(type: string, detail?: unknown) => boolean} emit dispatch a bubbling CustomEvent
 */

/** @type {HTMLElement | null} the component whose setup is running now */
let current = null;
/** @type {WeakMap<Node, Map<unknown, unknown>>} values each host provides */
const provided = new WeakMap();

/**
 * Make value available to inject(key) in this component's descendants. Call inside setup.
 * @param {unknown} key
 * @param {unknown} value
 */
export function provide(key, value) {
  if (!current) {
    DEV && warn('W030', `provide(${describe(key)}) was called outside a component's setup, so nothing can inject it.`);
    return;
  }
  if (!provided.has(current)) provided.set(current, new Map());
  provided.get(current).set(key, value);
}

/**
 * Get the value the nearest ancestor component provided for key (crossing shadow roots),
 * or fallback if none did. Call inside setup.
 * @template T
 * @param {unknown} key
 * @param {T} [fallback]
 * @returns {T | any}
 */
export function inject(key, fallback) {
  if (!current) {
    DEV && warn('W031', `inject(${describe(key)}) was called outside a component's setup, so it can't find a provider.`);
    return fallback;
  }
  /** @type {Node | null} */
  let node = current;
  while ((node = node.parentNode ?? /** @type {ShadowRoot} */ (node).host ?? null)) {
    const values = provided.get(node);
    if (values?.has(key)) return values.get(key);
  }
  return fallback;
}

// Shown when a component without its own fallback throws.
const defaultFallback = (err, retry) => html`
  <div class="load-error" role="alert">
    <p>Something went wrong. ${err?.message ?? String(err)}</p>
    <button class="btn" type="button" @click=${retry}>Try again</button>
  </div>
`;

/**
 * Turn a setup function into a Custom Element. setup runs once per mount and returns html`...`.
 * Each name in `props` becomes a signal fed by the attribute of the same name and the el.name property.
 * If setup or one of its reactive holes throws, `fallback(err, retry)` renders instead (retry re-runs setup).
 * @template {string} P
 * @param {string} name tag name; must contain a dash, e.g. 'todo-list'
 * @param {(props: Record<P, import('./signal.js').Signal<any>>, ctx: ComponentContext) => unknown} setup
 * @param {{ props?: P[], shadow?: boolean, styles?: string, fallback?: (err: any, retry: () => void) => unknown }} [options]
 * @returns {CustomElementConstructor}
 */
export function define(name, setup, { props = [], shadow = false, styles = '', fallback } = {}) {
  if (customElements.get(name)) return customElements.get(name);
  if (typeof setup !== 'function') {
    throw error('E004', `define('${name}', setup): setup must be a function that returns html\`...\`.`, TypeError);
  }
  for (const p of props) {
    if (p !== p.toLowerCase()) {
      DEV && warn(
        'W009',
        `define('${name}'): prop "${p}" has capital letters, but HTML attribute names are lowercase, ` +
          `so the attribute will never reach it. Use "${p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}".`
      );
    }
  }

  class MiniElement extends HTMLElement {
    static observedAttributes = props;

    constructor() {
      super();
      /** @type {Record<string, import('./signal.js').Signal<any>>} */
      this._props = {};
      for (const p of props) {
        this._props[p] = signal(null);
        // A property set before the element upgraded would shadow the accessor; move it over.
        if (Object.hasOwn(this, p)) {
          const self = /** @type {any} */ (this);
          const v = self[p];
          delete self[p];
          this._props[p].value = v;
        }
      }
      this._dispose = null;
      this._children = null;
    }

    attributeChangedCallback(attr, _old, value) {
      this._props[attr].value = value;
    }

    connectedCallback() {
      if (this._dispose) return; // moved within the page, still mounted
      // A parent component may move us into its (detached) template first: set up once we're really in
      // the page, so inject() can reach providers. Prerendered markup waits for the app to replace it.
      if (!this.isConnected || this.closest('[data-prerendered]')) return;
      this._children ??= [...this.childNodes];
      this._mount();
    }

    _target() {
      return shadow ? (this.shadowRoot ?? this.attachShadow({ mode: 'open' })) : this;
    }

    // Run setup in its own scope; an error there or in a hole later swaps in the fallback.
    _mount() {
      const target = this._target();
      let rendering = true;
      /** @type {{ err: unknown } | null} */
      let failure = null;
      const onError = (err) => {
        if (failure) return; // already showing the fallback
        failure = { err };
        if (!rendering) this._fail(err);
      };

      root((dispose) => {
        this._dispose = dispose;
        catchError(() => {
          const mounted = [];
          const children = this._children;
          const ctx = {
            host: this,
            children,
            slot: (slotName) =>
              children.filter((n) => {
                const slot = n.nodeType === Node.ELEMENT_NODE ? /** @type {Element} */ (n).getAttribute('slot') : null;
                if (slotName !== undefined) return slot === slotName;
                return slot === null && !(n.nodeType === Node.TEXT_NODE && !n.textContent.trim());
              }),
            onMount: (fn) => mounted.push(fn),
            onCleanup,
            emit: (type, detail) =>
              this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })),
          };
          provided.delete(this);
          const prev = current;
          current = this;
          let view;
          try {
            view = setup(this._props, ctx);
          } finally {
            current = prev;
          }
          if (view === undefined) {
            DEV && warn('W007', `<${name}> setup returned nothing, so it renders empty. Did you forget "return html\`...\`"?`);
          } else if (typeof view === 'function') {
            DEV && warn('W008', `<${name}> setup returned ${describe(view)}. Return html\`<div>\${fn}</div>\` to make it reactive.`);
          }
          const nodes = typeof view === 'function' ? [] : toNodes(view);
          if (failure) return; // a hole threw while rendering
          this._addStyles(nodes);
          target.replaceChildren(...nodes);
          for (const fn of mounted) {
            const cleanup = fn();
            if (typeof cleanup === 'function') onCleanup(cleanup);
          }
        }, onError);
      });
      rendering = false;
      if (failure) this._fail(failure.err);
    }

    _addStyles(nodes) {
      if (shadow && styles) {
        const style = document.createElement('style');
        style.textContent = styles;
        nodes.unshift(style);
      }
    }

    // Drop everything setup made and show the fallback in its place.
    _fail(err) {
      this._dispose?.();
      if (!fallback) console.error(`[mini] <${name}> failed to render:`, err);
      const retry = () => {
        this._dispose?.();
        this._dispose = null;
        if (this.isConnected) this._mount();
      };
      root((dispose) => {
        this._dispose = dispose;
        const nodes = toNodes((fallback ?? defaultFallback)(err, retry));
        this._addStyles(nodes);
        this._target().replaceChildren(...nodes);
      });
    }

    disconnectedCallback() {
      // Wait a tick: a move (remove + insert) shouldn't destroy the component's state.
      queueMicrotask(() => {
        if (!this.isConnected && this._dispose) {
          this._dispose();
          this._dispose = null;
        }
      });
    }
  }

  for (const p of props) {
    Object.defineProperty(MiniElement.prototype, p, {
      get() { return this._props[p].value; },
      set(v) { this._props[p].value = v; },
    });
  }

  customElements.define(name, MiniElement);
  return MiniElement;
}
