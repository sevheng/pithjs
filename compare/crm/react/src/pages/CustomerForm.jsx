import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { fetchJSON } from '../lib/api.js';

const EMPTY = { name: '', email: '', company: '', phone: '', status: 'lead', notes: '' };
const FIELDS = Object.keys(EMPTY);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RULES = {
  name: (v) => (!v.trim() ? 'This field is required' : v.trim().length < 2 ? 'Use at least 2 characters' : null),
  email: (v) => (!v.trim() ? 'This field is required' : !EMAIL.test(v.trim()) ? 'Enter a valid email address' : null),
};

function Field({ id, label, error, children }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      {children}
      <p className="field-error" id={`${id}-error`} role="alert">{error}</p>
    </div>
  );
}

/** The create/edit form. Pass the customer to edit, or nothing to create one. */
export default function CustomerForm({ customer }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(() =>
    customer ? Object.fromEntries(FIELDS.map((f) => [f, customer[f] ?? ''])) : EMPTY
  );
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const refs = useRef({});

  const errorOf = (name) => serverErrors[name] ?? RULES[name]?.(values[name]) ?? null;
  const shown = (name) => (touched[name] || attempted ? errorOf(name) : null);

  // Props shared by every control: value, change/blur handlers, ids and aria wiring.
  const control = (name) => ({
    id: `f-${name}`,
    name,
    className: 'input',
    value: values[name],
    ref: (el) => (refs.current[name] = el),
    onChange: (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      if (serverErrors[name]) setServerErrors((s) => ({ ...s, [name]: undefined }));
    },
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    'aria-invalid': shown(name) ? 'true' : undefined,
    'aria-describedby': `f-${name}-error`,
  });

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setAttempted(true);
    setSubmitError(null);
    setServerErrors({});
    const firstInvalid = FIELDS.find((n) => RULES[n]?.(values[n]));
    if (firstInvalid) {
      refs.current[firstInvalid]?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const saved = await fetchJSON(customer ? `/api/customers/${customer.id}` : '/api/customers', {
        method: customer ? 'PUT' : 'POST',
        json: values,
      });
      navigate(`/customers/${saved.id}`);
    } catch (err) {
      const fieldErrors = err?.body?.errors;
      if (fieldErrors) {
        setServerErrors(fieldErrors);
        refs.current[FIELDS.find((n) => fieldErrors[n])]?.focus();
      } else {
        setSubmitError(err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card form" noValidate onSubmit={submit}>
      <Field id="f-name" label="Name" error={shown('name')}><input {...control('name')} autoComplete="name" /></Field>
      <Field id="f-email" label="Email" error={shown('email')}><input {...control('email')} type="email" autoComplete="email" /></Field>
      <Field id="f-company" label="Company" error={shown('company')}><input {...control('company')} /></Field>
      <Field id="f-phone" label="Phone" error={shown('phone')}><input {...control('phone')} type="tel" /></Field>
      <Field id="f-status" label="Status" error={shown('status')}>
        <select {...control('status')}>
          <option value="lead">Lead</option>
          <option value="active">Active</option>
          <option value="churned">Churned</option>
        </select>
      </Field>
      <Field id="f-notes" label="Notes" error={shown('notes')}><textarea {...control('notes')} rows={4} /></Field>
      {submitError && <p className="form-error" role="alert">Couldn't save. {submitError.message}</p>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
        <Link className="btn ghost" to={customer ? `/customers/${customer.id}` : '/customers'}>Cancel</Link>
      </div>
    </form>
  );
}
