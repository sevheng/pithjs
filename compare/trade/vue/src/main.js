import { createApp } from 'vue';
import App from './App.vue';
import { feed, step, select } from './store.js';
import { timer } from '../../../shared/trade/feed.js';

createApp(App).mount('#app');

const clock = timer(step);
/** The measure script's handle (compare/trade/measure.js): the same in every implementation. */
window.bench = { step, select, start: clock.start, stop: clock.stop, feed };
