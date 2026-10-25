<script setup>
import { computed } from 'vue';
import { price, percent, way, changePct, flashClass, arrow, sparkPoints, SPARK_W, SPARK_H } from '../../../shared/trade/format.js';

const props = defineProps({ q: { type: Object, required: true }, selected: Boolean });
const emit = defineEmits(['select']);
const change = computed(() => changePct(props.q.price, props.q.prevClose));
const points = computed(() => sparkPoints(props.q.spark));
</script>

<template>
  <li :class="selected ? 'wl-row selected' : 'wl-row'" :data-symbol="q.symbol">
    <button type="button" class="wl-btn" :aria-pressed="String(selected)" @click="emit('select', q.symbol)">
      <span class="wl-id"><span class="wl-sym">{{ q.symbol }}</span><span class="wl-name">{{ q.name }}</span></span>
      <svg :class="`wl-spark ${way(change)}`" :width="SPARK_W" :height="SPARK_H" :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`" aria-hidden="true">
        <polyline :points="points" />
      </svg>
      <span class="wl-nums">
        <span class="wl-quote"><span class="wl-arrow" aria-hidden="true">{{ arrow(q.move) }}</span><span :class="flashClass(q.move, q.ticks)">{{ price(q.price) }}</span></span>
        <span :class="`wl-change ${way(change)}`">{{ percent(change) }}</span>
      </span>
    </button>
  </li>
</template>
