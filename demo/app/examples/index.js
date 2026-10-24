// Every feature example: shown at /features and /features/<name>. Each example is one file in this
// folder; its source on the page comes from sources.js (npm run examples writes it).
import signals from './signals.js';
import lists from './lists.js';
import selector from './selector.js';
import components from './components.js';
import errors from './errors.js';
import store from './store.js';
import resource from './resource.js';
import paginated from './paginated.js';
import forms from './forms.js';
import router from './router.js';
import dialogs from './dialogs.js';

/** @type {{ name: string, title: string, summary: string, api: string[], usedIn: [string, string][], view: () => unknown, app?: true }[]} */
export const examples = [
  { name: 'signals', title: 'Signals', view: signals, api: ['signal', 'computed'],
    summary: 'Values that update exactly the text that shows them, nothing else.', usedIn: [['/', 'the home counter']] },
  { name: 'lists', title: 'Lists and animation', view: lists, api: ['repeat', 'transition'],
    summary: 'Keyed lists that move rows instead of rebuilding them, with animated changes.', usedIn: [] },
  { name: 'selector', title: 'Selecting a row', view: selector, api: ['selector'],
    summary: 'Mark the selected item by touching 2 rows, not all of them.', usedIn: [] },
  { name: 'components', title: 'Components', view: components, api: ['define', 'provide', 'inject'],
    summary: 'Custom elements with props, slots and context.', usedIn: [] },
  { name: 'errors', title: 'Error boundaries', view: errors, api: ['define({ fallback })'],
    summary: 'A crashing component shows a fallback with "Try again"; the page keeps working.', usedIn: [] },
  { name: 'store', title: 'Shared state', view: store, api: ['createStore'],
    summary: 'Signals saved to localStorage and kept in step across tabs.', usedIn: [] },
  { name: 'resource', title: 'Loading data', view: resource, api: ['resource', 'fetchJSON'],
    summary: 'Loading, errors, refetch and cancelled stale requests, built in.', usedIn: [] },
  { name: 'paginated', title: 'Pages of data', view: paginated, api: ['paginated'],
    summary: 'Load a long list a page at a time, with "Load more".', usedIn: [] },
  { name: 'forms', title: 'Forms', view: forms, api: ['form', 'rules'],
    summary: 'Validation, accessible errors, submitting, and errors from the server.', usedIn: [] },
  { name: 'router', title: 'Routing', view: router, api: ['createRouter', 'router.query', 'router.setQuery'],
    summary: 'Lazy pages, :params, the ?query in signals, layouts and a guard.', usedIn: [] },
  { name: 'dialogs', title: 'Dialogs and toasts', view: dialogs, api: ['app/ui.js'], app: true,
    summary: 'App code on the native <dialog> and popover, not part of the framework.', usedIn: [] },
];

export const exampleByName = (name) => examples.find((e) => e.name === name);
