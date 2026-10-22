// stateText(): the app's dev-mode state as text. Runs on a hand-made fake registry (see mini/dev.js).
// Fakes, kept minimal:
// - a signal is { peek() } (stateText never reads .value, so it never subscribes);
// - an element is { nodeType: 1, localName, children, shadowRoot? }: stateText walks #app's element tree
//   (into shadow roots) to find components in document order, so a host that isn't in the tree is
//   "disconnected" and skipped;
// - the window is { __mini, document: { getElementById } }.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateText } from './state.js';

const sig = (v) => ({ peek: () => v, get value() { throw new Error('stateText must use peek(), not .value'); } });
const el = (localName, children = []) => ({ nodeType: 1, localName, children });
const host = (tag, children, { props = {}, state = [] } = {}) => Object.assign(el(tag, children), { __miniState: { tag, props, state } });

function fakeWindow({ app = el('div'), components = [], pages = [], stores = [], router = null } = {}) {
  return {
    __mini: { components: new Set(components), pages, stores, router },
    document: { getElementById: (id) => (id === 'app' ? app : null) },
  };
}

const resource = ({ data, error = null, loading = false }) => ({ data: sig(data), error: sig(error), loading: sig(loading), status: sig('ready') });

test('no registry: says state is only recorded in dev mode', () => {
  assert.equal(stateText({}), '(state is only recorded in dev mode)');
  assert.equal(stateText(null), '(state is only recorded in dev mode)');
});

test('route, stores, page and components, in the documented format', () => {
  const card = host('info-card', [], { props: { title: sig('Errors stay contained') } });
  const list = host('todo-list', [el('ul'), el('section', [card])], {
    state: [['draft', 'signal', sig('')], ['visible', 'computed', sig([{ id: 1 }, { id: 2 }])]],
  });
  const people = { items: sig([1, 2, 3, 4]), hasMore: sig(true), loading: sig(false), loadingMore: sig(false), error: sig(null) };
  const win = fakeWindow({
    app: el('div', [el('main', [list])]),
    components: [card, list],
    router: { path: sig('/team'), search: sig('?q=ada') },
    stores: [{ name: 'mini-todos', signals: { todos: sig([{ id: 1, text: 'a', done: false }, {}, {}]), filter: sig('all') } }],
    pages: [{ path: '/team', name: 'TeamPage', state: [['query', 'signal', sig('ada')], ['people', 'paginated', people]]}],
  });
  assert.equal(stateText(win), [
    'route /team?q=ada',
    'store "mini-todos": todos = 3 items [{ id, text, done }, …], filter = "all"',
    'page /team (TeamPage): query = "ada", people = paginated · 4 items · hasMore true',
    '<todo-list>: draft = "", visible = computed · 2 items [{ id }, …]',
    '  <info-card> props: title = "Errors stay contained"',
  ].join('\n'));
});

test('previews: primitives, strings cut, arrays, objects, DOM nodes, functions', () => {
  const values = [
    ['n', 3], ['b', false], ['z', null], ['u', undefined], ['long', 'x'.repeat(50)],
    ['empty', []], ['one', ['a']], ['obj', { a: 1, b: 2 }], ['node', el('section')], ['f', () => {}],
    ['inner', { s: sig(1) }],
  ];
  const win = fakeWindow({ pages: [{ path: '/', name: 'Home', state: values.map(([n, v]) => [n, 'signal', sig(v)]) }] });
  assert.equal(stateText(win),
    `page / (Home): n = 3, b = false, z = null, u = undefined, long = "${'x'.repeat(40)}…", empty = 0 items, ` +
    'one = 1 item ["a"], obj = { a, b }, node = <section>, f = fn, inner = { s }');
});

test('previews: resource, paginated and form', () => {
  const fields = { email: sig('a@b'), name: sig('') };
  const form = (extra = {}) => ({ fields, submitting: sig(false), submitError: sig(null), error: () => null, ...extra });
  const state = [
    ['a', 'resource', resource({ data: undefined, loading: true })],
    ['b', 'resource', resource({ data: undefined, error: new Error('Server down') })],
    ['c', 'resource', resource({ data: { id: 1, name: 'x' } })],
    ['d', 'paginated', { items: sig([]), hasMore: sig(false), loading: sig(true), loadingMore: sig(false), error: sig(null) }],
    ['e', 'paginated', { items: sig([1]), hasMore: sig(true), loading: sig(false), loadingMore: sig(false), error: sig({ message: 'nope' }) }],
    ['f', 'form', form()],
    ['g', 'form', form({ submitting: sig(true), error: (n) => (n === 'email' ? 'Enter a valid email address' : null) })],
  ];
  const lines = stateText(fakeWindow({ pages: [{ path: '/p', name: 'P', state }] })).split(': ').slice(1).join(': ').split(/, (?=[a-g] = )/);
  assert.deepEqual(lines, [
    'a = resource · loading',
    'b = resource · error: Server down',
    'c = resource · { id, name }',
    'd = paginated · 0 items · hasMore false · loading',
    'e = paginated · 1 item · hasMore true · error: nope',
    'f = form { email: "a@b", name: "" }',
    'g = form { email: "a@b", name: "" } · errors { email: "Enter a valid email address" } · submitting',
  ]);
});

test('a value that throws when read shows ?, and the rest still prints', () => {
  const bad = { peek() { throw new Error('boom'); } };
  const sneaky = sig({ get message() { throw new Error('boom'); } });
  const win = fakeWindow({ pages: [{ path: '/', name: 'Home', state: [['x', 'signal', bad], ['y', 'resource', { data: sig(1), error: sneaky, loading: sig(false) }], ['z', 'signal', sig(1)]] }] });
  assert.equal(stateText(win), 'page / (Home): x = ?, y = ?, z = 1');
});

test('components: document order, nesting depth (through shadow roots), disconnected and outside #app skipped', () => {
  const inner = host('x-inner', []);
  const shadowed = host('x-shadow', []);
  const outer = host('x-outer', [el('div', [inner])]);
  outer.shadowRoot = { children: [el('div', [shadowed])] };
  const second = host('x-second', []);
  const gone = host('x-gone', []);
  const outside = host('x-outside', []);
  const win = fakeWindow({ app: el('div', [outer, second]), components: [second, gone, inner, outside, outer, shadowed] });
  assert.equal(stateText(win), ['<x-outer>', '  <x-shadow>', '  <x-inner>', '<x-second>'].join('\n'));
});

test('long output is capped, ending with how many components were left out', () => {
  const hosts = Array.from({ length: 100 }, (_, i) => host(`x-item`, [], { state: [['i', 'signal', sig(i)]] }));
  const win = fakeWindow({ app: el('div', hosts), components: hosts, router: { path: sig('/'), search: sig('') } });
  const lines = stateText(win).split('\n');
  assert.equal(lines.length, 60);
  assert.equal(lines[0], 'route /');
  assert.equal(lines[1], '<x-item>: i = 0');
  assert.equal(lines.at(-1), '…42 more components');
});

test('an empty registry says so', () => {
  assert.equal(stateText(fakeWindow()), '(no pages, stores or components recorded)');
});

test('a shared layout prints as "layout", before its page', () => {
  const pages = [
    { path: '/settings/profile', name: 'SettingsLayout', layout: true, state: [['displayName', 'signal', sig('Ann')]] },
    { path: '/settings/profile', name: 'ProfilePage', state: [] },
  ];
  const text = stateText(fakeWindow({ pages }));
  assert.match(text, /^layout SettingsLayout: displayName = "Ann"\npage \/settings\/profile \(ProfilePage\)$/m);
});
