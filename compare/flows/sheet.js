// The Spreadsheet's user flows: every implementation (sheet/pith, sheet/react, sheet/vue) must pass them all.
// Cells are found by their ids (#cell-B2), the same in all three (spec/sheet.md).
import { flow } from 'pith/testing';
import { finalBalance } from '/shared/sheet/demo-data.js';

const ROW_H = 32;
const cellText = (app, id) => app.query(`#cell-${id}`)?.textContent.trim() ?? null;
const selected = (app) => app.query('.sheet-name')?.textContent.trim();
/** Click a cell, type into the formula bar, and press Enter. */
const enter = async (app, id, text) => {
  app.query(`#cell-${id}`).click();
  await app.waitFor(() => selected(app) === id, `${id} should be the selected cell`);
  await app.type('Cell contents', text);
  await app.pressEnter();
};
/** Scroll the grid to a row, and say so (a headless browser that doesn't draw may never send the scroll event). */
const scrollTo = (app, row) => {
  const box = app.query('.sheet-scroll');
  box.scrollTop = row * ROW_H;
  box.dispatchEvent(new Event('scroll'));
};

flow('typing a number and a formula updates the cell that depends on it', async (app) => {
  await app.go('/');
  await enter(app, 'A1', '5');
  await app.waitFor(() => cellText(app, 'A1') === '5', 'A1 shows 5');
  await app.waitFor(() => selected(app) === 'A2', 'Enter moves down to A2');
  await enter(app, 'B1', '=A1*2');
  await app.waitFor(() => cellText(app, 'B1') === '10', 'B1 = A1 × 2 = 10');
  await enter(app, 'A1', '7');
  await app.waitFor(() => cellText(app, 'B1') === '14', 'B1 follows A1: 14');
  await enter(app, 'C1', 'Rent');
  await app.waitFor(() => cellText(app, 'C1') === 'Rent', 'text shows as typed');
  app.query('#cell-B1').click();
  await app.waitFor(() => app.query('#sheet-input').value === '=A1*2', 'the formula bar shows what is typed in B1');
});

flow('circular references show #CYCLE!, and division by zero #DIV/0!', async (app) => {
  await app.go('/');
  await enter(app, 'A1', '=B1+1');
  await enter(app, 'B1', '=A1');
  await app.waitFor(() => cellText(app, 'A1') === '#CYCLE!' && cellText(app, 'B1') === '#CYCLE!', 'both cells on the circle show #CYCLE!');
  app.expect(app.query('#cell-A1').classList.contains('err'), 'an error has the err class');
  await enter(app, 'B1', '4');
  await app.waitFor(() => cellText(app, 'A1') === '5', 'breaking the circle gives A1 a value again');
  await enter(app, 'C1', '=1/0');
  await app.waitFor(() => cellText(app, 'C1') === '#DIV/0!', '#DIV/0!');
  await enter(app, 'C2', '=FOO(1)');
  await app.waitFor(() => cellText(app, 'C2') === '#NAME?', '#NAME?');
});

flow('Fill demo data, then Edit A1, gives the expected final balance', async (app) => {
  await app.go('/');
  app.expect(app.query('#sum-G4').textContent.trim() === '—', 'the summary is empty at first');
  await app.click('Fill demo data');
  const final = finalBalance(2500);
  await app.waitFor(() => cellText(app, 'G4') === String(final), `the final balance (G4 = D1000) is ${final}`);
  app.expect(app.query('#sum-G4').textContent.trim() === String(final), 'the summary shows it too');
  app.expect(cellText(app, 'F4') === 'Final balance' && cellText(app, 'A1') === '2500', 'the budget is in');
  await app.click('Edit A1');
  await app.waitFor(() => cellText(app, 'G4') === String(final + 100), `the final balance moves by 100: ${final} → ${cellText(app, 'G4')}`);
  app.expect(cellText(app, 'A1') === '2600', 'A1 went up by 100');
  scrollTo(app, 990);
  await app.waitFor(() => cellText(app, 'D1000') === String(final + 100), 'D1000, at the end of the chain, has the new balance');
});

flow('scrolling to row 900 shows row 900, and only the rows in view are drawn', async (app) => {
  await app.go('/');
  const drawn = app.queryAll('.sheet-body [role="row"]').length;
  app.expect(drawn > 10 && drawn < 80, `only the rows in view are drawn, got ${drawn}`);
  scrollTo(app, 899);
  await app.waitFor(() => app.query('#cell-A900') && app.query('#cell-Z900'), 'row 900 is drawn after scrolling to it');
  await app.waitFor(() => !app.query('#cell-A1'), 'row 1 is no longer drawn');
  await enter(app, 'B900', '42');
  await app.waitFor(() => cellText(app, 'B900') === '42', 'B900 can be edited there');
});

flow('Clear empties the sheet', async (app) => {
  await app.go('/');
  await app.click('Fill demo data');
  await app.waitFor(() => cellText(app, 'A1') === '2500', 'the budget is in');
  await app.click('Clear');
  await app.waitFor(() => ['A1', 'B1', 'D1', 'G4', 'D10'].every((id) => cellText(app, id) === ''), 'every cell is empty');
  app.expect(app.query('#sum-G4').textContent.trim() === '—', 'the summary is empty again');
  await enter(app, 'A1', '1');
  await app.waitFor(() => cellText(app, 'A1') === '1', 'the sheet still works after Clear');
});
