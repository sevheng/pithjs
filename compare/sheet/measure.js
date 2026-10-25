// What tools/measure.mjs measures in the Spreadsheet (the contract is at the top of measure.mjs).
//
// Every operation goes through the page the way a person does (a click on a button, Enter in the formula bar, a
// scroll event on the grid's box), and its run() resolves once the DOM shows the result, checked the same way
// for all three implementations: until() looks right after the event's microtasks (where Pith has already
// drawn, and Vue and React flush a click's update), then after each further macrotask tick (React schedules
// a scroll's update in a task of its own). ok() checks the DOM again: the values, not just that something
// changed.

const ROW_H = 32;

// In the page, before each script: helpers, and the expected final balance from the shared demo data.
const prelude = `
  const q = (s) => document.querySelector(s);
  const text = (id) => q('#cell-' + id)?.textContent.trim() ?? null;
  const sum = (id) => q('#sum-' + id)?.textContent.trim() ?? null;
  const until = async (done) => {
    await null; // the event's own microtasks first
    for (let i = 0; !done(); i++) {
      if (i > 20000) throw new Error('the page never showed the result');
      await __m.tick();
    }
  };
  const { finalBalance } = await import('/shared/sheet/demo-data.js');
  const FINAL = String(finalBalance(2500));
  await __m.waitFor(() => q('#cell-A1')); // the grid is drawn
  /** The demo budget, loaded once (Edit A1 changes it, which is fine for what follows). */
  const demoLoaded = async () => {
    if (/^-?\\d/.test(sum('G4') ?? '')) return;
    q('#fill').click();
    await __m.waitFor(() => sum('G4') === FINAL);
  };
`;

export const load = { path: '/', ready: '#cell-A1' };

export const runtime = [
  {
    path: '/',
    script: `(async () => {
      ${prelude}
      let expected = '';
      let leaf = '1';
      const box = q('.sheet-scroll');
      const scrollBy = (y) => { box.scrollTop = y; box.dispatchEvent(new Event('scroll')); };
      let lastRow = 0;

      const filled = () => text('G4') === FINAL && sum('G4') === FINAL && text('A1') === '2500' && text('F4') === 'Final balance';
      const editedA1 = () => text('G4') === expected && sum('G4') === expected &&
        text('D2') === String(Number(text('A1')) + Number(text('C2')));
      const scrolled = () => !q('#cell-A1') && /^-?\\d/.test(text('D' + (lastRow + 1)) ?? '');
      const cleared = () => text('A1') === '' && text('G4') === '' && text('D10') === '' && sum('G4') === '—';

      return __m.ops({
        'fill demo data': {
          setup: async () => {
            if (text('A1') === '') return;
            q('#clear').click();
            await until(cleared);
          },
          run: async () => { q('#fill').click(); await until(filled); },
          ok: filled,
        },
        'Edit A1 (1,000-deep chain)': {
          setup: async () => {
            await demoLoaded();
            expected = String(Number(text('G4')) + 100);
          },
          run: async () => { q('#edit-a1').click(); await until(editedA1); },
          ok: editedA1,
        },
        'edit one cell nobody reads': {
          setup: async () => {
            await demoLoaded();
            leaf = leaf === '1' ? '2' : '1';
            q('#cell-H3').click();
            await __m.waitFor(() => q('.sheet-name').textContent.trim() === 'H3');
            const input = q('#sheet-input');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, leaf);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await __m.waitFor(() => input.value === leaf);
          },
          run: async () => { q('.sheet-formula').requestSubmit(); await until(() => text('H3') === leaf); },
          ok: () => text('H3') === leaf && text('G4') !== '' && q('.sheet-name').textContent.trim() === 'H4',
        },
        'scroll one screen': {
          setup: async () => {
            scrollBy(0);
            await __m.waitFor(() => q('#cell-A1'));
            await demoLoaded();
          },
          run: async () => {
            scrollBy(box.clientHeight);
            lastRow = Math.floor((box.scrollTop + box.clientHeight - 1) / ${ROW_H});
            await until(scrolled);
          },
          ok: scrolled,
        },
        clear: {
          setup: async () => {
            scrollBy(0);
            await __m.waitFor(() => q('#cell-A1'));
            await demoLoaded();
          },
          run: async () => { q('#clear').click(); await until(cleared); },
          ok: cleared,
        },
      });
    })()`,
  },
];

export const stress = [
  {
    name: '100 random edits/s on the demo data',
    path: '/',
    script: `(async () => {
      ${prelude}
      bench.fill();
      await __m.waitFor(() => text('G4') === FINAL);
      const result = await __m.underLoad(() => bench.start(100), () => bench.stop(), 5000);
      await __m.waitFor(() => text('G4') !== FINAL); // the edits reached the end of the chain
      return result;
    })()`,
  },
];

export const memory = [
  { name: 'empty', path: '/', script: `(async () => { ${prelude} await __m.settle(); })()` },
  {
    name: 'demo data',
    path: '/',
    script: `(async () => {
      ${prelude}
      bench.fill();
      await __m.waitFor(() => text('G4') === FINAL);
      await __m.settle();
    })()`,
  },
];
