import { memo, useCallback, useState } from 'react';
import { buildData } from './data.js';

const Row = memo(function Row({ item, selected, onSelect, onRemove }) {
  return (
    <tr className={selected ? 'selected' : ''}>
      <td className="col-id">{item.id}</td>
      <td className="col-label"><a className="lbl" onClick={() => onSelect(item.id)}>{item.label}</a></td>
      <td><a className="remove" aria-label="Remove" onClick={() => onRemove(item.id)}>×</a></td>
    </tr>
  );
});

export default function App() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(0);

  const select = useCallback((id) => setSelected(id), []);
  const remove = useCallback((id) => setRows((rs) => rs.filter((r) => r.id !== id)), []);

  const run = () => {
    setRows(buildData(1000));
    setSelected(0);
  };
  const runLots = () => {
    setRows(buildData(10000));
    setSelected(0);
  };
  const add = () => setRows((rs) => [...rs, ...buildData(1000)]);
  const update = () => setRows((rs) => rs.map((r, i) => (i % 10 === 0 ? { ...r, label: `${r.label} !!!` } : r)));
  const clear = () => {
    setRows([]);
    setSelected(0);
  };
  const swapRows = () =>
    setRows((rs) => {
      if (rs.length <= 998) return rs;
      const next = rs.slice();
      [next[1], next[998]] = [next[998], next[1]];
      return next;
    });

  return (
    <main className="page">
      <section className="section">
        <h1>Benchmark</h1>
        <div className="bench-buttons">
          <button id="run" className="btn" type="button" onClick={run}>Create 1,000 rows</button>
          <button id="runlots" className="btn" type="button" onClick={runLots}>Create 10,000 rows</button>
          <button id="add" className="btn" type="button" onClick={add}>Append 1,000 rows</button>
          <button id="update" className="btn" type="button" onClick={update}>Update every 10th row</button>
          <button id="clear" className="btn" type="button" onClick={clear}>Clear</button>
          <button id="swaprows" className="btn" type="button" onClick={swapRows}>Swap rows</button>
        </div>
        <table className="bench-table">
          <tbody>
            {rows.map((r) => (
              <Row key={r.id} item={r} selected={selected === r.id} onSelect={select} onRemove={remove} />
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
