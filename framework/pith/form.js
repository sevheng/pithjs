// Forms: values, validation, touched state, submitting, and server-side field errors.
// Field helpers render a label, the control and its error, wired for accessibility.

import { signal, computed, batch } from './signal.js';
import { html } from './html.js';
import { DEV, warn, recording, record, silently } from './dev.js';

/**
 * @typedef {(value: any, values: Record<string, any>) => string | null | undefined} Rule
 *   returns an error message, or nothing when the value is fine
 */

/**
 * @typedef {string | (() => string)} Hint
 *   help text under a field, linked with aria-describedby. A function makes it live,
 *   e.g. a character counter: hint: () => `${f.fields.notes.value.length}/200`
 */

const isEmpty = (v) => v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0);

/** Built-in validation rules. Each takes an optional custom message. Empty values pass every rule except `required`. */
export const rules = {
  /** @param {string} [message] @returns {Rule} */
  required: (message = 'This field is required') => (v) => (isEmpty(v) ? message : null),
  /** @param {number} n @param {string} [message] @returns {Rule} */
  minLength: (n, message = `Use at least ${n} characters`) => (v) => (!isEmpty(v) && String(v).trim().length < n ? message : null),
  /** @param {number} n @param {string} [message] @returns {Rule} */
  maxLength: (n, message = `Use at most ${n} characters`) => (v) => (!isEmpty(v) && String(v).length > n ? message : null),
  /** @param {string} [message] @returns {Rule} */
  email: (message = 'Enter a valid email address') => (v) => (!isEmpty(v) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()) ? message : null),
  /** @param {RegExp} re @param {string} message @returns {Rule} */
  pattern: (re, message) => (v) => (!isEmpty(v) && !re.test(String(v)) ? message : null),
  /** @param {number} n @param {string} [message] @returns {Rule} */
  min: (n, message = `Must be at least ${n}`) => (v) => (!isEmpty(v) && Number(v) < n ? message : null),
  /** @param {number} n @param {string} [message] @returns {Rule} */
  max: (n, message = `Must be at most ${n}`) => (v) => (!isEmpty(v) && Number(v) > n ? message : null),
  /** Must equal another field, e.g. confirm password. @param {string} field @param {string} [message] @returns {Rule} */
  sameAs: (field, message = "This doesn't match") => (v, values) => (v !== values[field] ? message : null),
};

let formCount = 0;

/**
 * Create a form.
 * - Errors show after a field is left (blur) or after a submit attempt, not while typing the first time.
 * - On submit with errors, focus moves to the first invalid field and onSubmit is not called.
 * - If onSubmit throws an error whose `body.errors` is { field: message } (e.g. HttpError from fetchJSON),
 *   those messages show under the matching fields. Any other error goes to `submitError`.
 * @template {Record<string, any>} V
 * @param {{
 *   initial: V,
 *   validate?: { [K in keyof V]?: Rule | Rule[] },
 *   onSubmit?: (values: V) => unknown | Promise<unknown>,
 * }} options
 */
