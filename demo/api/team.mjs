// GET /api/team?q=design&page=2 → { items, next } for the people whose name or role matches.
// Pages hold PAGE_SIZE people; `next` is the following page number, or null on the last page. Dev-only demo data.
// GET /api/team?id=3 → that person, or a 404 if there's no such id (the member page, /team/:id).

export const team = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineering lead' },
  { id: 2, name: 'Grace Hopper', role: 'Compiler engineer' },
  { id: 3, name: 'Dieter Rams', role: 'Product designer' },
  { id: 4, name: 'Susan Kare', role: 'Icon designer' },
  { id: 5, name: 'Margaret Hamilton', role: 'Software engineer' },
  { id: 6, name: 'Paul Rand', role: 'Brand designer' },
  { id: 7, name: 'Katherine Johnson', role: 'Data analyst' },
  { id: 8, name: 'Alan Kay', role: 'Research engineer' },
  { id: 9, name: 'Edsger Dijkstra', role: 'Systems engineer' },
  { id: 10, name: 'Barbara Liskov', role: 'Language designer' },
];

export const PAGE_SIZE = 4;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function GET({ query }) {
  await delay(250); // pretend the network is slow, so the loading states are visible
  if (query.id != null) {
    const person = team.find((p) => String(p.id) === query.id);
    return person ?? Response.json({ message: 'No such person' }, { status: 404 });
  }
  const q = String(query.q ?? '').trim().toLowerCase();
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const matches = team.filter((p) => `${p.name} ${p.role}`.toLowerCase().includes(q));
  const start = (page - 1) * PAGE_SIZE;
  return {
    items: matches.slice(start, start + PAGE_SIZE),
    next: start + PAGE_SIZE < matches.length ? page + 1 : null,
  };
}
