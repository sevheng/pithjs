<script setup>
import { useRoute } from 'vue-router';
import { useFetch } from '../lib/api.js';
import Loading from '../components/Loading.vue';
import LoadError from '../components/LoadError.vue';
import CustomerForm from './CustomerForm.vue';

const route = useRoute();
const { data: customer, error, refetch } = useFetch(() => `/api/customers/${route.params.id}`);
</script>

<template>
  <section class="section narrow">
    <LoadError v-if="error" :error="error" :retry="refetch" />
    <Loading v-else-if="!customer" />
    <template v-else>
      <h1>Edit {{ customer.name }}</h1>
      <CustomerForm :key="customer.id" :customer="customer" />
    </template>
  </section>
</template>
