// GET  /api/inbox                          → counts per folder { inbox (unread), starred, sent, archive, trash }
// GET  /api/inbox?folder=inbox&q=&page=1   → { items, next } (20 a page, newest first, no bodies); 404 for an unknown folder.
//      A search containing "/fail" answers 500, so the error view (with Try again) can be tried.
// GET  /api/inbox?id=12                    → the whole message, with wasUnread (it marks it read); 404 if it's gone
// POST /api/inbox { action: 'star', id, starred }       → { ok }
// POST /api/inbox { action: 'move', ids, to }           → { ok } (remembers where each came from, for undo)
// POST /api/inbox { action: 'undo', ids }               → { ok } (moves them back)
// POST /api/inbox { action: 'destroy', ids }            → { ok } (gone for good: only from Trash)
// POST /api/inbox { action: 'send', to, subject, body } → the sent message; 422 { errors: { field } } when invalid,
//      including any address at @blocked.test.
// "Starred" isn't a real folder: it's every starred message outside Trash.
// Dev-only demo data, kept in memory (so it stays changed while the dev server runs).

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

export const folders = ['inbox', 'starred', 'sent', 'archive', 'trash'];
const PAGE = 20;
const ME = { name: 'You', email: 'you@pith.dev' };

const people = {
  ada: { name: 'Ada Lovelace', email: 'ada@analytical.dev' },
  grace: { name: 'Grace Hopper', email: 'grace@navy.example' },
  linus: { name: 'Linus Park', email: 'linus@pith.dev' },
  mia: { name: 'Mia Chen', email: 'mia@studio.example' },
  sam: { name: 'Sam Okafor', email: 'sam@okafor.example' },
  noor: { name: 'Noor Haddad', email: 'noor@haddad.example' },
  billing: { name: 'Northwind Billing', email: 'billing@northwind.example' },
  github: { name: 'GitHub', email: 'notifications@github.example' },
  travel: { name: 'Skyline Travel', email: 'trips@skyline.example' },
  hr: { name: 'People Team', email: 'people@pith.dev' },
  news: { name: 'The Frontend Weekly', email: 'hello@frontendweekly.example' },
  bank: { name: 'Harbor Bank', email: 'alerts@harbor.example' },
};

