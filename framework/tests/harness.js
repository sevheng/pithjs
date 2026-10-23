// Drives the app inside an iframe so tests can click, type and read it the way a person would,
// and describes any page as a text outline (headings, links, buttons, inputs) for tools that can't see.

import { stateText } from './state.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const quote = (s) => JSON.stringify(s);

const INTERACTIVE = 'a[href], button, input, select, textarea, [role="button"], [contenteditable="true"]';
const CLICKABLE = 'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], input[type="submit"], summary';
const TYPEABLE = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]), textarea';
const LANDMARKS = { header: 'header', nav: 'nav', main: 'main', footer: 'footer', aside: 'aside', form: 'form', dialog: 'dialog' };
const SKIP = new Set(['script', 'style', 'template', 'noscript', 'svg', 'head']);

/**
 * @template T
 * @param {() => T} check
 * @param {{ timeout?: number, message?: string | (() => string) }} [options]
 * @returns {Promise<T>}
 */
export async function waitFor(check, { timeout = 3000, message = 'Timed out' } = {}) {
  const end = performance.now() + timeout;
  for (;;) {
    const result = check();
    if (result) return result;
    if (performance.now() > end) throw new Error(typeof message === 'function' ? message() : message);
    await sleep(25);
  }
}

function isVisible(el) {
  if (el.closest('[hidden], [aria-hidden="true"]')) return false;
  return el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : true;
}

// The accessible name: what a screen reader would call this element.
export function nameOf(el) {
  const doc = el.ownerDocument;
  const aria = el.getAttribute('aria-label');
  if (aria) return clean(aria);
  const by = el.getAttribute('aria-labelledby');
  if (by) return clean(by.split(/\s+/).map((id) => doc.getElementById(id)?.textContent).join(' '));
  if (el.labels?.length) return clean([...el.labels].map((l) => l.textContent).join(' '));
  return clean(el.getAttribute('placeholder') || el.getAttribute('alt') || el.getAttribute('title') || el.textContent);
}

function describeControl(el) {
  const flags = [];
  if (el.getAttribute('aria-current')) flags.push('current');
  if (el.disabled) flags.push('disabled');
  if (el.ownerDocument.activeElement === el) flags.push('focused');
  const pressed = el.getAttribute('aria-pressed');
  if (pressed) flags.push(pressed === 'true' ? 'pressed' : 'not pressed');
  const tail = flags.length ? ` (${flags.join(', ')})` : '';
  const tag = el.localName;
  const type = (el.getAttribute('type') || '').toLowerCase();

  if (tag === 'a') return `link ${quote(nameOf(el))} → ${el.getAttribute('href')}${tail}`;
  if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
    return `${el.checked ? '[x]' : '[ ]'} ${type} ${quote(nameOf(el))}${tail}`;
  }
  if (tag === 'input' || tag === 'textarea') {
    const value = el.value ? ` = ${quote(el.value)}` : ' (empty)';
    return `textbox ${quote(nameOf(el))}${value}${tail}`;
  }
  if (tag === 'select') return `select ${quote(nameOf(el))} = ${quote(el.selectedOptions[0]?.textContent ?? '')}${tail}`;
  return `button ${quote(nameOf(el))}${tail}`;
}

const STRUCTURE = `${INTERACTIVE}, label, h1, h2, h3, h4, h5, h6, ul, ol, img, ${Object.keys(LANDMARKS).join(', ')}`;

function isTextBlock(el) {
  if (el.querySelector(STRUCTURE)) return false;
  for (const child of el.querySelectorAll('*')) if (child.localName.includes('-')) return false;
  return true;
}

/**
 * Text outline of a document: headings, landmarks, components, links, buttons, inputs and text.
 * @param {Document} doc
 */
