import { html, svg, computed, effect, resource, fetchJSON, repeat, selector, untrack, onCleanup } from 'pith';
import { router } from '../router.js';
import { icon } from '../icons.js';
import { createFeed, SPEEDS } from '../trade/feed.js';
import { market, account, watch, DEFAULT_SYMBOL, candles, TIMEFRAMES } from '../trade/state.js';
import { price, percent, signedMoney, cents, count, way, clock } from '../trade/format.js';

/** @typedef {import('../trade/feed.js').Quote} Quote */

// The frame for /trade/:symbol: the account and feed bar on top, the watchlist beside the symbol page. As a
// layout it stays mounted while you switch symbols, so the feed keeps running, the prices stay live, and the
// watchlist keeps its search and scroll. The feed and the account live here and are shared with the page
// through app/trade/state.js.
export default function TradeLayout(page) {
  const feed = createFeed();
  market.value = feed;
  const instruments = resource(({ signal }) => fetchJSON('/api/trade?view=instruments', { signal }));
  const acct = resource(({ signal }) => fetchJSON('/api/trade?view=account', { signal }));
  account.current = acct;
  onCleanup(() => {
    market.value = null;
    account.current = null;
  });
  effect(() => {
    const data = instruments.data.value;
    if (data) untrack(() => feed.load(data.instruments));
  });
  // ?feed=down: the demo of a lost connection. Retry reconnects and takes it out of the URL.
  effect(() => {
    if (router.query.value.feed === 'down') untrack(() => feed.drop());
  });
  const retry = () => {
    router.setQuery({ feed: null });
    feed.retry();
  };
  // When the feed went quiet, for the "prices from 14:05:09" line.
  let lastSeen = Date.now();
  effect(() => {
    if (feed.status.value === 'live') lastSeen = Date.now();
  });

  // ---------- The account bar: live, from the positions and the prices ----------
  const live = (/** @type {string} */ symbol) => feed.get(symbol)?.price.value;
  const holdings = computed(() => {
    const a = acct.data.value;
    if (!a || !feed.quotes.value.length) return null;
    let value = 0;
    let day = 0;
    for (const p of a.positions) {
      const q = feed.get(p.symbol);
      const now = live(p.symbol) ?? p.avg;
      value += p.qty * now;
      day += p.qty * (now - (q?.prevClose ?? now));
    }
    return { equity: a.cash + value, day, cash: a.cash, power: a.buyingPower };
  });

  const kpi = (/** @type {string} */ label, /** @type {() => unknown} */ show, cls = '') => html`
    <div class=${`trade-kpi ${cls}`}><dt>${label}</dt><dd>${() => (holdings.value ? show() : html`<span class="trade-skel"></span>`)}</dd></div>`;

  // ---------- The feed controls ----------
  const state = computed(() => (feed.status.value !== 'live' ? feed.status.value : feed.running.value ? 'live' : 'paused'));
  const down = computed(() => feed.status.value !== 'live');
  const STATE_TEXT = { live: 'Live', paused: 'Paused', down: 'Disconnected', connecting: 'Connecting…' };
  const ms = (/** @type {number} */ n) => (n < 0.1 ? '<0.1' : n.toFixed(1));
  const readout = () => {
    const s = state.value;
    if (s === 'paused') return 'Prices are paused';
    if (s !== 'live') return '';
    const st = feed.stats.value;
    return st ? `${count(st.perSec)} updates/s · ${ms(st.avg)} ms a frame (worst ${ms(st.worst)})` : 'Measuring…';
  };

  // ---------- The watchlist ----------
  const current = computed(() => router.path.value.split('/')[2] ?? DEFAULT_SYMBOL);
  const isSelected = selector(current);
  // Stars change rarely (a click), so every row reading the list is fine here.
  const starred = (/** @type {string} */ s) => watch.stars.value.includes(s);
  const q = computed(() => router.query.value.q ?? '');
  const needle = computed(() => q.value.trim().toLowerCase());
  const visible = computed(() => {
    const n = needle.value;
    const stars = watch.stars.value;
    const list = feed.quotes.value.filter((x) => !n || x.symbol.toLowerCase().includes(n) || x.name.toLowerCase().includes(n));
    return [...list.filter((x) => stars.includes(x.symbol)), ...list.filter((x) => !stars.includes(x.symbol))];
  });
  const toggleStar = (/** @type {string} */ s) => {
    const stars = watch.stars.value;
    watch.stars.value = stars.includes(s) ? stars.filter((x) => x !== s) : [...stars, s];
  };
  // Pointing at or focusing a symbol starts loading its chart, so it's usually there by the click.
  const prefetch = (/** @type {string} */ s) => {
    const tf = router.query.value.tf;
    candles(s, TIMEFRAMES.includes(tf) ? tf : '1D').catch(() => {}); // the page shows the error if it's still failing
  };
  // Links keep the chart's timeframe.
  const hrefFor = (/** @type {string} */ s) => {
    const tf = router.query.value.tf;
    return `/trade/${s}${tf ? `?tf=${encodeURIComponent(tf)}` : ''}`;
  };

  /** The day so far as a tiny line, its last point the live price. @param {Quote} x */
  const spark = (x) => {
    const W = 56;
    const H = 22;
    const d = () => {
      const pts = [...x.spark, x.price.value];
      const lo = Math.min(...pts, x.prevClose);
      const hi = Math.max(...pts, x.prevClose);
      const y = (/** @type {number} */ v) => (H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4)).toFixed(1);
      return pts.map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * W).toFixed(1)} ${y(v)}`).join('');
    };
    return html`<svg class=${() => `wl-spark ${way(x.price.value - x.prevClose)}`} width=${W} height=${H} viewBox=${`0 0 ${W} ${H}`} aria-hidden="true">
      ${svg`<path d=${d}/>`}</svg>`;
  };

  /** A flash class that alternates on each tick, so the animation starts again. @param {Quote} x */
  const flash = (x) => {
    const n = x.ticks.value;
    if (!n) return 'wl-price';
    return `wl-price flash-${x.move.value > 0 ? 'up' : 'down'}-${n % 2}`;
  };

  /** One row, built once per symbol. Only the price, change, flash and sparkline update on a tick. @param {Quote} x */
  const row = (x) => {
    const change = () => ((x.price.value - x.prevClose) / x.prevClose) * 100;
    return html`
      <li class=${() => (isSelected(x.symbol) ? 'wl-row selected' : 'wl-row')}>
        <a class="wl-link" href=${() => hrefFor(x.symbol)} @pointerenter=${() => prefetch(x.symbol)} @focus=${() => prefetch(x.symbol)} aria-current=${() => (isSelected(x.symbol) ? 'page' : null)}>
          <span class="wl-id"><span class="wl-sym">${x.symbol}</span> <span class="wl-name">${x.name}</span></span>
          ${spark(x)}
          <span class="wl-nums">
            <span class=${() => flash(x)}><span class="wl-glyph" aria-hidden="true">${() => (x.move.value > 0 ? '▲' : x.move.value < 0 ? '▼' : '')}</span>${() => price(x.price.value)}</span>
            <span class=${() => `wl-change ${way(change())}`}>${() => percent(change())}</span>
          </span>
        </a>
        <button type="button" class=${() => (starred(x.symbol) ? 'icon-btn wl-star on' : 'icon-btn wl-star')}
          aria-pressed=${() => String(starred(x.symbol))} aria-label=${`Star ${x.symbol}`} @click=${() => toggleStar(x.symbol)}>${icon('star')}</button>
      </li>`;
  };

  const shows = computed(() => (visible.value.length ? 'list' : needle.value ? 'none' : 'list'));
  const listView = () => html`${() => (shows.value === 'none'
    ? untrack(() => html`<div class="wl-empty"><span class="icon-tile">${icon('search')}</span>
        <p><strong>No symbols match “${q.value.trim()}”</strong></p>
        <p class="muted note">Search by symbol (NWX) or company name.</p>
        <button class="btn" type="button" @click=${() => router.setQuery({ q: null })}>Clear search</button></div>`)
    : untrack(() => html`<ul class="wl-list" aria-label="Symbols">${repeat(visible, (x) => x.symbol, row)}</ul>`))}`;

  const watchlist = instruments.live({
    loading: () => html`<div class="wl-skeleton" aria-busy="true">
      ${Array.from({ length: 10 }, () => html`<div class="wl-skel-row"><span class="trade-skel"></span><span class="trade-skel short"></span></div>`)}
      <p class="sr-only" role="status">Loading the watchlist…</p></div>`,
    error: (err, retryLoad) => html`<div class="load-error" role="alert"><p>Couldn't load the symbols. ${err?.message ?? ''}</p>
      <button class="btn" type="button" @click=${retryLoad}>${icon('refresh')} Try again</button></div>`,
    ready: listView,
  });

  return html`
    <div class="trade" data-feed=${state}>
      <div class="trade-top">
      <header class="trade-bar card">
        <div class="trade-brand">
          <p class="eyebrow">Northwind Markets</p>
          <p class=${() => `feed-state ${state.value}`}><span class="feed-dot" aria-hidden="true"></span>${() => STATE_TEXT[state.value]}</p>
        </div>
        <dl class="trade-kpis">
          ${kpi('Equity', () => cents(holdings.value.equity), 'main')}
          ${kpi('Today', () => html`<span class=${`pnl ${way(holdings.value.day)}`}>${signedMoney(holdings.value.day)}</span>`)}
          ${kpi('Cash', () => cents(holdings.value.cash))}
          ${kpi('Buying power', () => cents(holdings.value.power))}
        </dl>
        <div class="feed-tools">
          <button class="btn" type="button" ?disabled=${() => feed.status.value !== 'live'} @click=${() => (feed.running.value = !feed.running.value)}>
            ${() => (feed.running.value ? html`<span class="pause-icon" aria-hidden="true"></span>Pause` : html`<span class="play-icon" aria-hidden="true"></span>Resume`)}</button>
          <div class="segmented" role="group" aria-label="Feed speed">
            ${Object.entries(SPEEDS).map(([k, s]) => html`<button type="button" aria-pressed=${() => String(feed.speed.value === k)}
              @click=${() => (feed.speed.value = /** @type {keyof typeof SPEEDS} */ (k))}>${s.label}</button>`)}
          </div>
          <p class="muted note feed-readout">${readout}</p>
        </div>
      </header>
      ${() => (!down.value ? null : untrack(() => html`
        <div class="feed-alert" role="alert">
          <span class="icon-tile">${icon('refresh')}</span>
          <p><strong>Disconnected from the price feed.</strong>
            <span class="muted">${() => `Prices are from ${clock(lastSeen)}. ${feed.status.value === 'connecting' ? 'Reconnecting…' : `Reconnecting in ${feed.retryIn.value} s.`}`}</span></p>
          <button class="btn" type="button" ?disabled=${() => feed.status.value === 'connecting'} @click=${retry}>Retry now</button>
        </div>`))}
      </div>
      ${page}
      <aside class="watchlist card" id="watchlist" aria-labelledby="wl-title">
        <div class="wl-head">
          <h2 id="wl-title">Watchlist</h2>
          <span class="muted note">${() => (feed.quotes.value.length ? `${feed.quotes.value.length} symbols` : '')}</span>
        </div>
        <div class="search-field wl-search">
          ${icon('search')}
          <label class="sr-only" for="wl-search">Search symbols</label>
          <input id="wl-search" class="input" type="search" placeholder="Symbol or company" autocomplete="off"
                 .value=${q} @input=${(/** @type {Event} */ e) => router.setQuery({ q: /** @type {HTMLInputElement} */ (e.target).value || null })}>
        </div>
        <div class="wl-scroll scroll-quiet">${watchlist}</div>
      </aside>
    </div>
  `;
}
