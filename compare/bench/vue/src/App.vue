<script setup>
import { ref } from 'vue';
import { buildData } from './data.js';

const rows = ref([]);
const selected = ref(0);

function run() {
  rows.value = buildData(1000);
  selected.value = 0;
}
function runLots() {
  rows.value = buildData(10000);
  selected.value = 0;
}
const add = () => rows.value.push(...buildData(1000));
function update() {
  for (let i = 0; i < rows.value.length; i += 10) rows.value[i].label += ' !!!';
}
function clear() {
  rows.value = [];
  selected.value = 0;
}
function swapRows() {
  const d = rows.value;
  if (d.length <= 998) return;
  const tmp = d[1];
  d[1] = d[998];
  d[998] = tmp;
}
function remove(id) {
  rows.value.splice(rows.value.findIndex((r) => r.id === id), 1);
}
</script>

<template>
  <main class="page">
    <section class="section">
      <h1>Benchmark</h1>
      <div class="bench-buttons">
        <button id="run" class="btn" type="button" @click="run">Create 1,000 rows</button>
        <button id="runlots" class="btn" type="button" @click="runLots">Create 10,000 rows</button>
        <button id="add" class="btn" type="button" @click="add">Append 1,000 rows</button>
        <button id="update" class="btn" type="button" @click="update">Update every 10th row</button>
        <button id="clear" class="btn" type="button" @click="clear">Clear</button>
        <button id="swaprows" class="btn" type="button" @click="swapRows">Swap rows</button>
      </div>
      <table class="bench-table">
        <tbody>
          <tr v-for="r in rows" :key="r.id" :class="selected === r.id ? 'selected' : ''">
            <td class="col-id">{{ r.id }}</td>
            <td class="col-label"><a class="lbl" @click="selected = r.id">{{ r.label }}</a></td>
            <td><a class="remove" aria-label="Remove" @click="remove(r.id)">×</a></td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>
