// The spreadsheet's formulas: reading what's typed in a cell, and working out its value. Pure functions, no
// signals, so Node tests them (tests/sheet.test.mjs). app/sheet/model.js wires them to signals.
//
// A cell holds what was typed (its "raw" text). parseInput() turns that into a number, text, nothing, or a
// formula (anything starting with "="): its syntax tree and the cells it refers to. evaluate() works out a
// formula's value, asking for each cell it reads through get(id), so the caller decides how a read is made
// (in the app, it's a signal read, which is how a cell subscribes to the cells it uses).

export const ROWS = 1000;
export const COLS = 26;

/** An error value shown in a cell (#REF!, #DIV/0!, …). One object per code, so they compare with ===. */
export class SheetError {
  /** @param {string} code */
  constructor(code) {
    this.code = code;
  }
  toString() {
    return this.code;
  }
}
export const ERR = {
  REF: new SheetError('#REF!'), // a cell outside A1:Z1000
  DIV0: new SheetError('#DIV/0!'),
  NAME: new SheetError('#NAME?'), // an unknown function or name
  VALUE: new SheetError('#VALUE!'), // text where a number is needed, a range outside a function
  CYCLE: new SheetError('#CYCLE!'), // the cell depends on itself
  PARSE: new SheetError('#ERROR!'), // the formula can't be read
};

/** @typedef {number | string | boolean | null | SheetError} Value  null: an empty cell */
/**
 * @typedef {{ t: 'num', v: number } | { t: 'str', v: string } | { t: 'bool', v: boolean } | { t: 'ref', id: string }
 *   | { t: 'range', from: [number, number], to: [number, number] } | { t: 'err', e: SheetError }
 *   | { t: 'fn', name: string, args: Node[] } | { t: 'neg', a: Node } | { t: 'bin', op: string, a: Node, b: Node }} Node
 * @typedef {{ kind: 'empty', value: null, refs: null } | { kind: 'number', value: number, refs: null }
 *   | { kind: 'text', value: string, refs: null } | { kind: 'formula', value: SheetError | null, ast: Node | null, refs: string[] }} Input
 *   value of a formula: its error when it can't be read (ast is null then)
 */

// ---------- Cell names ----------

/** 0 → "A", 25 → "Z". */
export const colName = (/** @type {number} */ c) => String.fromCharCode(65 + c);
/** Row and column (both from 0) → "B3". */
export const cellId = (/** @type {number} */ r, /** @type {number} */ c) => `${colName(c)}${r + 1}`;
/** "B3" → [2, 1] (row, column, from 0), or null when it isn't a cell name. Out of the sheet → [-1, -1]. */
export function parseId(/** @type {string} */ id) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(id);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  const c = letters.length === 1 ? letters.charCodeAt(0) - 65 : COLS; // AA and beyond: past Z
  const r = Number(m[2]) - 1;
  return r >= 0 && r < ROWS && c < COLS ? [r, c] : [-1, -1];
}

// ---------- Reading what was typed ----------

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/** What a cell's text means. @param {string} raw @returns {Input} */
export function parseInput(raw) {
  const text = raw.trim();
  if (!text) return { kind: 'empty', value: null, refs: null };
  if (text[0] === '=') {
    try {
      const ast = new Parser(text.slice(1)).parse();
      return { kind: 'formula', value: null, ast, refs: refsOf(ast) };
    } catch (err) {
      if (!(err instanceof SheetError)) throw err;
      return { kind: 'formula', value: err, ast: null, refs: [] };
    }
  }
  if (NUMBER.test(text)) return { kind: 'number', value: Number(text), refs: null };
  return { kind: 'text', value: raw, refs: null };
}

const FUNCTIONS = /** @type {Record<string, [number, number]>} */ ({
  // name: [fewest arguments, most]
  SUM: [1, 255], AVERAGE: [1, 255], MIN: [1, 255], MAX: [1, 255], COUNT: [1, 255], IF: [2, 3], ROUND: [1, 2],
});

