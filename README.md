# Pith

**The essential core of a web app.** A tiny framework built on the browser's own tech: signals, templates,
Web Components, a router, data loading and forms, in about 10 KB, with **no dependencies and no build step**.
Made to be easy for AI agents (and people) to get right: every project carries the rules, and one command checks
everything.

**[See the demo and the docs →](https://sevheng.github.io/pithjs/)** (built with Pith, including a chat, an inbox,
a trading screen, a spreadsheet and a shop)

> Pith is an experiment: its API may still change, and it hasn't been used in production yet.

## Start a project

Needs Node 24+ and Chrome or Chromium (for the checks and prerendering).

```sh
npx --package=https://github.com/sevheng/pithjs/releases/download/v0.1.1/pithjs-0.1.1.tgz pith create my-app
cd my-app
npm install
npm run dev      # → http://localhost:8000
npm run check    # tests, user flows, every page on a phone, accessibility, types: must print "All good"
npm run build    # production build into dist/, every page prerendered; put dist/ on any static host
```

Other versions: [Releases](https://github.com/sevheng/pithjs/releases). Without any tools, point an import map at
the one-file copy: `"pith": "https://cdn.jsdelivr.net/gh/sevheng/pithjs@v0.1.1/framework/pith/pith.min.js"`.

```js
import { define, html, signal, computed } from 'pith';

define('pith-counter', (props) => {
  const count = signal(Number(props.start.value));
  const double = computed(() => count.value * 2);
  return html`
    <p>${count}</p>
    <p>Double: ${double}</p>
    <button @click=${() => count.value++}>+</button>
  `;
}, { props: ['start'] });
```

## This repo

```
framework/   Pith: the framework (pith/), its tools (the pith command), tests, docs and the starter template
demo/        the demo site: Home, the docs, and the example apps (published to GitHub Pages)
compare/     the same apps in Pith, React and Vue, measured the same way (RESULTS.md)
```

- Building an app: [framework/AGENTS.md](framework/AGENTS.md) (every project gets a copy)
- The whole API: [framework/README.md](framework/README.md)
- Error codes like `[pith W001]`: [framework/docs/errors.md](framework/docs/errors.md)
- What's in each version: [framework/CHANGELOG.md](framework/CHANGELOG.md)

Working on Pith itself: `cd demo && npm install && npm run check` runs everything; see
[framework/CONTRIBUTING.md](framework/CONTRIBUTING.md). Releasing: bump `framework/package.json`'s version, add
its notes to the changelog, update the version in the install commands (this README, `framework/README.md`,
`demo/app/brand.js`; `npm run check` fails until they match), then `git tag v<version> && git push --tags`.

MIT license.
