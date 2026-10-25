import { ref, shallowRef, shallowReactive, computed } from 'vue';
import { createFeed, sizeFromUrl, TAPE } from '../../../shared/trade/feed.js';

// The trading screen's state, shared by its components (Vue's "simple state management with the Reactivity
// API"). Each quote is a shallowReactive object whose fields are set in place on a tick: only the components
// that read a field that changed render again. Arrays that change (sparkline, tape) are replaced, not mutated.

export const feed = createFeed({ n: sizeFromUrl() });

/** The list never changes (no rows added or removed), so it's a plain array of reactive quotes. */
export const quotes = feed.symbols.map((s) => shallowReactive({ ...s, move: 0, ticks: 0 }));
export const selected = ref(quotes[0].symbol);
export const tape = shallowRef(feed.trades(selected.value));
export const current = computed(() => quotes[feed.indexOf(selected.value)]);

/** Apply one step of the feed: set every tick's fields; Vue's scheduler updates the DOM once, after. */
export function step(k) {
  const ticks = feed.step(k);
  const sel = selected.value;
  for (const t of ticks) {
    const q = quotes[t.index];
    q.price = t.price;
    q.high = t.high;
    q.low = t.low;
    q.volume = t.volume;
    q.move = t.move;
    q.ticks++;
    q.spark = [...q.spark.slice(1), t.price];
    if (t.symbol === sel) tape.value = [t.trade, ...tape.value.slice(0, TAPE - 1)];
  }
  return ticks;
}

export function select(symbol) {
  selected.value = symbol;
  tape.value = feed.trades(symbol);
}
