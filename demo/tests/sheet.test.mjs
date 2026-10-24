// The Spreadsheet's formulas (app/sheet/formula.js): pure functions, so they're tested here in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, evaluate, format, analyse, parseId, cellId, ERR } from '../app/sheet/formula.js';

/** The value of what's typed in a cell, reading other cells from `sheet` (raw text by id). */
function valueOf(raw, sheet = {}, seen = new Set()) {
  const input = parseInput(raw);
  if (input.kind !== 'formula') return input.value;
  if (!input.ast) return input.value;
  return evaluate(input.ast, (id) => {
    if (seen.has(id)) return ERR.CYCLE;
    return valueOf(sheet[id] ?? '', sheet, new Set([...seen, id]));
  });
}
const show = (raw, sheet) => format(valueOf(raw, sheet));

test('sheet: cell names', () => {
  assert.deepEqual(parseId('A1'), [0, 0]);
  assert.deepEqual(parseId('z1000'), [999, 25]);
  assert.deepEqual(parseId('$B$3'), [2, 1]);
  assert.deepEqual(parseId('A1001'), [-1, -1]);
  assert.deepEqual(parseId('AA1'), [-1, -1]);
  assert.equal(parseId('A0')?.[0], -1);
  assert.equal(parseId('hello'), null);
  assert.equal(cellId(2, 1), 'B3');
});

test('sheet: what was typed is a number, text, nothing or a formula', () => {
  assert.deepEqual(parseInput(''), { kind: 'empty', value: null, refs: null });
  assert.equal(parseInput(' 42 ').value, 42);
  assert.equal(parseInput('-1.5e3').value, -1500);
  assert.equal(parseInput('Rent').kind, 'text');
  assert.equal(parseInput('12 apples').kind, 'text');
  const f = parseInput('=A1+SUM(B1:B3)*2');
  assert.equal(f.kind, 'formula');
  assert.deepEqual(f.refs, ['A1', 'B1', 'B2', 'B3']);
});

test('sheet: arithmetic, precedence and text', () => {
  assert.equal(show('=1+2*3'), '7');
  assert.equal(show('=(1+2)*3'), '9');
  assert.equal(show('=-2^2'), '-4');
  assert.equal(show('=2^3^2'), '512');
  assert.equal(show('=10/4'), '2.5');
  assert.equal(show('=0.1+0.2'), '0.3');
  assert.equal(show('="a"&"b"&1'), 'ab1');
  assert.equal(show('=A1*3', { A1: '4' }), '12');
  assert.equal(show('=A1+1', {}), '1'); // an empty cell is 0
  assert.equal(show('=a1 + b2', { A1: '1', B2: '2' }), '3');
  assert.equal(show('=1<2'), 'TRUE');
  assert.equal(show('="Abc"="abc"'), 'TRUE');
});

test('sheet: functions', () => {
  const sheet = { A1: '1', A2: '2', A3: 'text', A4: '', A5: '5' };
  assert.equal(show('=SUM(A1:A5)', sheet), '8'); // text and empty cells are skipped
  assert.equal(show('=SUM(A1, 10, A2)', sheet), '13');
  assert.equal(show('=AVERAGE(A1:A5)', sheet), '2.66666666667');
  assert.equal(show('=MIN(A1:A5)', sheet), '1');
  assert.equal(show('=MAX(A1:A5)', sheet), '5');
  assert.equal(show('=COUNT(A1:A5)', sheet), '3');
  assert.equal(show('=IF(A1>0,"yes","no")', sheet), 'yes');
  assert.equal(show('=IF(A4,"yes","no")', sheet), 'no');
  assert.equal(show('=IF(0,1)'), 'FALSE');
  assert.equal(show('=ROUND(2.5)'), '3');
  assert.equal(show('=ROUND(-2.5)'), '-3');
  assert.equal(show('=ROUND(1.005,2)'), '1.01');
  assert.equal(show('=ROUND(1234,-2)'), '1200');
  assert.equal(show('=sum(A1:A2)', sheet), '3');
});

test('sheet: errors', () => {
  assert.equal(show('=1/0'), '#DIV/0!');
  assert.equal(show('=AVERAGE(A1:A2)'), '#DIV/0!');
  assert.equal(show('=A1001'), '#REF!');
  assert.equal(show('=SUM(A1:A1001)'), '#REF!');
  assert.equal(show('=FOO(1)'), '#NAME?');
  assert.equal(show('=total+1'), '#NAME?');
  assert.equal(show('=A1*2', { A1: 'Rent' }), '#VALUE!');
  assert.equal(show('=A1:A3'), '#VALUE!');
  assert.equal(show('=1+'), '#ERROR!');
  assert.equal(show('=(1'), '#ERROR!');
  assert.equal(show('=IF(1)'), '#ERROR!');
  assert.equal(show('=SUM(A1:A2)+1', { A1: '=1/0' }), '#DIV/0!'); // errors pass through
  assert.equal(show('=A1', { A1: '=B1', B1: '=A1' }), '#CYCLE!');
});

test('sheet: analyse orders cells after what they read, and finds cycles without recursion', () => {
  const edges = { C1: ['A1', 'B1'], B1: ['A1'], A1: [] };
  const { order, cyclic } = analyse(['C1'], (id) => edges[id]);
  assert.deepEqual(order, ['A1', 'B1', 'C1']);
  assert.equal(cyclic.size, 0);

  const loop = { A1: ['B1'], B1: ['C1'], C1: ['A1'], D1: ['A1'], E1: ['E1'] };
  const found = analyse(['D1', 'E1'], (id) => loop[id]).cyclic;
  assert.deepEqual([...found].sort(), ['A1', 'B1', 'C1', 'E1']); // D1 reads the cycle, but isn't on it

  // A 20,000-deep chain: D2 reads D1, D3 reads D2, …
  const chain = (id) => {
    const n = Number(id.slice(1));
    return n > 1 ? [`D${n - 1}`] : [];
  };
  const deep = analyse(['D20000'], chain);
  assert.equal(deep.order.length, 20000);
  assert.equal(deep.order[0], 'D1');
  assert.equal(deep.cyclic.size, 0);
});
