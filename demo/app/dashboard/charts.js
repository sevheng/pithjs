import { html, signal, onCleanup } from 'pith';
import { money, compactMoney, count, day, weekday, niceTicks } from './format.js';

// Two small inline-SVG charts. Each is drawn at the pixel width of its box (measured with a ResizeObserver),
// so text stays the same size on a phone and a desktop instead of scaling with a viewBox.
// Pointer and keyboard (arrow keys, once the chart has focus) both pick a point and show its exact value
// (a tooltip on the line; on the bars, which are labelled already, the channel's share next to its name);
// a screen reader hears it through a live region, and "Show the numbers" opens every value as a table.
//
// SVG pieces built in their own html`` (a list of labels, the crosshair) are wrapped in a nested
// <svg overflow="visible">: a template is parsed as HTML, and only inside <svg> do <text> and <path> become SVG.

// Until the box has been measured (a frame later), charts draw at this width, scaled to fit the box.
const FALLBACK = 480;

/** A signal with the box's width in pixels, updated when it resizes. Use as ref=${measure}. */
function measured() {
  const width = signal(0);
  /** @type {ResizeObserver | undefined} */
  let observer;
  onCleanup(() => observer?.disconnect());
  /** @param {Element} el */
  const measure = (el) => {
    observer?.disconnect();
    observer = new ResizeObserver(([entry]) => (width.value = Math.floor(entry.contentRect.width)));
    observer.observe(el);
  };
  return { width, measure };
}

/** Arrow keys move through `n` items; returns the new index, or undefined for other keys. */
function step(/** @type {KeyboardEvent} */ e, /** @type {number | null} */ i, /** @type {number} */ n) {
  const at = i ?? n - 1;
  const next = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: n - 1 }[e.key];
  if (next === undefined) return undefined;
  e.preventDefault();
  return Math.max(0, Math.min(n - 1, next));
}

const H = 260; // the line chart's height (the loading skeleton reserves the same)
const PAD = { left: 52, right: 16, top: 14, bottom: 30 };

/**
 * Revenue per day as a line with a soft area, gridlines, round y ticks and a few date labels.
 * @param {{ date: string, value: number }[]} points
 * @param {string} period e.g. "the last 30 days"
 */