// [from, subject, body paragraphs, hours ago, { read, starred }]
const INBOX = [
  ['ada', 'Benchmarks for the list rewrite', ['Hi,', 'I reran the list benchmark on the slow phone profile. Selecting a row is now 3x faster than before, and creating 1,000 rows went from 41 ms to 29 ms.', 'The numbers are in the sheet. Can you look before Thursday?', 'Ada'], 0.5, { starred: true }],
  ['billing', 'Your invoice for October is ready', ['Hello,', 'Your invoice INV-2048 for October is ready. The total is $48.00 and it will be charged to the card ending in 4242 on November 1.', 'You can download a PDF from your account page.', 'Northwind Billing'], 2],
  ['mia', 'New mark: final files', ['Hey!', 'The final files for the new mark are in the shared folder: SVG, PNG at 1x/2x/3x, and the favicon set. The dot stays 4px at 16px, as promised.', 'Let me know if anything looks off in dark mode.', 'Mia'], 3, { starred: true }],
  ['github', '[pith] Pull request #212: Faster keyed moves', ['linus requested your review on #212.', 'This change moves rows with insertBefore only when their order really changed, which saves about 20% on swaps.', 'View it on GitHub.'], 4],
  ['grace', 'Re: Docs review', ['Looks good overall. Two notes:', '1. The forms page should say that server errors clear when the field is edited.', '2. The router page needs an example of a redirect with params.', 'Otherwise ship it.', 'Grace'], 5],
  ['travel', 'Your trip to Lisbon is confirmed', ['Booking reference: SKY-7Q2LX', 'Flight TP 1347, Friday 08:40, seat 14A. Hotel Alfama Lofts, 3 nights.', 'Check in opens 24 hours before departure.'], 7, { read: true }],
  ['sam', 'Coffee next week?', ['Hi! I am in town next Tuesday and Wednesday. Coffee near the station? I would love to hear how the framework is going.', 'Sam'], 9],
  ['hr', 'Reminder: submit your time off by Friday', ['Hi team,', 'Please add any time off for December to the calendar by Friday, so we can plan coverage over the holidays.', 'Thanks, People Team'], 20, { read: true }],
  ['linus', 'Release notes draft', ['Here is the draft for 0.9. I kept it short: the headline is mutate(fn), then W017, then the smaller fixes.', 'Edit freely, it is a shared doc.', 'Linus'], 22, { read: true }],
  ['news', 'Issue 318: signals everywhere', ['This week: why every framework is moving to signals, a deep dive on view transitions, and a tiny router in 2 KB.', 'Read it on the web.'], 26, { read: true }],
  ['noor', 'Workshop slides', ['Thanks for the workshop yesterday! Could you share the slides? Several people asked about the part on forms and server validation.', 'Noor'], 28],
  ['bank', 'A new device signed in', ['A new device signed in to your account on Tuesday at 21:14 from Lisbon, Portugal.', 'If this was you, there is nothing to do. If not, change your password now.'], 30, { read: true }],
  ['ada', 'Lunch on Friday', ['Team lunch on Friday at noon, the new ramen place. I booked a table for eight.', 'Ada'], 46, { read: true }],
  ['github', '[pith] Issue #198 closed: Dialog loses focus on close', ['Closed by #205.', 'Focus now returns to the element that opened the dialog, even when that element was re-rendered.'], 50, { read: true }],
  ['mia', 'Color tokens for dark mode', ['I tuned --muted for dark mode: it was 4.3:1 on the surface color, now 4.6:1. The accent stays the same.', 'Screenshots attached in the doc.', 'Mia'], 52, { read: true }],
  ['billing', 'Payment received, thank you', ['We received your payment of $48.00 for September. Your receipt number is RCPT-9931.'], 70, { read: true }],
  ['grace', 'Conference talk accepted', ['Great news: your talk "A framework you can read in an afternoon" was accepted for the March conference.', 'We need a short bio and a photo by the end of the month.', 'Grace'], 74, { starred: true, read: true }],
  ['sam', 'Intro: Priya from the design systems team', ['Priya, meet the Pith folks. They are building a tiny framework and care a lot about design tokens.', 'I will let you two take it from here.', 'Sam'], 96, { read: true }],
  ['travel', 'Price drop on your saved route', ['Good news: flights from Berlin to Lisbon on your saved dates dropped to 89 EUR.'], 100, { read: true }],
  ['linus', 'CI is green again', ['The flaky flow was a timer that depended on the real clock. Fixed by letting the page decide how long to wait.', 'Linus'], 120, { read: true }],
  ['news', 'Issue 317: the case for no build step', ['This week: shipping straight from the editor, import maps in every browser, and when a bundler still helps.'], 170, { read: true }],
  ['hr', 'Welcome our new teammates', ['Please welcome Jonas and Elif, who join the platform team on Monday. Say hi in #general!'], 190, { read: true }],
  ['noor', 'Re: Accessibility audit', ['I went through the audit list. Everything passes except two icon buttons without labels on the settings page.', 'Noor'], 200, { read: true }],
  ['bank', 'Your monthly statement', ['Your statement for September is ready to view in online banking.'], 260, { read: true }],
  ['ada', 'Idea: a paginated selector', ['What if selector() worked over a Set, for multi-select? Then checking a box would only re-run that row.', 'Just a thought.', 'Ada'], 300, { read: true }],
  ['github', '[pith] Release 0.8.0 published', ['Release 0.8.0 is out: smaller router, form hints, and the new size budget check.'], 340, { read: true }],
  ['mia', 'Moodboard', ['A few references for the landing page: calm grays, one blue, big tight headlines. Nothing loud.', 'Mia'], 400, { read: true }],
  ['grace', 'Old notes from the planning meeting', ['Attached are the notes from planning. Main points: ship the inbox example, then the board, then the charts.'], 460, { read: true }],
  ['travel', 'Rate your stay in Porto', ['How was Casa do Rio? Leave a review and get 10% off your next booking.'], 520, { read: true }],
  ['sam', 'Book recommendation', ['You mentioned you wanted something about typography. "Thinking with Type" is the one.', 'Sam'], 600, { read: true }],
  ['billing', 'Your invoice for September is ready', ['Your invoice INV-1987 for September is ready. The total is $48.00.'], 720, { read: true }],
  ['linus', 'Old laptop', ['Do you still need the old test laptop? Otherwise I will wipe it and give it to the new intern.'], 800, { read: true }],
];

