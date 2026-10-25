<script setup>
import { signedMoney, way } from '../../../shared/trade/format.js';
import { positions, totalPnl } from './positions.js';
import PositionRow from './PositionRow.vue';
</script>

<template>
  <section class="panel positions" id="positions" aria-labelledby="pos-title">
    <h2 id="pos-title">Positions</h2>
    <table>
      <thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>P&amp;L</th></tr></thead>
      <tbody><PositionRow v-for="p in positions" :key="p.symbol" :p="p" /></tbody>
      <tfoot><tr><td colspan="4">Total P&amp;L</td><td id="pnl-total" :class="way(totalPnl)">{{ signedMoney(totalPnl) }}</td></tr></tfoot>
    </table>
  </section>
</template>
