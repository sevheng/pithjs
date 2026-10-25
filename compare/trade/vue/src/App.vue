<script setup>
import { count } from '../../../shared/trade/format.js';
import { quotes, selected, select } from './store.js';
import WatchRow from './WatchRow.vue';
import EquityValue from './EquityValue.vue';
import SymbolDetail from './SymbolDetail.vue';
import PositionsTable from './PositionsTable.vue';
</script>

<template>
  <main class="trade">
    <header class="trade-top">
      <h1>Trading</h1>
      <dl class="equity"><dt>Equity</dt><EquityValue /></dl>
    </header>
    <section class="panel watch" aria-labelledby="wl-title">
      <h2 id="wl-title">Watchlist · {{ count(quotes.length) }} symbols</h2>
      <div class="wl-scroll">
        <ul class="wl-list" id="watchlist">
          <WatchRow v-for="q in quotes" :key="q.symbol" :q="q" :selected="q.symbol === selected" @select="select" />
        </ul>
      </div>
    </section>
    <div class="detail">
      <SymbolDetail />
      <PositionsTable />
    </div>
  </main>
</template>