export function outline(doc) {
  const lines = [];
  const pad = (depth) => '  '.repeat(depth);

  const walk = (parent, depth) => {
    for (const node of parent.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = clean(node.data);
        if (text) lines.push(pad(depth) + text);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = /** @type {HTMLElement} */ (node);
      const tag = el.localName;
      if (SKIP.has(tag) || !isVisible(el)) continue;

      if (/^h[1-6]$/.test(tag)) {
        lines.push(`${pad(depth)}${'#'.repeat(+tag[1])} ${clean(el.textContent)}`);
      } else if (el.matches(INTERACTIVE)) {
        lines.push(pad(depth) + describeControl(el));
      } else if (tag === 'label') {
        const control = el.querySelector(INTERACTIVE);
        if (control) {
          lines.push(pad(depth) + describeControl(control));
          // Anything else inside the label besides the control and its name (rare) is skipped.
        }
        // A label pointing at a control by id is shown as that control's name instead.
      } else if (tag.includes('-')) {
        lines.push(`${pad(depth)}<${tag}>`);
        walk(el.shadowRoot ?? el, depth + 1);
      } else if (LANDMARKS[tag]) {
        const label = el.getAttribute('aria-label');
        lines.push(`${pad(depth)}[${LANDMARKS[tag]}${label ? ` ${quote(label)}` : ''}]`);
        walk(el, depth + 1);
      } else if (tag === 'ul' || tag === 'ol') {
        const items = [...el.children].filter((c) => c.localName === 'li' && isVisible(c));
        lines.push(`${pad(depth)}list (${items.length} item${items.length === 1 ? '' : 's'})`);
        walk(el, depth + 1);
      } else if (tag === 'img') {
        lines.push(`${pad(depth)}image ${quote(el.getAttribute('alt') ?? '')}`);
      } else if (isTextBlock(el)) {
        // Only text and inline tags inside: one line.
        const text = clean(el.innerText ?? el.textContent);
        if (text) lines.push(pad(depth) + (tag === 'li' ? '- ' : '') + text);
      } else if (tag === 'li') {
        lines.push(`${pad(depth)}-`);
        walk(el, depth + 1);
      } else {
        walk(el, depth);
      }
    }
  };
  walk(doc.body, 0);
  return lines.join('\n');
}

/** Make an iframe for the app at a realistic size. */
export function createFrame({ width = 1024, height = 768 } = {}) {
  const frame = document.createElement('iframe');
  frame.width = String(width);
  frame.height = String(height);
  frame.style.border = '1px solid #8886';
  document.body.append(frame);
  return frame;
}

/**
 * Control the app in `frame`. Every method waits (up to 3s) for its target, then throws an
 * error that describes what the page actually shows, so a failure says what went wrong.
 * @param {HTMLIFrameElement} frame
 */