/** A small recursive-descent parser. Precedence, low to high: comparison, & , + -, * /, unary -, ^. */
class Parser {
  /** @param {string} src */
  constructor(src) {
    this.src = src;
    this.i = 0;
  }
  parse() {
    const node = this.compare();
    this.space();
    if (this.i < this.src.length) throw ERR.PARSE;
    return node;
  }
  space() {
    while (this.src[this.i] === ' ') this.i++;
  }
  /** @param {string} s */
  eat(s) {
    this.space();
    if (this.src.startsWith(s, this.i)) {
      this.i += s.length;
      return true;
    }
    return false;
  }
  /** @returns {Node} */
  compare() {
    const a = this.concat();
    for (const op of ['<>', '<=', '>=', '=', '<', '>']) if (this.eat(op)) return { t: 'bin', op, a, b: this.concat() };
    return a;
  }
  /** @returns {Node} */
  concat() {
    let a = this.sum();
    while (this.eat('&')) a = { t: 'bin', op: '&', a, b: this.sum() };
    return a;
  }
  /** @returns {Node} */
  sum() {
    let a = this.product();
    for (;;) {
      if (this.eat('+')) a = { t: 'bin', op: '+', a, b: this.product() };
      else if (this.eat('-')) a = { t: 'bin', op: '-', a, b: this.product() };
      else return a;
    }
  }
  /** @returns {Node} */
  product() {
    let a = this.unary();
    for (;;) {
      if (this.eat('*')) a = { t: 'bin', op: '*', a, b: this.unary() };
      else if (this.eat('/')) a = { t: 'bin', op: '/', a, b: this.unary() };
      else return a;
    }
  }
  /** @returns {Node} */
  unary() {
    if (this.eat('-')) return { t: 'neg', a: this.unary() };
    if (this.eat('+')) return this.unary();
    const a = this.primary();
    return this.eat('^') ? { t: 'bin', op: '^', a, b: this.unary() } : a;
  }
  /** @returns {Node} */
  primary() {
    this.space();
    const rest = this.src.slice(this.i);
    let m;
    if ((m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(rest))) {
      this.i += m[0].length;
      return { t: 'num', v: Number(m[0]) };
    }
    if ((m = /^"((?:[^"]|"")*)"/.exec(rest))) {
      this.i += m[0].length;
      return { t: 'str', v: m[1].replace(/""/g, '"') };
    }
    if (this.eat('(')) {
      const inner = this.compare();
      if (!this.eat(')')) throw ERR.PARSE;
      return inner;
    }
    if ((m = /^\$?[A-Za-z_][A-Za-z0-9_.$]*/.exec(rest))) {
      this.i += m[0].length;
      const word = m[0];
      if (this.eat('(')) return this.call(word.toUpperCase());
      const at = parseId(word);
      if (at) {
        if (this.eat(':')) {
          this.space();
          const end = /^\$?[A-Za-z]+\$?\d+/.exec(this.src.slice(this.i));
          const to = end && parseId(end[0]);
          if (!to) throw ERR.PARSE;
          this.i += /** @type {RegExpExecArray} */ (end)[0].length;
          if (at[0] < 0 || to[0] < 0) return { t: 'err', e: ERR.REF };
          return {
            t: 'range',
            from: [Math.min(at[0], to[0]), Math.min(at[1], to[1])],
            to: [Math.max(at[0], to[0]), Math.max(at[1], to[1])],
          };
        }
        return at[0] < 0 ? { t: 'err', e: ERR.REF } : { t: 'ref', id: cellId(at[0], at[1]) };
      }
      const upper = word.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') return { t: 'bool', v: upper === 'TRUE' };
      return { t: 'err', e: ERR.NAME };
    }
    throw ERR.PARSE;
  }
  /** @param {string} name @returns {Node} */
  call(name) {
    /** @type {Node[]} */
    const args = [];
    if (!this.eat(')')) {
      do args.push(this.compare());
      while (this.eat(','));
      if (!this.eat(')')) throw ERR.PARSE;
    }
    const arity = FUNCTIONS[name];
    if (!arity) return { t: 'err', e: ERR.NAME };
    if (args.length < arity[0] || args.length > arity[1]) throw ERR.PARSE;
    return { t: 'fn', name, args };
  }
}

