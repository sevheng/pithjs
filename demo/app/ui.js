// Dialogs and toasts for this app: dialog(), confirm() and toast(), built on the browser's <dialog> and
// popover. App code, not part of Mini: copy it into your own app and restyle it (see "UI helpers" in
// styles/main.css). Import it from the page or component that uses it, so other pages never load it.
import { html, root } from 'mini';

let ids = 0;
const canPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

/**
 * Open a modal dialog. `render(close)` returns its content; `close(value)` resolves the promise with
 * value. Esc and a click on the backdrop resolve `undefined`. On close the dialog is removed, its
 * effects are disposed, and focus returns to where it was.
 * @template [T=unknown]
 * @param {(close: (value?: T) => void) => unknown} render
 * @param {{ label?: string }} [options] accessible name; without it, the first heading names the dialog
 * @returns {Promise<T | undefined>}
 */
export function dialog(render, { label } = {}) {
  return new Promise((resolve) => {
    const before = /** @type {HTMLElement | null} */ (document.activeElement);
    const el = document.createElement('dialog');
    el.className = 'mini-dialog';
    let done = false;
    /** @param {T} [value] */
    const close = (value) => {
      if (done) return;
      done = true;
      if (el.open) el.close();
      el.remove();
      raiseToasts(); // bring toasts back out if they were inside this dialog
      dispose();
      if (before?.isConnected) before.focus?.();
      resolve(value);
    };

    // The body fills the dialog, so a click whose target is the <dialog> itself hit the backdrop.
    const body = document.createElement('div');
    body.className = 'mini-dialog-body';
    el.append(body);
    const dispose = root((d) => (body.append(html`${render(close)}`), d));

    if (label) el.setAttribute('aria-label', label);
    else {
      const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) el.setAttribute('aria-labelledby', heading.id ||= `mini-dialog-${++ids}`);
      else console.warn('dialog() has no name: pass { label } or start its content with a heading.');
    }

    el.addEventListener('cancel', (e) => (e.preventDefault(), close()));
    el.addEventListener('close', () => close()); // e.g. a <form method="dialog"> inside
    el.addEventListener('click', (e) => e.target === el && close());

    document.body.append(el);
    el.showModal();
    raiseToasts(); // toasts already showing stay above the new dialog
  });
}

/**
 * Ask a yes/no question in a modal dialog. Resolves true for OK, false for Cancel, Esc or the backdrop.
 * @param {string} message
 * @param {{ ok?: string, cancel?: string, danger?: boolean }} [options] danger: OK is red, focus starts on Cancel
 * @returns {Promise<boolean>}
 */
export async function confirm(message, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  const answer = await dialog((close) => html`
    <p class="mini-dialog-message">${message}</p>
    <div class="mini-dialog-actions">
      <button type="button" class="btn" ?autofocus=${danger} @click=${() => close(false)}>${cancel}</button>
      <button type="button" class=${danger ? 'btn primary danger' : 'btn primary'} ?autofocus=${!danger}
        @click=${() => close(true)}>${ok}</button>
    </div>
  `, { label: message });
  return answer === true;
}

/** @type {HTMLElement | null} */
let region = null;

const TYPES = ['info', 'success', 'error'];

/**
 * Show a short message in the corner. Returns a function that dismisses it.
 * @param {unknown} message text, or a signal/function for live text
 * @param {{ type?: 'info' | 'success' | 'error', timeout?: number }} [options] timeout in ms; 0 = stays until dismissed
 * @returns {() => void}
 */
export function toast(message, { type = 'info', timeout = 4000 } = {}) {
  if (!TYPES.includes(type)) console.warn(`toast() type "${type}" is not one of ${TYPES.join(', ')}.`);
  if (!region?.isConnected) {
    region = document.createElement('div');
    region.className = 'mini-toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    if (canPopover) region.setAttribute('popover', 'manual');
    document.body.append(region);
  }

  let timer = 0;
  const start = () => { if (timeout > 0) timer = setTimeout(dismiss, timeout); };
  const stop = () => clearTimeout(timer);
  /** @type {() => void} */
  let dispose = () => {};
  const node = root((d) => {
    dispose = d;
    return html`
      <div class=${`mini-toast ${type}`} role=${type === 'error' ? 'alert' : null}>
        <p class="mini-toast-text">${message}</p>
        <button type="button" class="mini-toast-close" aria-label="Dismiss" @click=${() => dismiss()}>×</button>
      </div>
    `.firstElementChild;
  });
  const dismiss = () => {
    stop();
    if (!node.isConnected) return;
    node.remove();
    dispose();
    if (region && !region.childElementCount) {
      if (canPopover && region.matches(':popover-open')) region.hidePopover();
      region.remove();
      region = null;
    }
  };

  // Pause while the person points at or tabs into it, so it can be read and dismissed.
  node.addEventListener('mouseenter', stop);
  node.addEventListener('mouseleave', start);
  node.addEventListener('focusin', stop);
  node.addEventListener('focusout', start);

  region.append(node);
  raiseToasts();
  start();
  return dismiss;
}

// Keep toasts on top and clickable: a modal dialog makes everything outside it inert, so the region
// moves into the topmost open modal (or back to <body>), then is re-shown as the newest top-layer element.
function raiseToasts() {
  if (!region) return;
  const host = [...document.querySelectorAll('dialog')].filter((d) => d.matches(':modal')).pop() ?? document.body;
  if (region.parentElement !== host) host.append(region);
  if (!canPopover) return;
  if (region.matches(':popover-open')) region.hidePopover();
  region.showPopover();
}