const SENT = [
  ['ada', 'Re: Benchmarks for the list rewrite', ['Thanks Ada, I will look tomorrow morning.'], 0.3],
  ['grace', 'Docs review', ['Grace, could you review the docs PR before lunch? It is mostly the forms and router pages.'], 6],
  ['sam', 'Re: Coffee next week?', ['Tuesday works! 10:00 at the station café?'], 8.5],
  ['noor', 'Re: Workshop slides', ['Here you go, the slides are attached. The forms part starts at slide 23.'], 27],
  ['mia', 'Logo feedback', ['Love the ring. Could we try the dot a little bigger at small sizes?'], 100],
  ['linus', 'Re: Old laptop', ['Wipe it, thanks!'], 790],
  ['hr', 'Time off', ['I will be off December 23 to January 2.'], 30],
  ['billing', 'Question about my invoice', ['Hi, is the price the same next year?'], 700],
];

const ARCHIVE = [
  ['ada', 'Q3 planning doc', ['The Q3 doc is final. Thanks everyone for the comments.'], 900],
  ['github', '[pith] Release 0.7.0 published', ['Release 0.7.0: layouts that stay mounted, and guards.'], 950],
  ['travel', 'Your trip to Porto', ['Booking reference: SKY-3M9QA. Have a great trip!'], 1000],
  ['bank', 'Card replaced', ['Your new card ending in 4242 has been activated.'], 1100],
  ['grace', 'Meetup photos', ['Photos from the meetup are up. You look great in all of them.'], 1150, { starred: true }],
  ['news', 'Issue 300: a look back', ['Three hundred issues! Here are the ten most read links of all time.'], 1200],
  ['hr', 'Benefits enrollment closes soon', ['Enrollment closes on the 15th. Pick your plan in the portal.'], 1300],
  ['mia', 'Icon set v1', ['Here is the first icon set: 24px grid, 2px stroke, round joins.'], 1350],
  ['linus', 'Server move done', ['All services are on the new machines. Ping me if anything is slow.'], 1400],
  ['sam', 'Thanks for the intro', ['Priya and I had a great call. Thanks for connecting us!'], 1500],
  ['billing', 'Your invoice for August is ready', ['Your invoice INV-1921 for August is ready. The total is $48.00.'], 1550],
  ['noor', 'Conference badge', ['Your speaker badge is ready to pick up at the front desk.'], 1600],
];

const TRASH = [
  ['news', 'Issue 316: CSS has layers now', ['Cascade layers, container queries, and :has() in every browser.'], 210],
  ['travel', 'Last chance: weekend deals', ['Weekend deals end tonight. Up to 30% off city breaks.'], 230],
  ['bank', 'Try our new savings account', ['Earn more with our new savings account. Terms apply.'], 330],
  ['github', '[pith] Issue #150 closed', ['Closed as completed.'], 1000],
  ['news', 'Issue 315: the year of web components', ['Custom elements are everywhere now. Here is how frameworks use them.'], 1250],
  ['billing', 'Update your billing details', ['Please check that your billing address is up to date.'], 1700],
];

let nextId = 1;
/** @type {any[]} */
const messages = [];
const add = (folder, rows) => {
  for (const [who, subject, body, hours, extra = {}] of rows) {
    const sent = folder === 'sent';
    messages.push({
      id: String(nextId++), folder, prev: null, subject, body,
      from: sent ? ME : people[who], to: [sent ? people[who] : ME],
      at: hoursAgo(hours), read: folder !== 'inbox' || extra.read || false, starred: extra.starred ?? false,
    });
  }
};
add('inbox', INBOX);
add('sent', SENT);
add('archive', ARCHIVE);
add('trash', TRASH);

