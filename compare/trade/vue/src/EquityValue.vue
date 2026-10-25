<script setup>
import { money } from '../../../shared/trade/format.js';
import { equity } from './positions.js';
</script>

<template>
  <dd id="equity">{{ money(equity) }}</dd>
</template>
