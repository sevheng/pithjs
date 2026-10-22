// Dev-mode warnings: on for localhost, off everywhere else so production stays quiet.
// Override by setting globalThis.MINI_DEV = true/false before mini is imported.
// Every warning and error has a code; framework/docs/errors.md explains each one and how to fix it.

const host = globalThis.location?.hostname ?? '';
export const DEV = globalThis.MINI_DEV ?? ['localhost', '127.0.0.1', '[::1]'].includes(host);

const seen = new Set();

const ref = (code) => `See framework/docs/errors.md#${code.toLowerCase()}`;

// Each distinct message is shown once, so a warning inside a list doesn't flood the console.
export function warn(code, message) {
  const text = `[mini ${code}] ${message} ${ref(code)}`;
  if (!DEV || seen.has(text)) return;
  seen.add(text);
  console.warn(text);
}

// Errors are thrown in every mode: they mean the output would be wrong.
export function error(code, message, Type = Error) {
  const err = new Type(`[mini ${code}] ${message} ${ref(code)}`);
  return Object.assign(err, { code });
}

export function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return `an object (${value.constructor?.name ?? 'Object'})`;
  if (typeof value === 'string') return `the string "${value.length > 20 ? value.slice(0, 20) + '…' : value}"`;
  return `${typeof value} ${String(value)}`;
}
