<script setup>
import { parseId } from '../../../shared/sheet/formula.js';
import { summaryText, SUMMARY } from '../../../shared/sheet/display.js';
import { valueOf } from './model.js';

// The summary line: four of the budget's cells. A component of its own, so only it re-renders when they change.
const summary = SUMMARY.map(([id, label]) => ({ id, label, r: parseId(id)[0] }));
</script>

<template>
  <dl class="sheet-summary">
    <div v-for="s in summary" :key="s.id" class="card">
      <dt>{{ s.label }}</dt>
      <dd :id="`sum-${s.id}`">{{ summaryText(valueOf(s.id, s.r)) }}</dd>
    </div>
  </dl>
</template>
