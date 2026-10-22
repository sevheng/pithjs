<script setup>
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { fetchJSON, useFetch } from '../lib/api.js';
import { money, STATUS_LABELS } from '../lib/format.js';
import Loading from '../components/Loading.vue';
import LoadError from '../components/LoadError.vue';

const route = useRoute();
const router = useRouter();
const { data: customer, error, refetch } = useFetch(() => `/api/customers/${route.params.id}`);
const confirming = ref(false);

const details = computed(() => {
  const c = customer.value;
  return c && [
    ['Email', c.email],
    ['Company', c.company],
    ['Phone', c.phone],
    ['Status', STATUS_LABELS[c.status]],
    ['Revenue', money(c.revenue)],
    ['Notes', c.notes],
  ];
});

async function remove() {
  if (!confirming.value) {
    confirming.value = true;
    return;
  }
  await fetchJSON(`/api/customers/${route.params.id}`, { method: 'DELETE' });
  router.push('/customers');
}
</script>

<template>
  <section class="section narrow">
    <template v-if="error?.status === 404">
      <h1>Customer not found</h1>
      <RouterLink to="/customers">Back to customers</RouterLink>
    </template>
    <LoadError v-else-if="error" :error="error" :retry="refetch" />
    <Loading v-else-if="!customer" />
    <template v-else>
      <h1>{{ customer.name }}</h1>
      <dl class="card details">
        <template v-for="[label, value] in details" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value || '—' }}</dd>
        </template>
      </dl>
      <div class="row">
        <RouterLink class="btn" :to="`/customers/${customer.id}/edit`">Edit</RouterLink>
        <button class="btn danger" type="button" @click="remove">{{ confirming ? 'Confirm delete' : 'Delete' }}</button>
        <button v-if="confirming" class="btn ghost" type="button" @click="confirming = false">Cancel</button>
      </div>
    </template>
  </section>
</template>