export function revenueChart(points, period) {
  const { width, measure } = measured();
  const active = signal(/** @type {number | null} */ (null));
  const n = points.length;
  const ticks = niceTicks(Math.max(...points.map((p) => p.value)));
  const top = ticks[ticks.length - 1];
  const total = points.reduce((s, p) => s + p.value, 0);
  const best = points.reduce((a, b) => (b.value > a.value ? b : a));
  const first = points[0];
  const last = points[n - 1];
  const summary = `Revenue per day over ${period}: ${money(total)} in total. ${day(first.date)}: ${money(first.value)}; `
    + `${day(last.date)}: ${money(last.value)}. Best day: ${day(best.date)}, ${money(best.value)}.`;

  /** @param {number} w */
  const scale = (w) => {
    const plotW = w - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    return {
      x: (/** @type {number} */ i) => PAD.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1)),
      y: (/** @type {number} */ v) => PAD.top + plotH * (1 - v / top),
      plotW,
    };
  };

  /** @param {PointerEvent} e */
  const pick = (e) => {
    const box = /** @type {HTMLElement} */ (e.currentTarget).getBoundingClientRect();
    const { plotW } = scale(width.peek());
    const i = Math.round(((e.clientX - box.left - PAD.left) / plotW) * (n - 1));
    active.value = Math.max(0, Math.min(n - 1, i));
  };

  /** @param {number} w @param {boolean} fit */
  const draw = (w, fit) => {
    const { x, y } = scale(w);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
    const area = `${line}L${x(n - 1).toFixed(1)} ${y(0)}L${x(0).toFixed(1)} ${y(0)}Z`;
    const grid = ticks.slice(1).map((t) => `M${PAD.left} ${y(t).toFixed(1)}H${w - PAD.right}`).join('');
    // About one date label per 70px, always the first and the last day.
    const labels = Math.max(2, Math.min(n, Math.floor((w - PAD.left - PAD.right) / 70)));
    const at = [...new Set(Array.from({ length: labels }, (_, k) => Math.round((k * (n - 1)) / (labels - 1))))];
    return html`
      <svg class="chart-svg" width=${fit ? '100%' : w} height=${fit ? '100%' : H} viewBox=${`0 0 ${w} ${H}`} role="img" aria-label=${summary}>
        <path class="chart-grid" d=${grid}/>
        <path class="chart-area" d=${area}/>
        <path class="chart-line" d=${line}/>
        <path class="chart-axis" d=${`M${PAD.left} ${y(0)}H${w - PAD.right}`}/>
        ${ticks.map((t) => html`<svg overflow="visible"><text class="chart-tick" x=${PAD.left - 10} y=${y(t)} text-anchor="end" dominant-baseline="middle">${compactMoney(t)}</text></svg>`)}
        ${at.map((i) => html`<svg overflow="visible"><text class="chart-tick" x=${x(i)} y=${H - 8}
          text-anchor=${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>${day(points[i].date)}</text></svg>`)}
        ${() => {
          const i = active.value;
          if (i === null) return null;
          return html`<svg overflow="visible">
            <path class="chart-cross" d=${`M${x(i).toFixed(1)} ${PAD.top}V${y(0)}`}/>
            <circle class="chart-dot" cx=${x(i)} cy=${y(points[i].value)} r="5"/></svg>`;
        }}
      </svg>
      ${() => {
        const i = active.value;
        if (i === null) return null;
        const left = Math.max(70, Math.min(w - 70, x(i)));
        return html`<div class="chart-tip" aria-hidden="true" style=${`left: ${left}px; top: ${y(points[i].value)}px`}>
          <strong>${money(points[i].value)}</strong><span>${weekday(points[i].date)}</span></div>`;
      }}`;
  };

  return html`
    <figure class="card chart-card chart-wide">
      <figcaption class="chart-head">
        <h2>Revenue</h2>
        <p class="muted note">Per day, ${period} · ${money(total)} in total</p>
      </figcaption>
      <div class="chart-box line-box" tabindex="0" role="group" aria-label="Revenue chart. Use the arrow keys to read each day."
           ref=${measure} @pointermove=${pick} @pointerleave=${() => (active.value = null)}
           @keydown=${(/** @type {KeyboardEvent} */ e) => { const i = step(e, active.value, n); if (i !== undefined) active.value = i; }}
           @focus=${() => (active.value ??= n - 1)} @blur=${() => (active.value = null)}>
        ${() => draw(width.value || FALLBACK, !width.value)}
      </div>
      <p class="sr-only" aria-live="polite">${() => (active.value === null ? '' : `${weekday(points[active.value].date)}: ${money(points[active.value].value)}`)}</p>
      <details class="chart-data">
        <summary>Show the numbers</summary>
        <div class="chart-table">
          <table>
            <thead><tr><th scope="col">Day</th><th scope="col" class="num">Revenue</th></tr></thead>
            <tbody>${points.map((p) => html`<tr><td>${weekday(p.date)}</td><td class="num">${money(p.value)}</td></tr>`)}</tbody>
          </table>
        </div>
      </details>
    </figure>`;
}

const ROW = 50; // one channel: its name above a bar
const BAR = 18; // bar thickness (under 24px, with air between rows)
const VALUE_ROOM = 56; // space right of the longest bar for its value

/** A bar whose far end is rounded (4px) and whose start, on the baseline, is square. */
const bar = (/** @type {number} */ y, /** @type {number} */ len) => {
  const r = Math.min(4, len / 2, BAR / 2);
  return `M0 ${y}H${len - r}A${r} ${r} 0 0 1 ${len} ${y + r}V${y + BAR - r}A${r} ${r} 0 0 1 ${len - r} ${y + BAR}H0Z`;
};

/**
 * Orders per sales channel as horizontal bars, biggest first, each labelled with its value.
 * @param {{ name: string, orders: number }[]} channels
 * @param {string} period
 */
