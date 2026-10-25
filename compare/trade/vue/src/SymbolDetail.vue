<script setup>
import { computed } from 'vue';
import { price, percent, count, way, changePct } from '../../../shared/trade/format.js';
import { current, tape } from './store.js';
import PriceChart from './PriceChart.vue';
import OrderBook from './OrderBook.vue';

const pct = computed(() => changePct(current.value.price, current.value.prevClose));
</script>

<template>
  <section class="panel quote" id="quote" aria-label="Quote">
    <h2 class="q-sym">{{ current.symbol }}</h2>
    <p class="q-name">{{ current.name }}</p>
    <span class="q-price">{{ price(current.price) }}</span>
    <span :class="`q-change ${way(pct)}`">{{ percent(pct) }}</span>
    <dl class="q-range">
      <div><dt>High</dt><dd class="q-high">{{ price(current.high) }}</dd></div>
      <div><dt>Low</dt><dd class="q-low">{{ price(current.low) }}</dd></div>
      <div><dt>Volume</dt><dd class="q-vol">{{ count(current.volume) }}</dd></div>
    </dl>
  </section>
  <PriceChart :symbol="current.symbol" :live="current.price" :prev-close="current.prevClose" />
  <div class="panels">
    <OrderBook :symbol="current.symbol" :live="current.price" />
    <section class="panel tape" id="tape" aria-labelledby="tape-title">
      <h2 id="tape-title">Trades</h2>
      <div class="tape-row book-head"><span>Time</span><span>Price</span><span>Size</span></div>
      <div class="tape-scroll">
        <ul class="tape-list">
          <li v-for="t in tape" :key="t.id" class="tape-row">
            <span class="tape-time">{{ t.time }}</span>
            <span :class="t.side === 'buy' ? 'tape-price up' : 'tape-price down'">{{ price(t.price) }}</span>
            <span class="tape-size">{{ count(t.size) }}</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
