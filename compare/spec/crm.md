# Medium app: mini CRM

A customer admin with 6 routes. Every implementation must match this text exactly, so the same
user flows (`flows/crm.js`) test all of them. Uses `/styles.css` (shared) and the shared API.
Each route's page is **lazy-loaded** (its code downloads on first visit), the idiomatic way for
each framework. `document.title` is `"{Page title} · CRM"`.

## API (shared, `shared/api.mjs`, ~100 ms latency)
| Request | Reply |
|---|---|
| `GET /api/stats` | `{ total, active, leads, churned, revenue }` |
| `GET /api/customers?q=&status=` | `[{ id, name, email, company, status, revenue }]`, sorted by name. `q` matches name/email/company, `status` is `all`, `active`, `lead` or `churned` |
| `GET /api/customers/:id` | the customer `{ id, name, email, company, phone, status, revenue, notes }`, or 404 `{ message }` |
| `POST /api/customers` | 201 customer; or 422 `{ message, errors: { field: message } }` |
| `PUT /api/customers/:id` | 200 customer; or 422 like above; or 404 |
| `DELETE /api/customers/:id` | 204 |

Server validation: name required (≥ 2 chars), valid email, email unique
(`"A customer with this email already exists"`), status one of active/lead/churned.

## Layout (every route)
```
<header class="site-header">
  <a class="brand" href="/">CRM</a>
  <nav aria-label="Main"><ul class="nav-links">
    <li><a class="nav-link" href="/">Dashboard</a>            aria-current="page" on the current one
    <li><a class="nav-link" href="/customers">Customers</a>   (current for /customers and /customers/{id}…)
    <li><a class="nav-link" href="/customers/new">New customer</a>   (current only for /customers/new)
<main class="page"> …route… </main>
```
While a route's page or data loads for the first time: `<p class="loading" role="status">Loading…</p>`.
When a request fails: `<div class="load-error" role="alert"><p>Couldn't load this. {message}</p>`
with `<button class="btn" type="button">Try again</button>`.

## Routes

### `/` Dashboard (title "Dashboard")
`<h1>Dashboard</h1>`, then `<div class="grid stats">` with 4 cards from `/api/stats`:
`<div class="card stat"><span class="stat-value">{value}</span><span class="stat-label">{label}</span></div>`
labels in order: `Customers`, `Active`, `Leads`, `Revenue` (revenue formatted `$12,345`).

### `/customers` Customer list (title "Customers")
```
<h1>Customers</h1>
<div class="toolbar">
  <label class="sr-only" for="search">Search customers</label>
  <input id="search" class="input" type="search" placeholder="Search by name, email or company">
  <label class="sr-only" for="status">Status</label>
  <select id="status" class="input">  options: all "All statuses", active "Active", lead "Lead", churned "Churned"
  <a class="btn primary" href="/customers/new">New customer</a>
```
Every change of search or status refetches from the server (cancel or ignore the older request).
Old results stay on screen while new ones load. Then either `<p class="empty">No customers match.</p>` or:
```
<table class="table">
  <thead><tr><th>Name</th><th>Company</th><th>Status</th><th>Revenue</th></tr></thead>
  <tbody> per customer:
    <tr><td><a href="/customers/{id}">{name}</a></td><td>{company}</td>
        <td><span class="badge badge-{status}">{Status}</span></td><td>{$revenue}</td></tr>
```
Status labels: `Active`, `Lead`, `Churned`. Below the table: `<p class="muted">{n} customer(s)</p>` ("1 customer", "3 customers").

### `/customers/:id` Detail (title "Customer")
`<h1>{name}</h1>`, then `<dl class="card details">` with `<dt>`/`<dd>` pairs:
`Email`, `Company`, `Phone`, `Status` (label), `Revenue` ($), `Notes` (empty values show `—`).
Actions `<div class="row">`: `<a class="btn" href="/customers/{id}/edit">Edit</a>` and
`<button class="btn danger" type="button">Delete</button>`. Clicking Delete changes that button's
text to `Confirm delete` (a second click deletes, then navigates to `/customers`), and shows
`<button class="btn ghost" type="button">Cancel</button>` which restores it.
Unknown id: `<h1>Customer not found</h1>` and `<a href="/customers">Back to customers</a>`.

### `/customers/new` and `/customers/:id/edit` Form (titles "New customer" / "Edit customer")
`<h1>New customer</h1>` or `<h1>Edit {name}</h1>` (edit loads the customer first and fills the form).
```
<form class="card form" novalidate>
  fields, each: <div class="field"><label class="field-label" for="{id}">{Label}</label>
                <control id="{id}" name="{name}" class="input" aria-invalid="true" when showing an error
                         aria-describedby="{error id}">
                <p class="field-error" id="{error id}" role="alert">{error or empty}</p></div>
                (any unique ids, as long as the label and the error are linked to the control)
    name     "Name"     text      required, min 2   messages: "This field is required", "Use at least 2 characters"
    email    "Email"    email     required, email   "Enter a valid email address"
    company  "Company"  text
    phone    "Phone"    tel
    status   "Status"   select    lead "Lead" (default), active "Active", churned "Churned"
    notes    "Notes"    textarea (rows 4)
  <p class="form-error" role="alert">Couldn't save. {message}</p>   only for non-field errors
  <div class="row">
    <button class="btn primary" type="submit">Save</button>   disabled + text "Saving…" while saving
    <a class="btn ghost" href="{/customers or /customers/{id}}">Cancel</a>
```
- Errors show after a field loses focus, or for all fields after a submit attempt.
- Submit with errors: don't send; focus the first invalid field.
- 422 from the server: show each `errors[field]` under its field and focus the first one;
  editing a field clears its server error.
- Success: navigate to `/customers/{id}`.

### Anything else (title "Not found")
`<h1>Page not found</h1>` and `<a class="btn primary" href="/">Go to dashboard</a>`.