const inFolder = (m, folder) => (folder === 'starred' ? m.starred && m.folder !== 'trash' : m.folder === folder);
const snippet = (m) => m.body.join(' ').slice(0, 140);
const summary = ({ body, prev, ...m }) => ({ ...m, snippet: snippet({ body }) });
const matches = (m, q) => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${m.from.name} ${m.from.email} ${m.to.map((p) => `${p.name} ${p.email}`).join(' ')} ${m.subject} ${m.body.join(' ')}`.toLowerCase();
  return words.every((w) => text.includes(w));
};
const byNewest = (a, b) => b.at.localeCompare(a.at);
const find = (ids) => messages.filter((m) => ids.includes(m.id));
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function GET({ query }) {
  if (query.id != null) {
    await delay(180);
    const m = messages.find((x) => x.id === query.id);
    if (!m) return Response.json({ message: 'This message is gone' }, { status: 404 });
    const wasUnread = !m.read;
    m.read = true;
    const { prev, ...rest } = m;
    return { ...rest, wasUnread };
  }
  if (query.folder == null) {
    await delay(150);
    const count = (f) => messages.filter((m) => inFolder(m, f)).length;
    return {
      inbox: messages.filter((m) => m.folder === 'inbox' && !m.read).length,
      starred: count('starred'), sent: count('sent'), archive: count('archive'), trash: count('trash'),
    };
  }
  await delay(300);
  if (!folders.includes(query.folder)) return Response.json({ message: 'No such folder' }, { status: 404 });
  const q = String(query.q ?? '').trim();
  if (q.includes('/fail')) return Response.json({ message: 'The server failed on purpose ("/fail")' }, { status: 500 });
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const all = messages.filter((m) => inFolder(m, query.folder) && (!q || matches(m, q))).sort(byNewest);
  const items = all.slice((page - 1) * PAGE, page * PAGE).map(summary);
  return { items, next: page * PAGE < all.length ? page + 1 : null, total: all.length };
}

export async function POST({ body }) {
  await delay(250);
  const action = body?.action;
  const ids = Array.isArray(body?.ids) ? body.ids.map(String) : [];

  if (action === 'star') {
    const m = messages.find((x) => x.id === String(body.id));
    if (!m) return Response.json({ message: 'This message is gone' }, { status: 404 });
    m.starred = !!body.starred;
    return { ok: true };
  }
  if (action === 'move') {
    if (!['inbox', 'archive', 'trash'].includes(body.to)) return Response.json({ message: `Can't move messages to "${body.to}"` }, { status: 422 });
    for (const m of find(ids)) if (m.folder !== body.to) Object.assign(m, { prev: m.folder, folder: body.to });
    return { ok: true };
  }
  if (action === 'undo') {
    for (const m of find(ids)) if (m.prev) Object.assign(m, { folder: m.prev, prev: null });
    return { ok: true };
  }
  if (action === 'destroy') {
    for (const m of find(ids)) if (m.folder === 'trash') messages.splice(messages.indexOf(m), 1);
    return { ok: true };
  }
  if (action === 'send') {
    await delay(250);
    const to = String(body.to ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const subject = String(body.subject ?? '').trim();
    const text = String(body.body ?? '').trim();
    /** @type {Record<string, string>} */
    const errors = {};
    if (!to.length) errors.to = 'Add at least one address';
    else if (to.some((a) => !isEmail(a))) errors.to = `"${to.find((a) => !isEmail(a))}" isn't an email address`;
    else if (to.some((a) => a.toLowerCase().endsWith('@blocked.test'))) errors.to = "blocked.test doesn't accept mail. Remove that address.";
    if (!subject) errors.subject = 'Add a subject';
    else if (subject.length > 200) errors.subject = 'Keep the subject under 200 characters';
    if (!text) errors.body = 'Write a message';
    if (Object.keys(errors).length) return Response.json({ message: 'Check the highlighted fields', errors }, { status: 422 });
    const m = {
      id: String(nextId++), folder: 'sent', prev: null, subject, body: text.split(/\n{2,}/),
      from: ME, to: to.map((email) => ({ name: email.split('@')[0], email })), at: new Date().toISOString(), read: true, starred: false,
    };
    messages.push(m);
    return summary(m);
  }
  return Response.json({ message: `Unknown action "${action}"` }, { status: 400 });
}