export function form({ initial, validate = {}, onSubmit }) {
  if (DEV && recording()) return record('form', silently(() => form({ initial, validate, onSubmit })));
  const id = `form${++formCount}`;
  const names = /** @type {(keyof V & string)[]} */ (Object.keys(initial));
  if (DEV) for (const key of Object.keys(validate)) {
    if (!names.includes(key)) warn('W015', `form(): validate.${key} has no field in initial. Add ${key} to initial, or fix the name.`);
  }

  /** @type {{ [K in keyof V]: import('./signal.js').Signal<V[K]> }} */
  const fields = /** @type {any} */ ({});
  /** @type {Record<string, import('./signal.js').Signal<boolean>>} */
  const touched = {};
  for (const name of names) {
    fields[name] = signal(initial[name]);
    touched[name] = signal(false);
  }
  const serverErrors = signal(/** @type {Record<string, string>} */ ({}));
  const attempted = signal(false);
  const submitting = signal(false);
  const submitError = signal(/** @type {any} */ (null));

  const values = () => /** @type {V} */ (Object.fromEntries(names.map((n) => [n, fields[n].value])));

  /** @type {Record<string, import('./signal.js').ReadonlySignal<string | null>>} */
  const errors = {};
  for (const name of names) {
    errors[name] = computed(() => {
      const server = serverErrors.value[name];
      if (server) return server;
      const list = validate[name];
      const ruleList = Array.isArray(list) ? list : list ? [list] : [];
      const all = values();
      for (const rule of ruleList) {
        const message = rule(all[name], all);
        if (message) return message;
      }
      return null;
    });
  }

  const known = (name) => {
    if (fields[name]) return true;
    DEV && warn('W016', `form(): there is no field "${name}". Add it to initial: { ${name}: '' }.`);
    return false;
  };
  const fieldId = (name) => `${id}-${name}`;
  const focusField = (name) => /** @type {HTMLElement | null} */ (document.getElementById(fieldId(name)))?.focus();

  /** The error to display for a field right now (null until it's touched or a submit was tried). */
  const shownError = (name) => (touched[name].value || attempted.value ? errors[name].value : null);

  /**
   * Set a field's value (clears that field's server error).
   * @template {keyof V & string} K
   * @param {K} name
   * @param {V[K]} value
   */
  function set(name, value) {
    batch(() => {
      fields[name].value = value;
      if (serverErrors.peek()[name]) serverErrors.value = { ...serverErrors.peek(), [name]: undefined };
    });
  }

  /** Submit handler: use as <form @submit=${myForm.submit} novalidate>. */
  async function submit(event) {
    event?.preventDefault?.();
    if (submitting.peek()) return;
    batch(() => {
      attempted.value = true;
      submitError.value = null;
      serverErrors.value = {};
    });
    const firstInvalid = names.find((n) => errors[n].peek());
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }
    submitting.value = true;
    try {
      await onSubmit?.(values());
    } catch (err) {
      const fieldErrors = err?.body?.errors;
      if (fieldErrors && typeof fieldErrors === 'object' && names.some((n) => fieldErrors[n])) {
        serverErrors.value = fieldErrors;
        const first = names.find((n) => fieldErrors[n]);
        if (first) focusField(first);
      } else {
        submitError.value = err;
      }
    } finally {
      submitting.value = false;
    }
  }

  function reset() {
    batch(() => {
      for (const name of names) {
        fields[name].value = initial[name];
        touched[name].value = false;
      }
      attempted.value = false;
      serverErrors.value = {};
      submitError.value = null;
    });
  }

  // Shared pieces of every field: ids, aria wiring, label, hint and error.
  function parts(name, hint) {
    const id = fieldId(name);
    const describedBy = [hint ? `${id}-hint` : '', `${id}-error`].filter(Boolean).join(' ');
    return {
      id,
      describedBy,
      invalid: () => (shownError(name) ? 'true' : null),
      blur: () => { touched[name].value = true; },
      // The field around a control: its label (null: the control brings its own), the hint and the error.
      field: (label, control) => html`<div class="field">${label == null ? null : html`<label class="field-label" for=${id}>${label}</label>`}${control}${
        hint ? html`<p class="field-hint" id=${`${id}-hint`}>${hint}</p>` : null}<p class="field-error" id=${`${id}-error`} role="alert">${() => shownError(name)}</p></div>`,
    };
  }

  return {
    /** Each field's value as a signal: myForm.fields.email.value */
    fields,
    /** Current values as a plain object. */
    values,
    /**
     * The error shown for a field (null if none or not shown yet). Reactive: use as ${() => myForm.error('email')}.
     * @param {keyof V & string} name
     */
    error: (name) => shownError(name),
    /** True when every field passes validation. */
    valid: computed(() => names.every((n) => !errors[n].value)),
    /** True while onSubmit is running. Use for ?disabled on the submit button. */
    submitting: /** @type {import('./signal.js').ReadonlySignal<boolean>} */ (submitting),
    /** An error from onSubmit that isn't about a specific field (e.g. network down), else null. */
    submitError: /** @type {import('./signal.js').ReadonlySignal<any>} */ (submitError),
    set,
    submit,
    reset,
    /**
     * Show errors on fields yourself, e.g. { email: 'Already registered' }.
     * @param {Partial<Record<keyof V & string, string>>} errs
     */
    setErrors(errs) {
      serverErrors.value = /** @type {Record<string, string>} */ (errs);
    },

    /**
     * A labeled text input with its error. type: text, email, password, number, tel, url, search, date...
     * @param {keyof V & string} name
     * @param {{ label: string, type?: string, placeholder?: string, autocomplete?: string, hint?: Hint }} options
     */
    input(name, { label, type = 'text', placeholder, autocomplete, hint }) {
      if (!known(name)) return null;
      const p = parts(name, hint);
      return p.field(label, html`<input class="input" id=${p.id} name=${name} type=${type} placeholder=${placeholder ?? null}
        autocomplete=${autocomplete ?? null} .value=${() => fields[name].value ?? ''} @input=${(e) => set(name, e.target.value)}
        @blur=${p.blur} aria-invalid=${p.invalid} aria-describedby=${p.describedBy}>`);
    },

    /**
     * A labeled multi-line text box with its error.
     * @param {keyof V & string} name
     * @param {{ label: string, rows?: number, placeholder?: string, hint?: Hint }} options
     */
    textarea(name, { label, rows = 4, placeholder, hint }) {
      if (!known(name)) return null;
      const p = parts(name, hint);
      return p.field(label, html`<textarea class="input" id=${p.id} name=${name} rows=${rows} placeholder=${placeholder ?? null}
        .value=${() => fields[name].value ?? ''} @input=${(e) => set(name, e.target.value)}
        @blur=${p.blur} aria-invalid=${p.invalid} aria-describedby=${p.describedBy}></textarea>`);
    },

    /**
     * A labeled dropdown. options: ['a', 'b'] or [['value', 'Label'], ...].
     * @param {keyof V & string} name
     * @param {{ label: string, options: (string | [string, string])[], hint?: Hint }} options
     */
    select(name, { label, options, hint }) {
      if (!known(name)) return null;
      const p = parts(name, hint);
      const pairs = options.map((o) => (Array.isArray(o) ? o : [o, o]));
      return p.field(label, html`<select class="input" id=${p.id} name=${name} @change=${(e) => set(name, e.target.value)}
        @blur=${p.blur} aria-invalid=${p.invalid} aria-describedby=${p.describedBy}>${pairs.map(([value, text]) =>
          html`<option value=${value} ?selected=${() => fields[name].value === value}>${text}</option>`)}</select>`);
    },

    /**
     * A checkbox with its label to the right, and its error. The value is true/false.
     * @param {keyof V & string} name
     * @param {{ label: string, hint?: Hint }} options
     */
    checkbox(name, { label, hint }) {
      if (!known(name)) return null;
      const p = parts(name, hint);
      return p.field(null, html`<label class="field-check"><input type="checkbox" class="check" id=${p.id} name=${name}
        .checked=${() => !!fields[name].value} @change=${(e) => { set(name, e.target.checked); touched[name].value = true; }}
        aria-invalid=${p.invalid} aria-describedby=${p.describedBy}> <span>${label}</span></label>`);
    },
  };
}
