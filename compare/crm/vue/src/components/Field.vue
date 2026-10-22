<script setup>
defineProps({ id: { type: String, required: true }, label: { type: String, required: true }, error: { type: String, default: null } });
</script>

<template>
  <div class="field">
    <label class="field-label" :for="id">{{ label }}</label>
    <slot />
    <p :id="`${id}-error`" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>
