import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const naive = `
const selected = signal(null);

// ✗ every row reads selected, so every row re-runs on each click
repeat(rows, (r) => r.id, (r) => html\`
  <tr class=\${() => (selected.value === r.id ? 'selected' : '')}
      @click=\${() => (selected.value = r.id)}>…</tr>\`);`;

const usage = `
import { html, signal, selector, repeat } from 'pith';

const selected = signal(null);
const isSelected = selector(selected);

// ✓ a click re-runs 2 rows: the one that was selected and the one that is now
repeat(rows, (r) => r.id, (r) => html\`
  <tr class=\${() => (isSelected(r.id) ? 'selected' : '')}
      aria-selected=\${() => String(isSelected(r.id))}
      @click=\${() => (selected.value = r.id)}>…</tr>\`);`;

const tabs = `
const tab = computed(() => router.query.value.tab ?? 'overview');
const isTab = selector(tab);              // a computed works too, or a function: selector(() => tab.value)

html\`<div role="tablist">
  \${['overview', 'activity', 'settings'].map((t) => html\`
    <button role="tab" aria-selected=\${() => String(isTab(t))}
            @click=\${() => router.setQuery({ tab: t })}>\${t}</button>\`)}
</div>\`;`;

export default () => html`
  <p>A list often marks one item: the selected row, the active tab, the open message. The obvious way to
    write it makes every row check the selection, so every row re-runs on every click.
    ${c('selector()')} makes it two. In the grid above, tick "Compare in every row" and click a few cells
    to see the count change from 2 to 100.</p>

  <h2 id="why">Why comparing in each row is slow</h2>
  ${code(naive)}
  <p>Each row's ${c('class')} reads ${c('selected.value')}, so each row subscribes to ${c('selected')}.
    Change it and all of them run again, even though only two answers changed. With 10 rows nobody
    notices; with 1,000 it's 1,000 function calls and attribute checks per click.</p>

  <h2 id="usage">Using selector</h2>
  <p>${c('selector(source)')} takes the signal (or a computed, or a function) that holds the selected key and
    returns ${c('isSelected(key)')}. It's ${c('true')} when the source's value is that key. Each row
    subscribes only to its own key, so when the source changes, only the old and the new key re-run.</p>
  ${code(usage)}
  <p>It works for anything "one of many": tabs, a highlighted menu item, the current step.</p>
  ${code(tabs)}
  ${note(html`Call ${c('isSelected(r.id)')} inside a function hole (${c('${() => …}')}). Called directly,
    while the row is built, it's a snapshot like ${c('${selected.value}')} and never updates.`, 'warn')}

  <h2 id="numbers">How much it saves</h2>
  <p>In a 1,000-row list, picking another row re-runs 2 rows' effects instead of 1,000. That's how the
    <a href="/docs/trading">Trading</a> example marks the symbol on screen in its watchlist. For a handful of rows,
    comparing in each row is fine; reach for ${c('selector')} when the list is long or the selection changes often
    (arrow keys).</p>

  <h2 id="api">API</h2>
  ${api([
    ['selector(source)', html`${c('source')}: a signal, computed or function holding the selected key. Returns ${c('isSelected')}.`],
    ['isSelected(key)', html`${c('true')} when the source's value ${c('===')} key. In a hole, re-runs only when that answer changes.`],
  ])}
`;
