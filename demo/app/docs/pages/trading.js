import { html } from 'pith';
import { code, note, c } from '../ui.js';

export default () => html`
  <p>A trading screen for Northwind Markets, a made-up exchange with 40 made-up companies. Prices tick several
    times a second: a watchlist with sparklines, a candlestick chart whose last candle grows live, an order book and
    a tape of trades, and an order ticket whose cost follows the price. Your positions, P&amp;L and equity move with it.
    This is the case Pith's fine-grained updates are for: many small values changing all the time.</p>

  <h2 id="try">What to try</h2>
  <ul>
    <li>Watch the watchlist: each price that ticks flashes green or red for a moment, with a ▲ or ▼ (the arrow stays
      with reduced motion, the flash doesn't). Pick another symbol: the URL, the chart, the book and the ticket follow in
      place, and the watchlist keeps its place. The chart starts loading when you point at a symbol, so it's usually ready
      by the click; if not, the last chart stays, dimmed, until it is.</li>
    <li>Switch the chart to 1W, 1M or 1Y. The timeframe goes into ${c('?tf=')}, and stays when you pick another symbol.
      Point at the chart, or Tab to it and use the arrow keys, to read each candle. "Show the numbers" lists them all.</li>
    <li>Pause the feed, then Resume. Try 10× and Stress: every symbol ticks 60 times a second, and the bar shows how many
      updates a second that is, and how long each one took to put on screen.</li>
    <li>Buy at market, or set a Limit: the estimated cost follows the live price. The order shows as Pending at once and
      becomes Filled; the position appears under Your account, with its P&amp;L moving.</li>
    <li>Buy 100,000 shares. The ticket warns that it's more than your buying power, and the server answers 422: its message
      shows in the form, and what you typed stays.</li>
    <li>Place a limit buy far below the price (a limit of 1): it waits under Orders. Cancel it there (it asks first).</li>
    <li>Open <a href="/trade/NWX?feed=down">${c('/trade/NWX?feed=down')}</a>: the feed is lost, the prices dim, and it counts
      down to reconnecting. Retry now brings it back. And <a href="/trade/NWX?order=fail">${c('?order=fail')}</a> makes
      placing an order fail with a 500: it comes back under Orders with Retry.</li>
    <li>Hide the tab for a while: the feed stops while nobody can see it, and goes on when you come back.</li>
  </ul>

  <h2 id="built">How it's built</h2>
  <ul>
    <li>${c('app/layouts/trade.js')}: the frame for ${c('/trade/:symbol')}. It makes the feed and loads the symbols and the
      account, draws the bar on top (feed state, equity, cash, the feed controls) and the watchlist. As a layout it stays
      mounted while you switch symbols, so the prices stay live and nothing loads again.</li>
    <li>${c('app/pages/trade.js')}: one symbol. The quote, the chart, the order book, the trades, the order ticket, and your
      positions and orders.</li>
    <li>${c('app/trade/feed.js')}: the market feed, simulated in the browser (the dev server only answers JSON, it can't
      stream). A seeded random walk from the API's last prices; pause, speed, a lost connection, and stopping while the tab
      is hidden.</li>
    <li>${c('app/trade/chart.js')}: the candlestick and volume chart, drawn as SVG at the measured width of its box, with the
      dashboard's ${c('measured()')} and keyboard ${c('step()')}.</li>
    <li>${c('app/trade/state.js')}: what the layout and the page share (the feed, the account) and the starred symbols, saved in
      a store. ${c('app/trade/format.js')}: prices, signs, percents, volumes and candle times.</li>
    <li>${c('api/trade.mjs')}: the dev API. The symbols, candles for each timeframe walked back from the last price (seeded,
      on a fixed day, so screenshots and tests see the same chart), and an account in memory: place an order (422 over the
      buying power), cancel one.</li>
  </ul>

  <h2 id="pith">The Pith parts it uses</h2>
  <ul>
    <li><a href="/docs/lists">Lists</a>: the watchlist in ${c('repeat()')} keyed by symbol, with a signal for each field that
      ticks (the "Rows that change often" pattern), and the trades keyed by id, so a new trade is one row added.</li>
    <li><a href="/docs/signals">Signals</a>: ${c('batch()')} around each step of the feed, so a step with 40 ticks updates the
      page once; ${c('computed()')} for change, cost, P&amp;L and equity.</li>
    <li><a href="/docs/selector">Selecting a row</a>: ${c('selector()')} marks the symbol on screen in the watchlist.</li>
    <li><a href="/docs/resource">Loading data</a>: ${c('resource()')} for the symbols, the candles (which reload when ${c('?tf')}
      changes) and the account; ${c('live()')} for the account, and ${c('optimistic()')} for placing and cancelling orders.</li>
    <li><a href="/docs/forms">Forms</a>: ${c('form()')} for the ticket, with a 422 from the server shown in it.</li>
    <li><a href="/docs/router">Routing</a>: ${c('/trade/:symbol')} with a layout, ${c('?tf')}, ${c('?q')} and ${c('?feed')} in the URL.</li>
    <li><a href="/docs/animation">Animation</a>: ${c('class="motion"')} and ${c('transition()')} around the
      account's table, so it grows and shrinks smoothly as orders are placed or dismissed. Not on the watchlist: it's a scroll box, and rows scrolled out of its view
      would be drawn outside it while they move (W051).</li>
  </ul>

  <h2 id="code">The interesting parts</h2>
  <h3 id="code-ticks">Every price is a signal, written in place</h3>
  <p>Each quote keeps the fields that tick in signals. A step of the feed writes all its ticks inside one
    ${c('batch()')}: the effects that read them run once, at its end. A watchlist row is built once; a tick changes its
    price text, its change, its flash class and its sparkline, and nothing else.</p>
  ${code(`
