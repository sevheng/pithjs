<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import SheetRow from './SheetRow.vue';
import SheetSummary from './SheetSummary.vue';
import { ROWS, COLS, cellId, colName } from '../../../shared/sheet/formula.js';
import { demoData, nextA1, randomEdits } from '../../../shared/sheet/demo-data.js';
import { ROW_H, COL_W, HEAD_W, OVERSCAN } from '../../../shared/sheet/display.js';
import { edit, clearing, rawOf, rawTracked } from './model.js';

// The Spreadsheet in Vue (spec/sheet.md). Each cell is a shallowRef and a computed (model.js); the grid draws
// the rows in view with v-for, one SheetRow component each.

// ---------- The window: which rows are in view ----------
const box = ref(null);
const top = ref(0);
const height = ref(600); // until it's measured
const rows = computed(() => {
  const first = Math.max(0, Math.floor(top.value / ROW_H) - OVERSCAN);
  const last = Math.min(ROWS - 1, Math.ceil((top.value + height.value) / ROW_H) + OVERSCAN);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
});
const onScroll = (e) => (top.value = e.currentTarget.scrollTop);
let resize;
onMounted(() => {
  resize = new ResizeObserver(() => ((height.value = box.value.clientHeight), (top.value = box.value.scrollTop)));
  resize.observe(box.value);
});
onBeforeUnmount(() => resize?.disconnect());
const scrollToRow = (r) => {
  box.value.scrollTop = r * ROW_H;
  top.value = box.value.scrollTop; // draw the rows now, not when the scroll event comes (a frame later)
};

// ---------- The selected cell and the formula bar ----------
const active = ref({ r: 0, c: 0 });
const activeId = computed(() => cellId(active.value.r, active.value.c));
/** What's typed in the formula bar, or null while it shows the cell's own text. */
const draft = ref(null);
const barValue = computed(() => draft.value ?? rawTracked(activeId.value, active.value.r));

function select(e) {
  const cell = e.target.closest('[data-c]');
  const row = cell?.closest('[data-r]');
  if (!cell || !row) return;
  active.value = { r: Number(row.dataset.r), c: Number(cell.dataset.c) };
  draft.value = null;
}
function submit() {
  const { r, c } = active.value;
  if (draft.value !== null) edit([[activeId.value, draft.value]]);
  draft.value = null;
  active.value = { r: Math.min(ROWS - 1, r + 1), c }; // Enter moves down, as in other spreadsheets
}

// ---------- The buttons ----------
const fill = () => edit([...new Map([...clearing(), ...demoData()])]); // what's there is cleared, unless the demo writes it
const editA1 = () => edit([['A1', nextA1(rawOf('A1'))]]);
const clear = () => edit(clearing());

const colIds = Array.from({ length: COLS }, (_, c) => c);

// For measure.js and the flows (spec/sheet.md).
let stopEdits = null;
window.bench = {
  set: (id, raw) => edit([[id, raw]]),
  fill,
  clear,
  scrollToRow,
  start(perSecond) {
    this.stop();
    stopEdits = randomEdits(perSecond, edit);
  },
  stop() {
    stopEdits?.();
    stopEdits = null;
  },
};
</script>

<template>
  <main class="page sheet-page">
    <header class="sheet-bar">
      <div>
        <p class="sheet-eyebrow">Spreadsheet</p>
        <h1>Budget</h1>
      </div>
      <div class="sheet-actions">
        <button id="fill" class="btn primary" type="button" @click="fill">Fill demo data</button>
        <button id="edit-a1" class="btn" type="button" @click="editA1">Edit A1</button>
        <button id="clear" class="btn ghost" type="button" @click="clear">Clear</button>
      </div>
    </header>
    <SheetSummary />
    <form class="sheet-formula card" @submit.prevent="submit">
      <output class="sheet-name" aria-label="Selected cell">{{ activeId }}</output>
      <span class="sheet-fx" aria-hidden="true">fx</span>
      <label class="sr-only" for="sheet-input">Cell contents</label>
      <input id="sheet-input" class="input" autocomplete="off" spellcheck="false" placeholder="Number, text or =SUM(A1:A3)"
        :value="barValue" @input="draft = $event.target.value">
    </form>
    <div class="sheet-frame card">
      <div ref="box" class="sheet-scroll" @scroll="onScroll">
        <div class="sheet-grid" role="grid" aria-label="Sheet" :aria-rowcount="ROWS + 1" :aria-colcount="COLS + 1"
          :style="`width: ${HEAD_W + COLS * COL_W}px`" @click="select">
          <div class="sheet-head" role="rowgroup">
            <div class="sheet-row" role="row" aria-rowindex="1">
              <div class="sheet-corner" role="columnheader"></div>
              <div v-for="c in colIds" :key="c" class="sheet-ch" role="columnheader">{{ colName(c) }}</div>
            </div>
          </div>
          <div class="sheet-body" role="rowgroup" :style="`height: ${ROWS * ROW_H}px`">
            <SheetRow v-for="r in rows" :key="r" :r="r" :on="r === active.r" />
            <div class="sheet-active" aria-hidden="true"
              :style="`top: ${active.r * ROW_H}px; left: ${HEAD_W + active.c * COL_W}px`"></div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
