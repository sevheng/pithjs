// POST /api/contact → validates on the server too (never trust the browser) and stores the message.
// Field problems come back as 422 { message, errors: { field: message } }, which form() shows per field.

const messages = [];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function POST({ body }) {
  await delay(250);
  const errors = {};
  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim();
  const message = String(body?.message ?? '').trim();

  if (!name) errors.name = 'Please tell us your name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
  else if (email.endsWith('@blocked.test')) errors.email = 'This address is blocked. Please use another one.';
  if (message.length < 10) errors.message = 'Use at least 10 characters';

  if (Object.keys(errors).length) {
    return Response.json({ message: 'Please fix the highlighted fields', errors }, { status: 422 });
  }
  messages.push({ name, email, topic: body.topic, message, at: new Date().toISOString() });
  return { ok: true, id: messages.length };
}
