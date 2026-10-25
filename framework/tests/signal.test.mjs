import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch, root, untrack, onCleanup, catchError, selector } from '../pith/signal.js';

test('effect re-runs when a signal it read changes', () => {
  const s = signal(1);
  const seen = [];
  effect(() => seen.push(s.value));
  s.value = 2;
  s.value = 2; // same value: no re-run
  s.value = 3;
  assert.deepEqual(seen, [1, 2, 3]);
});

test('computed follows its sources', () => {
  const a = signal(2);
  const double = computed(() => a.value * 2);
  assert.equal(double.value, 4);
  a.value = 5;
  assert.equal(double.value, 10);
});

test('batch groups updates into one run', () => {
  const a = signal(1);
  const b = signal(1);
  let runs = 0;
  effect(() => { a.value; b.value; runs++; });
  batch(() => { a.value = 2; b.value = 2; });
  assert.equal(runs, 2);
});

test('dispose stops an effect and runs its cleanup', () => {
  const s = signal(0);
  let runs = 0;
  let cleaned = 0;
  const dispose = effect(() => { s.value; runs++; return () => cleaned++; });
  s.value = 1;
  dispose();
  s.value = 2;
  assert.equal(runs, 2);
  assert.equal(cleaned, 2);
});

test('nested effects are disposed when the parent re-runs', () => {
  const outer = signal(0);
  const inner = signal(0);
  let innerRuns = 0;
  effect(() => {
    outer.value;
    effect(() => { inner.value; innerRuns++; });
  });
  outer.value = 1; // old inner effect must be gone, new one created
  innerRuns = 0;
  inner.value = 1;
  assert.equal(innerRuns, 1);
});

test('root disposes everything created inside it', () => {
  const s = signal(0);
  let runs = 0;
  let cleaned = false;
  root((dispose) => {
    effect(() => { s.value; runs++; });
    onCleanup(() => (cleaned = true));
    dispose();
  });
  s.value = 1;
  assert.equal(runs, 1);
  assert.equal(cleaned, true);
});

test('untrack reads without subscribing', () => {
  const s = signal(0);
  let runs = 0;
  effect(() => { untrack(() => s.value); runs++; });
  s.value = 1;
  assert.equal(runs, 1);
});

test('effects that update each other forever throw instead of hanging', () => {
  const s = signal(0);
  effect(() => { s.value; });
  assert.throws(() => {
    root(() => effect(() => { s.value = s.value + 1; }));
  }, /infinite loop/);
});

// A spreadsheet's running total: each value depends on the one before it (the Spreadsheet example).
function chain(n) {
  const head = signal(1);
  const links = [];
  let runs = 0;
  let prev = head;
  for (let i = 0; i < n; i++) {
    const p = prev;
    prev = computed(() => (runs++, p.value + 1));
    links.push(prev);
  }
  return { head, links, runs: () => runs };
}

test('a 5,000-deep chain of computeds updates, each link once, without the infinite-loop error', () => {
  const c = chain(5000);
  const before = c.runs();
  c.head.value = 2;
  assert.equal(c.links[4999].value, 5002);
  assert.equal(c.runs() - before, 5000);
});

test('a computed that reads every link of a chain runs once per change, and never sees half an update', () => {
  const c = chain(1000);
  const seen = [];
  const sum = computed(() => {
    const total = c.links.reduce((s, l) => s + l.value, 0);
    seen.push(total);
    return total;
  });
  seen.length = 0;
  c.head.value = 2;
  assert.deepEqual(seen, [sum.value]);
  assert.equal(sum.value, (1000 * 1001) / 2 + 1000 * 2);
});

test('a computed nobody reads skips its re-runs, and catches up when it is read', () => {
  const a = signal(1);
  let runs = 0;
  const c = computed(() => (runs++, a.value * 2));
  a.value = 2;
  a.value = 3;
  assert.equal(runs, 1); // only the first run: the changes found no reader
  assert.equal(c.value, 6);
  assert.equal(c.peek(), 6);
  assert.equal(runs, 2);
  const seen = [];
  const stop = effect(() => seen.push(c.value)); // read in an effect, it follows every change again
  a.value = 4;
  assert.deepEqual(seen, [6, 8]);
  assert.equal(runs, 3);
  stop();
  a.value = 5;
  a.value = 6;
  assert.equal(runs, 3);
  assert.equal(c.value, 12);
  assert.equal(runs, 4);
});

test('only the unread end of a chain skips: the links it reads stay fresh, so reading it is one step', () => {
  const c = chain(5000);
  for (let i = 2; i < 5; i++) {
    const before = c.runs();
    c.head.value = i;
    assert.equal(c.runs() - before, 4999);
  }
  assert.equal(c.links[4999].value, 4 + 5000);
});

test('a diamond (e reads a and twice, twice reads a) computes e once, with both sides new', () => {
  const a = signal(1);
  const seen = [];
  const twice = computed(() => a.value * 2);
  const e = computed(() => (seen.push([a.value, twice.value]), a.value + twice.value));
  seen.length = 0;
  a.value = 2;
  assert.equal(e.value, 6);
  assert.deepEqual(seen, [[2, 4]]);
});

test('an effect nested in another runs after its parent, so a parent that removes it goes first', () => {
  const user = signal(/** @type {{ name: string } | null} */ ({ name: 'Ann' }));
  const signedIn = computed(() => user.value !== null);
  const names = [];
  effect(() => {
    if (signedIn.value) effect(() => names.push(/** @type {{ name: string }} */ (user.value).name));
  });
  assert.doesNotThrow(() => { user.value = null; });
  assert.deepEqual(names, ['Ann']);
});