export function createApp(frame) {
  const problems = [];
  const doc = () => frame.contentDocument;
  const win = () => frame.contentWindow;
  const where = () => win()?.location.pathname ?? '(not loaded)';
  const pageText = () => clean(doc()?.body?.innerText);

  const listControls = (selector) => {
    const names = [...doc().querySelectorAll(selector)].filter(isVisible).map(describeControl);
    return names.length ? names.map((n) => `  ${n}`).join('\n') : '  (none)';
  };

  const find = (selector, target) => {
    if (/^[#.[]/.test(target)) {
      const el = doc().querySelector(target);
      return el && isVisible(el) ? el : null;
    }
    const all = [...doc().querySelectorAll(selector)].filter(isVisible);
    return all.find((el) => nameOf(el) === target) ?? all.find((el) => nameOf(el).toLowerCase() === target.toLowerCase()) ?? null;
  };

  const watch = () => {
    const w = /** @type {any} */ (win());
    w.addEventListener('error', (e) => problems.push(`Uncaught: ${e.message}`));
    w.addEventListener('unhandledrejection', (e) => problems.push(`Unhandled promise rejection: ${e.reason}`));
    for (const level of ['warn', 'error']) {
      const original = w.console[level].bind(w.console);
      w.console[level] = (...args) => {
        problems.push(`console.${level}: ${args.join(' ')}`);
        original(...args);
      };
    }
  };

  // A timer, not requestAnimationFrame: headless browsers may never paint, so rAF can stall.
  const settle = () => sleep(50);

  return {
    /** Load a page (a full page load, like typing the URL). */
    async go(path) {
      await new Promise((resolve) => {
        frame.onload = resolve;
        frame.src = path;
      });
      // Like a person on the page: its window has focus. Without this, Firefox ignores el.focus() in a new
      // frame once a focused one was removed (each flow gets a fresh frame), so focus checks would fail.
      frame.contentWindow?.focus();
      // A prerendered page (npm run check -- --build) is static until the app replaces it.
      await waitFor(() => !frame.contentDocument?.querySelector('[data-prerendered]'), {
        message: `go(${quote(path)}): the app never replaced the prerendered HTML. Did app/main.js fail to start?`,
      });
      // Pages load their code lazily: wait until one has rendered (every route renders an <h1>), with
      // room for a busy machine, so a flow's first step doesn't race the page's code.
      await waitFor(() => frame.contentDocument?.querySelector('h1'), {
        timeout: 10_000,
        message: () => `go(${quote(path)}): no page rendered (no <h1>) within 10 s. The page shows:\n${outline(doc())}`,
      });
      watch();
      await settle();
    },

    /** Click a button, link or checkbox by its visible name or aria-label, or by CSS selector (#id, .class, [attr]). */
    async click(target) {
      const el = await waitFor(() => find(CLICKABLE, target), {
        message: () => `click(${quote(target)}): no button, link or checkbox with that name on ${where()}. Clickable things on the page:\n${listControls(CLICKABLE)}`,
      });
      if (el.disabled) throw new Error(`click(${quote(target)}): it is disabled.`);
      el.click();
      await settle();
    },

    /** Replace the text of an input or textarea, found by its label, placeholder, aria-label or CSS selector. */
    async type(target, text) {
      const el = await waitFor(() => find(TYPEABLE, target), {
        message: () => `type(${quote(target)}): no text field with that label on ${where()}. Text fields on the page:\n${listControls(TYPEABLE)}`,
      });
      el.focus();
      // Use the native value setter, like real typing does. Plain `el.value = text` skips the
      // value tracking some frameworks (e.g. React) use to notice changes.
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    },

    /** Choose an option (by its visible text or value) in a dropdown found by its label. */
    async select(target, option) {
      const el = /** @type {HTMLSelectElement} */ (await waitFor(() => find('select', target), {
        message: () => `select(${quote(target)}): no dropdown with that label on ${where()}. Dropdowns on the page:\n${listControls('select')}`,
      }));
      const opt = [...el.options].find((o) => clean(o.textContent) === option || o.value === option);
      if (!opt) {
        throw new Error(`select(${quote(target)}, ${quote(option)}): no such option. Options: ${[...el.options].map((o) => quote(clean(o.textContent))).join(', ')}`);
      }
      el.focus();
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set?.call(el, opt.value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    },

    /** Press Enter in the focused field: submits its form. */
    async pressEnter() {
      const el = /** @type {HTMLInputElement | null} */ (doc().activeElement);
      if (!el?.form) throw new Error('pressEnter(): the focused element is not inside a form.');
      el.form.requestSubmit();
      await settle();
    },

    /** Wait until the visible page text contains `text`. */
    async see(text) {
      await waitFor(() => pageText().includes(text), {
        message: () => `see(${quote(text)}): not found on ${where()}. The page shows:\n${outline(doc())}`,
      });
    },

    /** Wait until the visible page text no longer contains `text`. */
    async notSee(text) {
      await waitFor(() => !pageText().includes(text), {
        message: () => `notSee(${quote(text)}): still visible on ${where()}. The page shows:\n${outline(doc())}`,
      });
    },

    /** Wait until the URL path is `path`. */
    async expectPath(path) {
      await waitFor(() => where() === path, { message: () => `expectPath(${quote(path)}): the path is ${where()}.` });
    },

    /** Browser back button. */
    async back() {
      win().history.back();
      await settle();
    },

    /** Wait (up to 3s) until `check()` is truthy, else throw `message`. */
    waitFor: (check, message) => waitFor(check, { message: () => `${message}\nThe page shows:\n${outline(doc())}` }),

    /** Throw `message` unless `condition` is truthy. */
    expect(condition, message) {
      if (!condition) throw new Error(`${message}\nThe page shows:\n${outline(doc())}`);
    },

    query: (selector) => doc().querySelector(selector),
    queryAll: (selector) => [...doc().querySelectorAll(selector)],
    outline: () => outline(doc()),
    get document() { return doc(); },
    get window() { return win(); },
    /** Errors and console warnings the app produced (checked automatically after each flow). */
    problems,
  };
}

// ---------- Flow runner ----------

const flows = [];

/**
 * Register a user flow: a short script of what a person does and what they should see.
 * @param {string} name
 * @param {(app: ReturnType<typeof createApp>) => Promise<void>} fn
 */
export function flow(name, fn) {
  flows.push({ name, fn });
}

export async function runFlows() {
  const results = [];
  const summary = document.getElementById('summary');
  for (const [i, { name, fn }] of flows.entries()) {
    if (summary) summary.textContent = `Running ${i + 1}/${flows.length}: ${name}`;
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    const frame = createFrame();
    const app = createApp(frame);
    try {
      await fn(app);
      if (app.problems.length) throw new Error(`The app reported problems:\n  ${app.problems.join('\n  ')}`);
      results.push([name, null]);
    } catch (err) {
      // Every failure also says what the app holds: pages, stores, components. Only when the app records
      // it (Pith in dev mode); for anything else the block would just be noise.
      const error = typeof err?.message === 'string' ? err : new Error(String(err)); // may be from the app's realm
      if (/** @type {any} */ (frame.contentWindow)?.__pith) error.message += `\nState:\n${stateText(frame.contentWindow)}`;
      results.push([name, error]);
    }
    frame.remove();
  }
  return results;
}

/** Print results in the format tools/check.mjs reads. */
export function report(results) {
  const failed = results.filter(([, e]) => e);
  const list = document.getElementById('results');
  list.append(...results.map(([name, err]) => {
    const li = document.createElement('li');
    li.className = err ? 'fail' : 'pass';
    li.textContent = `${err ? '✗' : '✓'} ${name}${err ? ` (${err.message})` : ''}`;
    return li;
  }));
  const summary = document.getElementById('summary');
  summary.textContent = `${results.length - failed.length}/${results.length} passed`;
  summary.className = failed.length ? 'fail' : 'pass';
  document.title = failed.length ? 'FAIL' : 'PASS';
}
