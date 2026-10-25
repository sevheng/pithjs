<script setup>
import { computed } from 'vue';
import { COLS, cellId } from '../../../shared/sheet/formula.js';
import { look, ROW_H } from '../../../shared/sheet/display.js';
import { valueOf } from './model.js';

// One row of the grid. It reads the computed of each of its cells, so Vue re-renders this row (and no other)
// when one of them changes.
const props = defineProps({ r: { type: Number, required: true }, on: Boolean });
const ids = Array.from({ length: COLS }, (_, c) => cellId(props.r, c)); // a row keeps its r (keyed by it)
const cells = computed(() => ids.map((id) => look(valueOf(id, props.r))));
</script>

<template>
  <div class="sheet-row" role="row" :aria-rowindex="r + 2" :data-r="r" :style="`top: ${r * ROW_H}px`">
    <div :class="on ? 'sheet-rh on' : 'sheet-rh'" role="rowheader">{{ r + 1 }}</div>
    <div v-for="(cell, c) in cells" :key="c" :class="`sheet-cell ${cell.kind}`" role="gridcell" :id="`cell-${ids[c]}`" :data-c="c">{{ cell.text }}</div>
  </div>
</template>
