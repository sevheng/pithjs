// Keeps clicks and typed text from the moment before the app starts on a prerendered page.
// Not part of 'pith': npm run build inlines it into prerendered HTML (see tools/replay.mjs), as
// `(${capture})(document.getElementById('app'))`, so it must stay self-contained (no imports, no outer names).
//   Until the app replaces the [data-prerendered] markup, its components don't run. Meanwhile:
//   - clicks on buttons, [role=button], checkboxes, radios and <summary> are cancelled and held (at most 5),
//     submits too (so the page doesn't reload). Plain links are left alone: they work without JS.
//   - when the live app replaces the markup, each held element is found again by its position among
//     elements (same path from #app), and only if it looks the same (tag + text or aria-label):
//     typed values are copied over (with input/change events), focus and caret come back, then the held
//     clicks and submits replay in order.
//   - if the app hasn't started after `timeout` ms, it stops holding anything (the page acts natively).

/**
 * @param {HTMLElement | null} app the #app element holding the [data-prerendered] markup
 * @param {{ timeout?: number }} [options] timeout: ms to wait for the live app before giving up
 */
export function capture(app, { timeout = 1e4 } = {}) {
  const wrap = app && app.querySelector('[data-prerendered]');
  if (!wrap) return;
  /** @type {Element[]} */
  const held = [];
  const typed = new Set();
  /** @type {any} */
  let focused;
  let waiting = true;
  const hold = (/** @type {Event} */ e, /** @type {Element | null} */ el) => {
    if (waiting && el && wrap.contains(el)) {
      e.preventDefault();
      if (held.length < 5) held.push(el);
      wrap.setAttribute('data-pending', '');
    }
  };
  /** @type {Record<string, (e: any) => void>} */
  const on = {
    click(e) { hold(e, e.target.closest('button,[role=button],summary,[type=checkbox],[type=radio],[type=submit],[type=button]')); },
    submit(e) { hold(e, e.target); },
    input(e) { typed.add(e.target); },
    focusin(e) { focused = e.target; },
    // Focus left the page's fields (but not because the live app replaced them: Chrome fires focusout then too).
    focusout(e) { setTimeout(() => focused == e.target && wrap.parentNode == app && (focused = 0)); },
  };
  // The same element in the live app: the same child-element index at each level, #app for the wrapper.
  /** @type {(el: any) => any} */
  const live = (el) => (el == wrap ? app : live(el.parentElement)?.children[[...el.parentElement.children].indexOf(el)]);
  const looks = (/** @type {Element} */ el) => el.tagName + (el.getAttribute('aria-label') || el.textContent.trim());
  // Stop holding clicks (the listeners stay, but do nothing; the wrapper is gone or about to be).
  const stop = () => {
    waiting = false;
    observer.disconnect();
    wrap.removeAttribute('data-pending');
  };
  const observer = new MutationObserver(() => {
    if (wrap.parentNode == app) return;
    stop();
    for (const el of typed) {
      const now = live(el);
      if (now && now.tagName == el.tagName) {
        now.value = el.value;
        for (const type of ['input', 'change']) now.dispatchEvent(new Event(type, { bubbles: true }));
      }
    }
    const now = focused && live(focused);
    if (now) {
      now.focus();
      try { now.setSelectionRange(focused.selectionStart, focused.selectionEnd); } catch {}
    }
    for (const el of held) {
      const now = live(el);
      if (now && looks(now) == looks(el)) el.tagName == 'FORM' ? now.requestSubmit() : now.click();
    }
  });
  observer.observe(app, { childList: true });
  for (const type in on) wrap.addEventListener(type, on[type], true);
  setTimeout(stop, timeout);
}
