import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch, root, untrack, onCleanup, catchError } from '../mini/signal.js';

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
