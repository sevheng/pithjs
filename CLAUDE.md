# webFramwork

Two folders:
- `framework/`: Pith, a no-build framework (`pith/`), its tools (`tools/`), tests and `docs/errors.md`.
- `demo/`: an app built with Pith. **For any app work, follow `demo/AGENTS.md`**, and run commands from `demo/`.

Verify every change with `cd demo && npm run check` (it also runs the framework's tests).
It must print "All good" before you call the work done.
When changing `framework/pith/`, add or update a test in `framework/tests/index.html`
(browser) or `framework/tests/*.test.mjs` (Node) first.
Then rebuild its production copy with `node ../framework/tools/release.mjs` from `demo/` (check fails until you do).