/** Every cell a formula reads, once each (a range counts each of its cells). @param {Node} node */
export function refsOf(node) {
  /** @type {Set<string>} */
  const out = new Set();
  const walk = (/** @type {Node} */ n) => {
    if (n.t === 'ref') out.add(n.id);
    else if (n.t === 'range') {
      for (let r = n.from[0]; r <= n.to[0]; r++) for (let c = n.from[1]; c <= n.to[1]; c++) out.add(cellId(r, c));
    } else if (n.t === 'fn') n.args.forEach(walk);
    else if (n.t === 'neg') walk(n.a);
    else if (n.t === 'bin') (walk(n.a), walk(n.b));
  };
  walk(node);
  return [...out];
}

// ---------- Working out a value ----------

const isErr = (/** @type {unknown} */ v) => v instanceof SheetError;

/** A value as a number: empty is 0, TRUE is 1, text that reads as a number is that number. @param {Value} v */
function toNumber(v) {
  if (typeof v === 'number' || isErr(v)) return v;
  if (v === null) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const text = v.trim();
  return NUMBER.test(text) ? Number(text) : ERR.VALUE;
}

/** How a value shows in a cell. @param {Value} v */
export function format(v) {
  if (v === null) return '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ERR.VALUE.code;
    return String(Number.isInteger(v) ? v : Number(v.toPrecision(12)));
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

/**
 * The value of a formula.
 * @param {Node} node
 * @param {(id: string) => Value} get the value of another cell (in the app: a signal read)
 * @returns {Value}
 */
export function evaluate(node, get) {
  switch (node.t) {
    case 'num': case 'str': case 'bool': return node.v;
    case 'err': return node.e;
    case 'ref': return get(node.id);
    case 'range': return ERR.VALUE; // only inside a function, like SUM(A1:A3)
    case 'neg': {
      const a = toNumber(evaluate(node.a, get));
      return isErr(a) ? a : -a;
    }
    case 'bin': return binary(node.op, evaluate(node.a, get), evaluate(node.b, get));
    case 'fn': return call(node, get);
  }
}

/** @param {string} op @param {Value} x @param {Value} y @returns {Value} */
function binary(op, x, y) {
  if (isErr(x)) return x;
  if (isErr(y)) return y;
  if (op === '&') return format(x) + format(y);
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    // Numbers (and empty, as 0) compare as numbers, anything else as text without case.
    const nums = (typeof x === 'number' || x === null) && (typeof y === 'number' || y === null);
    const a = nums ? (x ?? 0) : format(x).toLowerCase();
    const b = nums ? (y ?? 0) : format(y).toLowerCase();
    return op === '=' ? a === b : op === '<>' ? a !== b : op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
  }
  const a = toNumber(x);
  const b = toNumber(y);
  if (isErr(a)) return a;
  if (isErr(b)) return b;
  const n = /** @type {number} */ (a);
  const m = /** @type {number} */ (b);
  if (op === '+') return n + m;
  if (op === '-') return n - m;
  if (op === '*') return n * m;
  if (op === '/') return m === 0 ? ERR.DIV0 : n / m;
  const p = n ** m; // ^
  return Number.isFinite(p) ? p : ERR.VALUE;
}

/**
 * The numbers among a function's arguments, the way spreadsheets count them: in a range, only numbers (text and
 * empty cells are skipped); a value given directly must be a number. The first error found is returned instead.
 * @param {Node[]} args @param {(id: string) => Value} get @returns {number[] | SheetError}
 */
function numbers(args, get) {
  const out = [];
  for (const arg of args) {
    if (arg.t === 'range') {
      for (let r = arg.from[0]; r <= arg.to[0]; r++) {
        for (let c = arg.from[1]; c <= arg.to[1]; c++) {
          const v = get(cellId(r, c));
          if (isErr(v)) return /** @type {SheetError} */ (v);
          if (typeof v === 'number') out.push(v);
        }
      }
    } else {
      const v = toNumber(evaluate(arg, get));
      if (isErr(v)) return /** @type {SheetError} */ (v);
      out.push(/** @type {number} */ (v));
    }
  }
  return out;
}

