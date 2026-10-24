#!/usr/bin/env node
// The `pith` command (package.json "bin"): one entry point for every tool, run from a project folder.
// A project's package.json scripts call it ("check": "pith check"), so `npm run check` works as before.
// Each command runs its tool as its own process, with the arguments that follow it.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const tools = import.meta.dirname;
const COMMANDS = {
  create: ['create.mjs', [], 'pith create my-app        a new project in ./my-app (pages, router, flows, AGENTS.md)'],
  dev: ['dev.mjs', [], 'pith dev                  Vite dev server: reloads on save (needs vite installed)'],
  serve: ['dev-server.mjs', [], 'pith serve                the no-build dev server: the project as-is, nothing else needed'],
  build: ['build.mjs', [], 'pith build                production build into dist/, with prerendered pages (needs vite)'],
  preview: ['dev-server.mjs', ['--dist'], 'pith preview              serve the built dist/'],
  check: ['check.mjs', [], 'pith check [--build] [--browsers] [--json]   tests, flows, every route, a11y, types, size'],
  see: ['see.mjs', [], 'pith see /path [--mobile] [--dark] [--full] [--state]   a page as text + a screenshot'],
  new: ['new.mjs', [], 'pith new page <name> [--nav] | component <tag-name>'],
  release: ['release.mjs', [], 'pith release              rebuild pith/pith.min.js (after changing the framework)'],
};

const [command, ...args] = process.argv.slice(2);
if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log(`Pith: a tiny framework on native web tech.\n\nCommands (run from a project folder):\n${Object.entries(COMMANDS)
    .map(([name, [, , help]]) => `  ${name.padEnd(9)}${help.replace(/^pith \S+\s*/, '')}`).join('\n')}\n\nDocs: ${join(tools, '..', 'README.md')}`);
  process.exit(0);
}
const entry = COMMANDS[command];
if (!entry) {
  console.error(`Unknown command "${command}". Run  pith  to list the commands.`);
  process.exit(1);
}
const [file, fixed] = entry;
const run = spawnSync(process.execPath, [join(tools, file), ...fixed, ...args], { stdio: 'inherit' });
process.exit(run.status ?? 1);
