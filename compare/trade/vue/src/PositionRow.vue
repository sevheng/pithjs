<script setup>
import { computed } from 'vue';
import { price, signedMoney, count, way } from '../../../shared/trade/format.js';

const props = defineProps({ p: { type: Object, required: true } });
const pnl = computed(() => props.p.qty * (props.p.q.price - props.p.avg));
</script>

<template>
  <tr class="pos-row" :data-symbol="p.symbol">
    <td>{{ p.symbol }}</td><td>{{ count(p.qty) }}</td><td>{{ price(p.avg) }}</td>
    <td class="pos-last">{{ price(p.q.price) }}</td>
    <td :class="`pos-pnl ${way(pnl)}`">{{ signedMoney(pnl) }}</td>
  </tr>
</template>
