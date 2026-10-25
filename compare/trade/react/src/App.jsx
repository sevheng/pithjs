import { memo, useCallback, useEffect, useMemo, useReducer } from 'react';
import { createFeed, sizeFromUrl, timer, TAPE } from '../../../shared/trade/feed.js';
import { price, percent, money, signedMoney, count, way, changePct, flashClass, arrow, sparkPoints, SPARK_W, SPARK_H } from '../../../shared/trade/format.js';
import { W, H, RIGHT, extent, lastCandle, rangeKey, scale, candleShape, priceLine } from '../../../shared/trade/chart.js';

// The trading screen: a watchlist of n symbols that tick, and the selected symbol's quote, chart, order book,
// trades and the positions. The quotes are state, replaced immutably for the symbols that ticked (the others
// keep their object, so their memoized rows skip rendering); one dispatch per feed step.

const feed = createFeed({ n: sizeFromUrl() });

function init() {
  const selected = feed.symbols[0].symbol;
  return {
    quotes: feed.symbols.map((s) => ({ ...s, move: 0, ticks: 0 })),
    selected,
    tape: feed.trades(selected),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'tick': {
      const quotes = state.quotes.slice();
      let tape = state.tape;
      for (const t of action.ticks) {
        const q = quotes[t.index];
        quotes[t.index] = {
          ...q, price: t.price, high: t.high, low: t.low, volume: t.volume, move: t.move, ticks: q.ticks + 1,
          spark: [...q.spark.slice(1), t.price],
        };
        if (t.symbol === state.selected) tape = [t.trade, ...tape.slice(0, TAPE - 1)];
      }
      return { ...state, quotes, tape };
    }
    case 'select':
      return { ...state, selected: action.symbol, tape: action.tape };
    default:
      return state;
  }
}

const Row = memo(function Row({ q, selected, onSelect }) {
  const change = changePct(q.price, q.prevClose);
  return (
    <li className={selected ? 'wl-row selected' : 'wl-row'} data-symbol={q.symbol}>
      <button type="button" className="wl-btn" aria-pressed={selected} onClick={() => onSelect(q.symbol)}>
        <span className="wl-id"><span className="wl-sym">{q.symbol}</span><span className="wl-name">{q.name}</span></span>
        <svg className={`wl-spark ${way(change)}`} width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true">
          <polyline points={sparkPoints(q.spark)} />
        </svg>
        <span className="wl-nums">
          <span className="wl-quote"><span className="wl-arrow" aria-hidden="true">{arrow(q.move)}</span><span className={flashClass(q.move, q.ticks)}>{price(q.price)}</span></span>
          <span className={`wl-change ${way(change)}`}>{percent(change)}</span>
        </span>
      </button>
    </li>
  );
});

const Quote = memo(function Quote({ q }) {
  const pct = changePct(q.price, q.prevClose);
  return (
    <section className="panel quote" id="quote" aria-label="Quote">
      <h2 className="q-sym">{q.symbol}</h2>
      <p className="q-name">{q.name}</p>
      <span className="q-price">{price(q.price)}</span>
      <span className={`q-change ${way(pct)}`}>{percent(pct)}</span>
      <dl className="q-range">
        <div><dt>High</dt><dd className="q-high">{price(q.high)}</dd></div>
        <div><dt>Low</dt><dd className="q-low">{price(q.low)}</dd></div>
        <div><dt>Volume</dt><dd className="q-vol">{count(q.volume)}</dd></div>
      </dl>
    </section>
  );
});

/** The 119 candles that don't move: drawn again only when the y range changes. */
const Candles = memo(function Candles({ candles, range }) {
  const s = scale(range, candles.length);
  return candles.slice(0, -1).map((c, i) => {
    const k = candleShape(c, i, s);
    return (
      <g key={i} className={k.cls}>
        <path className="cdl-wick" d={k.wick} />
        <rect className="cdl-body" x={k.x} y={k.y} width={k.w} height={k.h} />
      </g>
    );
  });
});

const Chart = memo(function Chart({ symbol, live, prevClose }) {
  const candles = useMemo(() => feed.candles(symbol), [symbol]);
  const fixed = useMemo(() => extent(candles), [candles]);
  const n = candles.length;
  const range = rangeKey(fixed, live);
  const s = useMemo(() => scale(range, n), [range, n]);
  const last = candleShape(lastCandle(candles[n - 1], live), n - 1, s);
  const line = priceLine(live, s);
  return (
    <section className="panel chart" id="chart" aria-label="Chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${symbol}, ${n} one-minute candles`}>
        {s.grid.map((g) => (
          <g key={g.value}>
            <path className="chart-grid" d={`M4 ${g.y}H${W - RIGHT}`} />
            <text className="chart-tick" x={W - RIGHT + 8} y={g.y} dominantBaseline="middle">{price(g.value)}</text>
          </g>
        ))}
        <Candles candles={candles} range={range} />
        <g className={`${last.cls} last`}>
          <path className="cdl-wick" d={last.wick} />
          <rect className="cdl-body" x={last.x} y={last.y} width={last.w} height={last.h} />
        </g>
        <g className={`last-price ${way(live - prevClose)}`}>
          <path className="last-line" d={line.d} />
          <rect className="last-tag" x={line.tagX} y={line.tagY} width={RIGHT - 4} height="20" rx="4" />
          <text className="last-text" x={line.textX} y={line.y} dominantBaseline="middle">{price(live)}</text>
        </g>
      </svg>
    </section>
  );
});

