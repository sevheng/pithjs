// Correctness checks for the benchmark app: every implementation must do exactly the same thing.
import { flow } from 'pith/testing';

const rows = (app) => app.queryAll('tbody tr');
const labelOf = (tr) => tr.querySelector('.lbl').textContent;

flow('create, update, select, swap, remove, append, clear', async (app) => {
  await app.go('/');
  await app.click('#run');
  await app.waitFor(() => rows(app).length === 1000, 'Create 1,000 rows should make 1000 rows');
  const ids = rows(app).map((tr) => Number(tr.querySelector('.col-id').textContent));
  app.expect(ids.every((id, i) => i === 0 || id === ids[i - 1] + 1), 'ids should be consecutive');

  await app.click('#update');
  await app.waitFor(() => labelOf(rows(app)[0]).endsWith(' !!!') && labelOf(rows(app)[10]).endsWith(' !!!'), 'every 10th row should end with " !!!"');
  app.expect(!labelOf(rows(app)[1]).endsWith(' !!!'), 'row 2 should not change');

  rows(app)[4].querySelector('.lbl').click();
  await app.waitFor(() => rows(app)[4].classList.contains('selected'), 'clicking a label should select its row');
  app.expect(app.queryAll('tr.selected').length === 1, 'only one row should be selected');

  const [second, nearEnd] = [rows(app)[1], rows(app)[998]].map(labelOf);
  await app.click('#swaprows');
  await app.waitFor(() => labelOf(rows(app)[1]) === nearEnd && labelOf(rows(app)[998]) === second, 'rows 2 and 999 should swap');

  const removed = rows(app)[2].querySelector('.col-id').textContent;
  rows(app)[2].querySelector('.remove').click();
  await app.waitFor(() => rows(app).length === 999 && !rows(app).some((tr) => tr.querySelector('.col-id').textContent === removed), 'remove should delete that row');

  await app.click('#add');
  await app.waitFor(() => rows(app).length === 1999, 'append should add 1000 rows');
  await app.click('#clear');
  await app.waitFor(() => rows(app).length === 0, 'clear should remove every row');
  await app.click('#runlots');
  await app.waitFor(() => rows(app).length === 10000, 'Create 10,000 rows should make 10000 rows', );
});