export function channelChart(channels, period) {
  const { width, measure } = measured();
  const active = signal(/** @type {number | null} */ (null));
  const rows = channels.toSorted((a, b) => b.orders - a.orders);
  const n = rows.length;
  const total = rows.reduce((s, c) => s + c.orders, 0);
  const ticks = niceTicks(rows[0]?.orders ?? 0, 5);
  const top = ticks[ticks.length - 1];
  const height = n * ROW + 22;
  const share = (/** @type {number} */ v) => `${Math.round((v / total) * 100)}%`;
  const summary = `Orders by channel over ${period}: ${rows.map((c) => `${c.name} ${count(c.orders)}`).join(', ')}.`;

  /** @param {number} w @param {boolean} fit */
  const draw = (w, fit) => {
    const len = (/** @type {number} */ v) => (v / top) * (w - VALUE_ROOM);
    const grid = ticks.slice(1).map((t) => `M${len(t).toFixed(1)} 0V${n * ROW}`).join('');
    return html`
      <svg class="chart-svg" width=${fit ? '100%' : w} height=${fit ? '100%' : height} viewBox=${`0 0 ${w} ${height}`} role="img" aria-label=${summary}>
        <path class="chart-grid" d=${grid}/>
        ${rows.map((c, i) => html`<svg overflow="visible">
          <g class=${() => (active.value === null ? 'chart-bar' : active.value === i ? 'chart-bar on' : 'chart-bar off')}
             @pointerenter=${() => (active.value = i)}>
            <rect class="chart-hit" x="0" y=${i * ROW} width=${w} height=${ROW}/>
            <text class="chart-label" x="0" y=${i * ROW + 15}>${() => (active.value === i ? `${c.name} · ${share(c.orders)} of orders` : c.name)}</text>
            <path class="chart-fill" d=${bar(i * ROW + 25, Math.max(2, len(c.orders)))}/>
            <text class="chart-value" x=${Math.max(2, len(c.orders)) + 8} y=${i * ROW + 25 + BAR / 2} dominant-baseline="middle">${count(c.orders)}</text>
          </g></svg>`)}
        <path class="chart-axis" d=${`M0.5 0V${n * ROW}`}/>
        ${ticks.map((t, k) => html`<svg overflow="visible"><text class="chart-tick" x=${len(t)} y=${height - 4}
          text-anchor=${k === 0 ? 'start' : 'middle'}>${count(t)}</text></svg>`)}
      </svg>`;
  };

  return html`
    <figure class="card chart-card">
      <figcaption class="chart-head">
        <h2>Orders by channel</h2>
        <p class="muted note">Where ${count(total)} orders came from</p>
      </figcaption>
      <div class="chart-box bar-box" tabindex="0" role="group" aria-label="Orders by channel chart. Use the arrow keys to read each channel."
           style=${`height: ${height}px`} ref=${measure} @pointerleave=${() => (active.value = null)}
           @keydown=${(/** @type {KeyboardEvent} */ e) => { const i = step(e, active.value, n); if (i !== undefined) active.value = i; }}
           @focus=${() => (active.value ??= 0)} @blur=${() => (active.value = null)}>
        ${() => draw(width.value || FALLBACK, !width.value)}
      </div>
      <p class="sr-only" aria-live="polite">${() => (active.value === null ? '' : `${rows[active.value].name}: ${count(rows[active.value].orders)} orders, ${share(rows[active.value].orders)} of all`)}</p>
      <details class="chart-data">
        <summary>Show the numbers</summary>
        <div class="chart-table">
          <table>
            <thead><tr><th scope="col">Channel</th><th scope="col" class="num">Orders</th><th scope="col" class="num">Share</th></tr></thead>
            <tbody>${rows.map((c) => html`<tr><td>${c.name}</td><td class="num">${count(c.orders)}</td><td class="num">${share(c.orders)}</td></tr>`)}</tbody>
          </table>
        </div>
      </details>
    </figure>`;
}