/** @param {{ name: string, args: Node[] }} node @param {(id: string) => Value} get @returns {Value} */
function call({ name, args }, get) {
  if (name === 'IF') {
    // Only the branch taken is worked out, so the cell only subscribes to the cells that branch reads.
    const test = evaluate(args[0], get);
    if (isErr(test)) return test;
    const yes = typeof test === 'string' ? toNumber(test) : test;
    if (isErr(yes)) return yes;
    const branch = yes ? args[1] : args[2];
    return branch ? evaluate(branch, get) : false;
  }
  if (name === 'ROUND') {
    const x = toNumber(evaluate(args[0], get));
    const d = args[1] ? toNumber(evaluate(args[1], get)) : 0;
    if (isErr(x)) return x;
    if (isErr(d)) return d;
    const n = /** @type {number} */ (x);
    const digits = Math.trunc(/** @type {number} */ (d));
    // Halves round away from zero, as in spreadsheets; going through the text form avoids 1.005 → 1.
    return Math.sign(n) * Number(`${Math.round(Number(`${Math.abs(n)}e${digits}`))}e${-digits}`);
  }
  if (name === 'COUNT') {
    let count = 0;
    for (const arg of args) {
      if (arg.t === 'range') {
        for (let r = arg.from[0]; r <= arg.to[0]; r++) for (let c = arg.from[1]; c <= arg.to[1]; c++) if (typeof get(cellId(r, c)) === 'number') count++;
      } else if (typeof evaluate(arg, get) === 'number') count++;
    }
    return count;
  }
  const list = numbers(args, get);
  if (isErr(list)) return /** @type {SheetError} */ (list);
  const xs = /** @type {number[]} */ (list);
  if (name === 'SUM') return xs.reduce((s, x) => s + x, 0);
  if (name === 'AVERAGE') return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : ERR.DIV0;
  if (name === 'MIN') return xs.length ? Math.min(...xs) : 0;
  return xs.length ? Math.max(...xs) : 0; // MAX
}

// ---------- Cycles and order ----------

/**
 * Tarjan's strongly connected components, without recursion (a 1,000-deep chain would overflow the stack).
 * Walks from `starts` along `edges(id)` (the cells a cell reads).
 * @param {Iterable<string>} starts
 * @param {(id: string) => readonly string[] | null | undefined} edges
 * @returns {{ order: string[], cyclic: Set<string> }} order: every cell reached, each after the cells it reads ·
 *   cyclic: the cells on a cycle (in a group that reads itself, or a cell that reads itself)
 */
export function analyse(starts, edges) {
  /** @type {Map<string, number>} */
  const index = new Map();
  /** @type {Map<string, number>} */
  const low = new Map();
  /** @type {Set<string>} */
  const onStack = new Set();
  /** @type {string[]} */
  const stack = [];
  /** @type {string[]} */
  const order = [];
  /** @type {Set<string>} */
  const cyclic = new Set();
  let next = 0;
  for (const start of starts) {
    if (index.has(start)) continue;
    /** @type {[string, readonly string[], number][]} */
    const work = [[start, edges(start) ?? [], 0]];
    index.set(start, next);
    low.set(start, next++);
    stack.push(start);
    onStack.add(start);
    while (work.length) {
      const top = work[work.length - 1];
      const [v, out] = top;
      if (top[2] < out.length) {
        const w = out[top[2]++];
        if (!index.has(w)) {
          index.set(w, next);
          low.set(w, next++);
          stack.push(w);
          onStack.add(w);
          work.push([w, edges(w) ?? [], 0]);
        } else if (onStack.has(w)) {
          low.set(v, Math.min(/** @type {number} */ (low.get(v)), /** @type {number} */ (index.get(w))));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1][0];
        low.set(parent, Math.min(/** @type {number} */ (low.get(parent)), /** @type {number} */ (low.get(v))));
      }
      if (low.get(v) === index.get(v)) {
        /** @type {string[]} */
        const group = [];
        let w;
        do {
          w = /** @type {string} */ (stack.pop());
          onStack.delete(w);
          group.push(w);
        } while (w !== v);
        if (group.length > 1 || out.includes(v)) for (const g of group) cyclic.add(g);
        order.push(...group);
      }
    }
  }
  return { order, cyclic };
}
