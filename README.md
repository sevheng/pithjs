# webFramwork

```
framework/   Pith: the framework, its tools (dev server, check, see, new), tests and docs
demo/        an app built with Pith: pages, components, a dev API, styles and user flows
```

Start here:

```sh
cd demo
npm install      # once: links Pith (../framework, as the pithjs package) and installs Vite
npm run dev      # → http://localhost:8000, reloads when you save
npm run check    # proves everything works: tests, user flows, every page, phone layout, types, 10 KB size budget, preloads
npm run build    # production build into dist/, every page prerendered to HTML
npm run preview  # serve dist/ locally
```

- Building the app: read [demo/AGENTS.md](demo/AGENTS.md)
- How the framework works: read [framework/README.md](framework/README.md)
- Error codes like `[pith W001]`: see [framework/docs/errors.md](framework/docs/errors.md)

Needs Node 24+ and Chrome/Chromium. Pith itself has no runtime dependencies.

A new project of your own: `node framework/tools/cli.mjs create ../my-app` (then `npm install` and `npm run check` there).
Changing the framework: [framework/CONTRIBUTING.md](framework/CONTRIBUTING.md).