test('effects that ping-pong forever still throw E003', () => {
  const a = signal(0);
  const b = signal(0);
  effect(() => { b.value = a.value + 1; });
  assert.throws(() => {
    root(() => effect(() => { a.value = b.value + 1; }));
  }, /infinite loop/);
});

test('catchError sends a synchronous throw to the handler', () => {
  const caught = [];
  const result = catchError(() => { throw new Error('boom'); }, (err) => caught.push(err.message));
  assert.equal(result, undefined);
  assert.deepEqual(caught, ['boom']);
});

test('catchError returns fn\'s value and passes a dispose', () => {
  const s = signal(0);
  let runs = 0;
  const value = catchError((dispose) => {
    effect(() => { s.value; runs++; });
    dispose();
    return 42;
  }, () => {});
  s.value = 1;
  assert.equal(value, 42);
  assert.equal(runs, 1);
});

test('catchError catches errors in later effect and computed re-runs', () => {
  const s = signal(0);
  const caught = [];
  catchError(() => {
    effect(() => { if (s.value === 1) throw new Error('effect'); });
    const c = computed(() => { if (s.value === 2) throw new Error('computed'); return s.value; });
    effect(() => c.value);
  }, (err) => caught.push(err.message));
  s.value = 1;
  s.value = 2;
  assert.deepEqual(caught, ['effect', 'computed']);
});

test('catchError reaches effects nested in effects and roots', () => {
  const s = signal(0);
  const caught = [];
  catchError(() => {
    effect(() => {
      root(() => effect(() => { if (s.value) throw new Error('deep'); }));
    });
  }, (err) => caught.push(err.message));
  s.value = 1;
  assert.deepEqual(caught, ['deep']);
});

test('the nearest catchError handles; a rethrow goes to the outer one', () => {
  const log = [];
  catchError(() => {
    catchError(() => { throw new Error('a'); }, (err) => log.push('inner ' + err.message));
    catchError(() => { throw new Error('b'); }, (err) => { log.push('inner ' + err.message); throw err; });
  }, (err) => log.push('outer ' + err.message));
  assert.deepEqual(log, ['inner a', 'inner b', 'outer b']);
});

test('without catchError, effect errors still throw', () => {
  const s = signal(0);
  effect(() => { if (s.value) throw new Error('loud'); });
  assert.throws(() => { s.value = 1; }, /loud/);
});

test('catchError is disposed with its owner', () => {
  const s = signal(0);
  let runs = 0;
  root((dispose) => {
    catchError(() => effect(() => { s.value; runs++; }), () => {});
    dispose();
  });
  s.value = 1;
  assert.equal(runs, 1);
});

test('the state registry is off in production: no globalThis.__pith, registry is null', async () => {
  const prev = globalThis.PITH_DEV;
  globalThis.PITH_DEV = false;
  try {
    // A fresh copy of dev.js (the query makes Node load it again), read with PITH_DEV = false.
    const dev = await import('../pith/dev.js?production');
    assert.equal(dev.DEV, false);
    assert.equal(dev.registry, null);
    assert.equal(globalThis.__pith, undefined);
  } finally {
    if (prev === undefined) delete globalThis.PITH_DEV;
    else globalThis.PITH_DEV = prev;
  }
});

// One effect per row reading isSelected(row): what the benchmark's table does.
function rows(n, isSelected) {
  const runs = new Array(n).fill(0);
  const disposers = [];
  for (let i = 0; i < n; i++) root((dispose) => (disposers.push(dispose), effect(() => (isSelected(i), runs[i]++))));
  return { runs, disposers, total: () => runs.reduce((a, b) => a + b, 0) };
}

test('selector: changing the selection re-runs only the two rows whose answer changed', () => {
  const selected = signal(-1);
  const isSelected = selector(selected);
  const t = rows(1000, isSelected);
  assert.equal(t.total(), 1000); // first run
  selected.value = 5;
  assert.equal(t.total(), 1001); // only row 5
  assert.equal(isSelected(5), true);
  selected.value = 7;
  assert.equal(t.total(), 1003); // rows 5 and 7
  assert.deepEqual([t.runs[5], t.runs[7]], [3, 2]);
  selected.value = 7; // same value: nothing
  assert.equal(t.total(), 1003);
});

test('selector: works with a computed or function source, and for keys not yet read', () => {
  const s = signal('a');
  const isSelected = selector(computed(() => s.value.toUpperCase()));
  assert.equal(isSelected('A'), true);
  assert.equal(isSelected('B'), false);
  s.value = 'b';
  assert.equal(isSelected('B'), true);
  assert.equal(isSelected('A'), false);
  const fromFn = selector(() => s.value);
  assert.equal(fromFn('b'), true);
});

test('selector: rows that go away are dropped, so memory stays bounded', () => {
  const selected = signal(0);
  const isSelected = selector(selected);
  for (let cycle = 0; cycle < 10; cycle++) {
    // Like the benchmark: 1,000 rows with fresh ids are created, then all removed.
    const disposers = [];
    for (let i = 0; i < 1000; i++) root((d) => (disposers.push(d), effect(() => isSelected(cycle * 1000 + i))));
    for (const d of disposers) d();
  }
  assert.equal(isSelected.size(), 0); // every key left with its last row
  const t = rows(3, isSelected); // still works afterwards
  selected.value = 1;
  assert.equal(t.total(), 5); // rows 0 (no longer selected) and 1 (now selected)
});