function toQuote(i) {
  return {
    symbol: i.symbol, name: i.name, prevClose: i.prevClose, spark: i.spark,
    price: signal(i.price),
    high: signal(i.high),
    low: signal(i.low),
    volume: signal(i.volume),
    move: signal(0),   // the last tick's direction
    ticks: signal(0),  // counts ticks, so a flash starts again on each one
    trade: signal(null),
  };
}

const t = performance.now();
batch(() => chosen.forEach(tick)); // effects run once, at the end: this is the DOM work of the step
const ms = performance.now() - t;`, { file: 'app/trade/feed.js' })}
  ${code(`
const row = (x) => {
  const change = () => ((x.price.value - x.prevClose) / x.prevClose) * 100;
  return html\`
    <li class=\${() => (isSelected(x.symbol) ? 'wl-row selected' : 'wl-row')}>
      <a class="wl-link" href=\${() => hrefFor(x.symbol)}>
        …
        <span class=\${() => flash(x)}>\${() => price(x.price.value)}</span>
        <span class=\${() => \`wl-change \${way(change())}\`}>\${() => percent(change())}</span>
      </a>
      …
    </li>\`;
};
html\`<ul class="wl-list">\${repeat(visible, (x) => x.symbol, row)}</ul>\`;`, { file: 'app/layouts/trade.js' })}
  <p>Measured with Stress on, in headless Chrome on a desktop (all 40 symbols in each step, while NWX's chart,
    book, trades, ticket and P&amp;L follow the ticks too): about <strong>2,200 updates a second</strong>, each step put on
    screen in <strong>2.7 ms</strong> on average (the worst in a second 4 to 8 ms), and the page kept drawing at 57 frames a
    second (median frame 16.7 ms). The bar above the watchlist shows the same numbers on your machine.
    The same screen written in React and Vue, measured side by side: <a href="/docs/benchmarks?view=trade">Benchmarks</a>.</p>
  ${note(html`A signal per field costs memory per row, so it's for lists that are busy, like this one. The positions and
    orders tables change a few times a minute: they replace their rows instead.`)}

  <h3 id="code-chart">A chart where a tick moves three things</h3>
  <p>The candles from the API are drawn once. Only the last candle, the last-price line and the crosshair read the live
    price. The y axis's range is a string, so the whole drawing is made again only when the price crosses into a new
    step outside it.</p>
  ${code(`
const last = computed(() => {
  const p = quote.price.value;
  return { ...base, c: p, h: Math.max(base.h, p), l: Math.min(base.l, p), v: base.v + (quote.volume.value - startVolume) };
});
const range = computed(() => {
  const lo = Math.min(fixedLo, last.value.l);
  const hi = Math.max(fixedHi, last.value.h);
  const { step: s } = rangeTicks(lo, hi, 5);
  return \`\${Math.floor(lo / s) * s}|\${Math.ceil(hi / s) * s}\`;
});`, { file: 'app/trade/chart.js' })}

  <h3 id="code-orders">Pending at once, then the server's answer</h3>
  <p>Placing an order adds it as Pending with ${c('optimistic()')}. The server answers with the whole account, which
    replaces it. A 422 rolls the order back and shows in the form; any other failure puts it under Orders with Retry.</p>
  ${code(`
const saved = await animated(() => acct.optimistic(
  (a) => ({ ...a, orders: [pending, ...a.orders] }),
  () => fetchJSON('/api/trade', { json: { ...order, price: q.price.peek() } })
));`, { file: 'app/pages/trade.js' })}

  <h3 id="code-quiet">Quiet for screen readers</h3>
  <p>Prices that change several times a second would make a screen reader talk without end. Nothing in the watchlist is a
    live region; the symbol on screen has one polite region that says its price at most every 5 seconds. The flash is
    color and an arrow, and the change has its sign, so nothing depends on color alone.</p>

  <h2 id="tests">Its tests</h2>
  <p>In ${c('tests/flows.js')}:</p>
  <ul>
    <li>trading: /trade opens NWX with live prices, the chart, the book and the account</li>
    <li>trading: picking a symbol in the watchlist changes the URL, the chart and the selected row</li>
    <li>trading: the timeframe is kept in ?tf, also when switching symbols</li>
    <li>trading: prices tick; Pause stops them, Resume and Stress start them again</li>
    <li>trading: a limit order at or above the price shows Pending, then Filled, and the position appears</li>
    <li>trading: the ticket checks the shares, and the server refuses an order over the buying power</li>
    <li>trading: an open order can be cancelled, after confirming</li>
    <li>trading: a lost feed says so, counts down, and Retry reconnects</li>
    <li>trading: searching the watchlist, starring a symbol, and an unknown symbol</li>
  </ul>
`;
