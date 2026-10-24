// Animate a DOM change with the browser's View Transitions: removed items fade out, moved items slide.
// Used by the router for page changes, and by apps for list changes (transition(() => todos.value = ...)).

let current = null;

/**
 * Run update() as a view transition when the browser can and the user hasn't asked for reduced motion.
 * update runs exactly once: inside the transition, or right away, or after 300 ms if the browser delays
 * the transition (it may, e.g. in a background tab): an animation must never hold up a change.
 * `kind` is set on <html> as data-transition while it runs, so CSS can style one kind of change (the router's
 * is 'page'): [data-transition="page"]::view-transition-old(page) { ... }
 * @param {() => void} update
 * @param {string} [kind]
 */
export function transition(update, kind) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    update();
  };
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return run();
  const set = document.documentElement.dataset;
  if (kind) set.transition = kind;
  else delete set.transition;
  const t = (current = document.startViewTransition(run));
  const clear = () => current === t && delete set.transition; // a newer transition keeps its own kind
  t.finished?.then(clear, clear);
  // A newer transition skips this one, which rejects these promises: that's expected.
  for (const p of [t.ready, t.finished, t.updateCallbackDone]) p?.catch(() => {});
  setTimeout(run, 300);
}