const Level = ({ l, cls }) => (
  <li className={cls} style={{ '--depth': `${(l.depth * 100).toFixed(1)}%` }}>
    <span className="book-price">{price(l.price)}</span><span className="book-size">{count(l.size)}</span><span className="book-total">{count(l.total)}</span>
  </li>
);

const Book = memo(function Book({ symbol, live }) {
  const { asks, bids } = useMemo(() => feed.book(symbol, live), [symbol, live]);
  return (
    <section className="panel book" id="book" aria-labelledby="book-title">
      <h2 id="book-title">Order book</h2>
      <div className="book-row book-head"><span>Price</span><span>Size</span><span>Total</span></div>
      <ul className="book-list">
        {asks.map((l, i) => <Level key={`a${i}`} l={l} cls="book-row ask" />)}
        {bids.map((l, i) => <Level key={`b${i}`} l={l} cls={i === 0 ? 'book-row bid best' : 'book-row bid'} />)}
      </ul>
    </section>
  );
});

const Trade = memo(function Trade({ t }) {
  return (
    <li className="tape-row">
      <span className="tape-time">{t.time}</span>
      <span className={t.side === 'buy' ? 'tape-price up' : 'tape-price down'}>{price(t.price)}</span>
      <span className="tape-size">{count(t.size)}</span>
    </li>
  );
});

const Tape = memo(function Tape({ tape }) {
  return (
    <section className="panel tape" id="tape" aria-labelledby="tape-title">
      <h2 id="tape-title">Trades</h2>
      <div className="tape-row book-head"><span>Time</span><span>Price</span><span>Size</span></div>
      <div className="tape-scroll">
        <ul className="tape-list">{tape.map((t) => <Trade key={t.id} t={t} />)}</ul>
      </div>
    </section>
  );
});

const PositionRow = memo(function PositionRow({ p, live }) {
  const pnl = p.qty * (live - p.avg);
  return (
    <tr className="pos-row" data-symbol={p.symbol}>
      <td>{p.symbol}</td><td>{count(p.qty)}</td><td>{price(p.avg)}</td>
      <td className="pos-last">{price(live)}</td>
      <td className={`pos-pnl ${way(pnl)}`}>{signedMoney(pnl)}</td>
    </tr>
  );
});

const Positions = memo(function Positions({ quotes, totalPnl }) {
  return (
    <section className="panel positions" id="positions" aria-labelledby="pos-title">
      <h2 id="pos-title">Positions</h2>
      <table>
        <thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>P&amp;L</th></tr></thead>
        <tbody>{feed.positions.map((p) => <PositionRow key={p.symbol} p={p} live={quotes[p.index].price} />)}</tbody>
        <tfoot><tr><td colSpan="4">Total P&amp;L</td><td id="pnl-total" className={way(totalPnl)}>{signedMoney(totalPnl)}</td></tr></tfoot>
      </table>
    </section>
  );
});

export default function App() {
  const [{ quotes, selected, tape }, dispatch] = useReducer(reducer, null, init);

  const select = useCallback((symbol) => dispatch({ type: 'select', symbol, tape: feed.trades(symbol) }), []);

  // The measure script's handle (compare/trade/measure.js): the same in every implementation.
  useEffect(() => {
    const step = (k) => {
      const ticks = feed.step(k);
      dispatch({ type: 'tick', ticks });
      return ticks;
    };
    const clock = timer(step);
    window.bench = { step, select, start: clock.start, stop: clock.stop, feed };
    return () => {
      clock.stop();
      delete window.bench;
    };
  }, [select]);

  const { equity, totalPnl } = useMemo(() => {
    let value = 0;
    let pnl = 0;
    for (const p of feed.positions) {
      const live = quotes[p.index].price;
      value += p.qty * live;
      pnl += p.qty * (live - p.avg);
    }
    return { equity: feed.cash + value, totalPnl: pnl };
  }, [quotes]);

  const q = quotes[feed.indexOf(selected)];

  return (
    <main className="trade">
      <header className="trade-top">
        <h1>Trading</h1>
        <dl className="equity"><dt>Equity</dt><dd id="equity">{money(equity)}</dd></dl>
      </header>
      <section className="panel watch" aria-labelledby="wl-title">
        <h2 id="wl-title">Watchlist · {count(quotes.length)} symbols</h2>
        <div className="wl-scroll">
          <ul className="wl-list" id="watchlist">
            {quotes.map((x) => <Row key={x.symbol} q={x} selected={x.symbol === selected} onSelect={select} />)}
          </ul>
        </div>
      </section>
      <div className="detail">
        <Quote q={q} />
        <Chart symbol={q.symbol} live={q.price} prevClose={q.prevClose} />
        <div className="panels">
          <Book symbol={q.symbol} live={q.price} />
          <Tape tape={tape} />
        </div>
        <Positions quotes={quotes} totalPnl={totalPnl} />
      </div>
    </main>
  );
}
