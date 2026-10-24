// Animate a DOM change with the browser's View Transitions: removed items fade out, moved items slide.
// Used by the router for page changes, and by apps for list changes (transition(() => todos.value = ...)).

import { DEV, warn } from './dev.js';

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
  if (DEV) checkLayers(); // after the start: styles for :active-view-transition apply now
  const clear = () => current === t && delete set.transition; // a newer transition keeps its own kind
  t.finished?.then(clear, clear);
  // A newer transition skips this one, which rejects these promises: that's expected.
  for (const p of [t.ready, t.finished, t.updateCallbackDone]) p?.catch(() => {});
  setTimeout(run, 300);
}

// W050: while they animate, elements with a view-transition-name are drawn above everything else. A sticky or
// fixed bar without a layer of its own (a header, a toolbar) is covered when one passes under it. Bars beside the
// animated elements (a sidebar column) can't be, so only bars sharing their columns are reported.
function checkLayers() {
  const name = (el) => `<${el.localName}${el.id ? `#${el.id}` : ''}${el.classList.length ? `.${[...el.classList].join('.')}` : ''}>`;
  const named = [];
  const bars = [];
  for (const el of document.body.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    const stuck = style.position === 'sticky' || style.position === 'fixed';
    const layer = style.viewTransitionName && style.viewTransitionName !== 'none';
    if (layer && !stuck) named.push(el); // a bar with its own layer isn't something that moves under the others
    else if (stuck && !layer && el.checkVisibility()) bars.push(el); // not in a closed <details>, display: none, …
  }
  // W051: a scroll box doesn't clip the animated elements inside it, so the ones scrolled out of its view are drawn
  // outside it while they animate (over the rest of the page).
  for (const n of named) {
    for (let box = n.parentElement; box && box !== document.body; box = box.parentElement) {
      const s = getComputedStyle(box);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const r = n.getBoundingClientRect();
      const v = box.getBoundingClientRect();
      if (r.top < v.top - 1 || r.bottom > v.bottom + 1 || r.left < v.left - 1 || r.right > v.right + 1) {
        warn('W051', `${name(n)} animates in transition() while it's outside the visible part of the scroll box ${name(box)}, so it's drawn outside that box. Don't animate elements inside a scroll box (no class="motion" or view-transition-name on them); let the box change at once, or animate the box itself.`);
        return;
      }
      break;
    }
  }
  for (const bar of bars) {
    const b = bar.getBoundingClientRect();
    const under = named.find((n) => {
      if (n.contains(bar) || bar.contains(n)) return false; // in the same layer
      const r = n.getBoundingClientRect();
      return r.left < b.right && r.right > b.left;
    });
    if (under) {
      warn('W050', `${name(bar)} is ${getComputedStyle(bar).position} without a view-transition-name, so during transition() animated elements such as ${name(under)} are drawn over it when they pass under it. Give it a layer while transitions run: :root:active-view-transition ${bar.localName}${bar.id ? `#${bar.id}` : ''} { view-transition-name: my-bar; } and ::view-transition-group(my-bar) { z-index: 1; }.`);
    }
  }
}

