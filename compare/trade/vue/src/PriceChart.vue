<script setup>
import { computed } from 'vue';
import { price, way } from '../../../shared/trade/format.js';
import { W, H, RIGHT, extent, lastCandle, rangeKey, scale, candleShape, priceLine } from '../../../shared/trade/chart.js';
import { feed } from './store.js';
import CandleSet from './CandleSet.vue';

const props = defineProps({ symbol: { type: String, required: true }, live: { type: Number, required: true }, prevClose: { type: Number, required: true } });
const candles = computed(() => feed.candles(props.symbol));
const fixed = computed(() => extent(candles.value));
// A string: it changes (and the fixed candles are drawn again) only when the price leaves the y range.
const range = computed(() => rangeKey(fixed.value, props.live));
const s = computed(() => scale(range.value, candles.value.length));
const last = computed(() => candleShape(lastCandle(candles.value[candles.value.length - 1], props.live), candles.value.length - 1, s.value));
const line = computed(() => priceLine(props.live, s.value));
</script>

<template>
  <section class="panel chart" id="chart" aria-label="Chart">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`${symbol}, ${candles.length} one-minute candles`">
      <g v-for="g in s.grid" :key="g.value">
        <path class="chart-grid" :d="`M4 ${g.y}H${W - RIGHT}`" />
        <text class="chart-tick" :x="W - RIGHT + 8" :y="g.y" dominant-baseline="middle">{{ price(g.value) }}</text>
      </g>
      <CandleSet :candles="candles" :range="range" />
      <g :class="`${last.cls} last`">
        <path class="cdl-wick" :d="last.wick" />
        <rect class="cdl-body" :x="last.x" :y="last.y" :width="last.w" :height="last.h" />
      </g>
      <g :class="`last-price ${way(live - prevClose)}`">
        <path class="last-line" :d="line.d" />
        <rect class="last-tag" :x="line.tagX" :y="line.tagY" :width="RIGHT - 4" height="20" rx="4" />
        <text class="last-text" :x="line.textX" :y="line.y" dominant-baseline="middle">{{ price(live) }}</text>
      </g>
    </svg>
  </section>
</template>
