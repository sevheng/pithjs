import { computed } from 'vue';
import { feed, quotes } from './store.js';

// The positions' live P&L and the equity: computed from the quotes they hold, so they follow every tick.
export const positions = feed.positions.map((p) => ({ ...p, q: quotes[p.index] }));
export const totalPnl = computed(() => positions.reduce((sum, p) => sum + p.qty * (p.q.price - p.avg), 0));
export const equity = computed(() => positions.reduce((sum, p) => sum + p.qty * p.q.price, feed.cash));
