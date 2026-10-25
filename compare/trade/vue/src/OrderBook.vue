<script setup>
import { computed } from 'vue';
import { price, count } from '../../../shared/trade/format.js';
import { feed } from './store.js';

const props = defineProps({ symbol: { type: String, required: true }, live: { type: Number, required: true } });
const book = computed(() => feed.book(props.symbol, props.live));
const depth = (l) => ({ '--depth': `${(l.depth * 100).toFixed(1)}%` });
</script>

<template>
  <section class="panel book" id="book" aria-labelledby="book-title">
    <h2 id="book-title">Order book</h2>
    <div class="book-row book-head"><span>Price</span><span>Size</span><span>Total</span></div>
    <ul class="book-list">
      <li v-for="(l, i) in book.asks" :key="`a${i}`" class="book-row ask" :style="depth(l)">
        <span class="book-price">{{ price(l.price) }}</span><span class="book-size">{{ count(l.size) }}</span><span class="book-total">{{ count(l.total) }}</span>
      </li>
      <li v-for="(l, i) in book.bids" :key="`b${i}`" :class="i === 0 ? 'book-row bid best' : 'book-row bid'" :style="depth(l)">
        <span class="book-price">{{ price(l.price) }}</span><span class="book-size">{{ count(l.size) }}</span><span class="book-total">{{ count(l.total) }}</span>
      </li>
    </ul>
  </section>
</template>
