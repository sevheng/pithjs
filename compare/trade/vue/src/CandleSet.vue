<script setup>
import { computed } from 'vue';
import { scale, candleShape } from '../../../shared/trade/chart.js';

// The 119 candles that don't move: a component of their own, so they render again only when the y range changes.
const props = defineProps({ candles: { type: Array, required: true }, range: { type: String, required: true } });
const shapes = computed(() => {
  const s = scale(props.range, props.candles.length);
  return props.candles.slice(0, -1).map((c, i) => candleShape(c, i, s));
});
</script>

<template>
  <g v-for="(k, i) in shapes" :key="i" :class="k.cls">
    <path class="cdl-wick" :d="k.wick" />
    <rect class="cdl-body" :x="k.x" :y="k.y" :width="k.w" :height="k.h" />
  </g>
</template>
