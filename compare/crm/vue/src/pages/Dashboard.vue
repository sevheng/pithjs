<script setup>
import { computed } from 'vue';
import { useFetch } from '../lib/api.js';
import { money } from '../lib/format.js';
import Loading from '../components/Loading.vue';
import LoadError from '../components/LoadError.vue';

const { data: stats, error, refetch } = useFetch('/api/stats');
const cards = computed(() => stats.value && [
  ['Customers', stats.value.total],
  ['Active', stats.value.active],
  ['Leads', stats.value.leads],
  ['Revenue', money(stats.value.revenue)],
]);
</script>

<template>
  <section class="section">
    <h1>Dashboard</h1>
    <LoadError v-if="error" :error="error" :retry="refetch" />
    <Loading v-else-if="!stats" />
    <div v-else class="grid stats">
      <div v-for="[label, value] in cards" :key="label" class="card stat">
        <span class="stat-value">{{ value }}</span>
        <span class="stat-label">{{ label }}</span>
      </div>
    </div>
  </section>
</template>
