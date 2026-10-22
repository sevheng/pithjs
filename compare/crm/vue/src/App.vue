<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router';
import Loading from './components/Loading.vue';

const LINKS = [
  ['/', 'Dashboard'],
  ['/customers', 'Customers'],
  ['/customers/new', 'New customer'],
];

// Which nav link is current for a path.
const section = (path) =>
  path === '/customers/new' ? '/customers/new' : path.startsWith('/customers') ? '/customers' : path === '/' ? '/' : null;

const route = useRoute();
</script>

<template>
  <header class="site-header">
    <RouterLink class="brand" to="/">CRM</RouterLink>
    <nav aria-label="Main">
      <ul class="nav-links">
        <li v-for="[href, label] in LINKS" :key="href">
          <RouterLink class="nav-link" :to="href" :aria-current="section(route.path) === href ? 'page' : undefined">
            {{ label }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </header>
  <main class="page">
    <RouterView v-slot="{ Component }">
      <component :is="Component" v-if="Component" />
      <Loading v-else />
    </RouterView>
  </main>
</template>
