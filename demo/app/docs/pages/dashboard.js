import { html } from 'pith';
import { code, note, c } from '../ui.js';

export default () => html`
  <p>Analytics for Fern &amp; Field, a made-up online shop. KPI cards compare a date range with the one before it,
    two SVG charts show revenue per day and orders by channel, and a table lists the orders, which you can sort,
    filter, search and page through. All of it is kept in the URL, so a reload or a shared link shows the same view.</p>

  <h2 id="try">What to try</h2>
  <ul>
    <li>Switch between 7, 30 and 90 days. The KPIs, both charts and the table load again, and the range goes into
      ${c('?range=')}. Reload: it's still there.</li>
    <li>Point at the revenue chart, or give it focus with Tab and use the arrow keys. A tooltip shows the day's value.
      "Show the numbers" opens every value as a table.</li>
    <li>Sort the orders by Customer or Total, then click again to reverse. Filter by a status, and search for a customer
      or an order number. Search for a name nobody has to see "No orders match", with Clear filters.</li>
    <li>Page through the orders with Previous and Next. The page is kept in the URL too.</li>
    <li>Click an order: its details open beside the table. Escape or Close returns focus to the row.</li>
    <li>Open <a href="/dashboard?range=fail">${c('/dashboard?range=fail')}</a>. The API answers 500: the numbers and the
      orders each say so, with Try again and a link back to the last 30 days.</li>
    <li>Make the window narrow, or open it on a phone. The charts redraw at the new width, so their text stays the same size.</li>
  </ul>

  <h2 id="built">How it's built</h2>
  <ul>
    <li>${c('app/pages/dashboard.js')}: the page. It reads the range and the table's sort, direction, status, search and page
      from the URL, loads the summary and the orders from them, and draws the KPIs, the table, the pager and the order panel.</li>
    <li>${c('app/dashboard/charts.js')}: the line chart and the bar chart, as inline SVG drawn at the measured width of their box,
      with pointer and keyboard reading, a live region and a table of the numbers.</li>
    <li>${c('app/dashboard/format.js')}: money, counts, dates, and round tick values for the y axis.</li>
    <li>${c('api/dashboard.mjs')}: the dev API. Data made once from a fixed seed and a fixed last day, so every run, test and
      screenshot sees the same numbers. It returns the summary for a range, or one page of its orders.</li>
  </ul>

  <h2 id="pith">The Pith parts it uses</h2>
  <ul>
    <li><a href="/docs/router">Routing</a>: everything in the ${c('?query')}, changed with ${c('router.setQuery()')}.</li>
    <li><a href="/docs/resource">Loading data</a>: one ${c('resource()')} for the summary and one for the orders. Each reads the
      URL, so a change refetches what depends on it and cancels the request it replaces. Each has its own loading
      skeleton and error view, so a failed request never blanks the page.</li>
    <li><a href="/docs/lists">Lists</a>: the table's rows in ${c('repeat()')}, keyed by order id.</li>
    <li><a href="/docs/selector">Selecting a row</a>: ${c('selector()')} marks the open order, so opening another touches 2 rows.</li>
    <li><a href="/docs/signals">Signals</a>: ${c('computed()')} for each value read from the URL, and a signal per chart for the point
      being read.</li>
  </ul>

  <h2 id="code">The interesting parts</h2>
  <h3 id="code-url">The URL is the state</h3>
  <p>There's no state for the range, the sort or the page: they are ${c('computed()')} values of ${c('router.query')}.
    Defaults are left out of the URL, so a plain ${c('/dashboard')} is the 30-day view.</p>
  ${code(`
const q = () => router.query.value;
const range = computed(() => q().range ?? '30');
const sort = computed(() => q().sort ?? 'date');
const dir = computed(() => q().dir ?? COLUMNS.find((c) => c.sort === sort.value)?.first ?? 'desc');
const status = computed(() => q().status ?? '');
const search = computed(() => q().q ?? '');
const needle = computed(() => search.value.trim());
const page = computed(() => Number(q().page) || 1);`, { file: 'app/pages/dashboard.js' })}

  <h3 id="code-api">One endpoint, two views, and a way to fail</h3>
  ${code(`
export async function GET({ query }) {
  await delay(query.view === 'orders' ? 250 : 350);
  if (query.range === 'fail') return Response.json({ message: 'The analytics service is not answering (500).' }, { status: 500 });
  const range = Number(query.range ?? 30);
  if (!RANGES.includes(range)) return Response.json({ message: \`Unknown range: pick \${RANGES.join(', ')} days\` }, { status: 400 });
  if (query.view === 'orders') return orderPage(range, query);
  return summary(range);
}`, { file: 'api/dashboard.mjs' })}

  <h3 id="code-charts">Charts drawn at their real width</h3>
  <p>A chart scaled with a ${c('viewBox')} shrinks its text on a phone. These measure their box instead, and draw again
    when it resizes. The observer is disconnected when the chart goes away.</p>
  ${code(`
/** A signal with the box's width in pixels, updated when it resizes. Use as ref=\${measure}. */
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
}`, { file: 'app/dashboard/charts.js' })}
  ${note(html`In an ${c('html`…`')} template, ${c('<text>')} and ${c('<path>')} only become SVG inside an ${c('<svg>')}. A piece of
    a chart built in its own template is wrapped in a nested ${c('<svg overflow="visible">')}.`)}

  <h2 id="tests">Its tests</h2>
  <p>In ${c('tests/flows.js')}:</p>
  <ul>
    <li>dashboard: KPIs, charts and orders load; a new range is kept in the URL and changes the numbers</li>
    <li>dashboard: sorting the orders by a column (aria-sort follows)</li>
    <li>dashboard: a status filter, and a search that matches nothing</li>
    <li>dashboard: paging through the orders</li>
    <li>dashboard: selecting an order opens its details, Close returns to the table</li>
    <li>dashboard: when the API fails, each part says so and offers a way out</li>
  </ul>
`;
