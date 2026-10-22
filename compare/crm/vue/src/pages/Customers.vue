<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useFetch } from '../lib/api.js';
import { money, STATUS_LABELS } from '../lib/format.js';
import Loading from '../components/Loading.vue';
import LoadError from '../components/LoadError.vue';

const STATUS_OPTIONS = [['all', 'All statuses'], ['active', 'Active'], ['lead', 'Lead'], ['churned', 'Churned']];

const q = ref('');
const status = ref('all');
const { data: rows, error, refetch } = useFetch(() => `/api/customers?${new URLSearchParams({ q: q.value, status: status.value })}`);
</script>

<template>
  <section class="section">
    <h1>Customers</h1>
    <div class="toolbar">
      <label class="sr-only" for="search">Search customers</label>
      <input id="search" v-model="q" class="input" type="search" placeholder="Search by name, email or company">
      <label class="sr-only" for="status">Status</label>
      <select id="status" v-model="status" class="input">
        <option v-for="[value, label] in STATUS_OPTIONS" :key="value" :value="value">{{ label }}</option>
      </select>
      <RouterLink class="btn primary" to="/customers/new">New customer</RouterLink>
    </div>

    <LoadError v-if="error" :error="error" :retry="refetch" />
    <Loading v-else-if="!rows" />
    <p v-else-if="rows.length === 0" class="empty">No customers match.</p>
    <template v-else>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Name</th><th>Company</th><th>Status</th><th>Revenue</th></tr></thead>
          <tbody>
            <tr v-for="c in rows" :key="c.id">
              <td><RouterLink :to="`/customers/${c.id}`">{{ c.name }}</RouterLink></td>
              <td>{{ c.company }}</td>
              <td><span :class="`badge badge-${c.status}`">{{ STATUS_LABELS[c.status] }}</span></td>
              <td>{{ money(c.revenue) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted">{{ rows.length }} customer{{ rows.length === 1 ? '' : 's' }}</p>
    </template>
  </section>
</template>
