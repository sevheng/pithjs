<script setup>
defineProps({ error: { type: Object, required: true }, retry: { type: Function, required: true } });
</script>

<template>
  <div class="load-error" role="alert">
    <p>Couldn't load this. {{ error.message }}</p>
    <button class="btn" type="button" @click="retry">Try again</button>
  </div>
</template>
