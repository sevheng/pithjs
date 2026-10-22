// Animate a DOM change with the browser's View Transitions: removed items fade out, moved items slide.
// Used by the router for page changes, and by apps for list changes (transition(() => todos.value = ...)).

/**
 * Run update() as a view transition when the browser can and the user hasn't asked for reduced motion.
 * update runs exactly once: inside the transition, or right away, or after 300 ms if the browser delays
 * the transition (it may, e.g. in a background tab): an animation must never hold up a change.
 * @param {() => void} update
 */
export function transition(update) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    update();
  };
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return run();
  const t = document.startViewTransition(run);
  // A newer transition skips this one, which rejects these promises: that's expected.
  for (const p of [t.ready, t.finished, t.updateCallbackDone]) p?.catch(() => {});
  setTimeout(run, 300);
}
