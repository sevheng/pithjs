// A tiny Chrome DevTools Protocol client (Node 24 has WebSocket built in): launch headless Chrome,
// open pages in fresh browser contexts (empty cache and storage), send commands, wait for events.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function launch(chromePath) {
  const profile = mkdtempSync(join(tmpdir(), 'mini-cdp-'));
  const child = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--ignore-certificate-errors',
    '--js-flags=--expose-gc', '--window-size=1280,900',
  ]);
  const wsUrl = await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error(`Chrome didn't start:\n${log}`)), 30_000);
    child.stderr.on('data', (d) => {
      log += d;
      const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
    } else {
      for (const fn of listeners) fn(msg);
    }
  };

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  return {
    /** Open a page in a new, isolated browser context. */
    async newPage() {
      const { browserContextId } = await send('Target.createBrowserContext');
      const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const pageSend = (method, params) => send(method, params, sessionId);
      return {
        send: pageSend,
        /** Evaluate an expression in the page (awaiting promises) and return its value. */
        async evaluate(expression) {
          const { result, exceptionDetails } = await pageSend('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
          return result.value;
        },
        /** Resolve when an event for this page arrives. */
        once(method, timeout = 60_000) {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              listeners.delete(fn);
              reject(new Error(`timed out waiting for ${method}`));
            }, timeout);
            const fn = (msg) => {
              if (msg.sessionId === sessionId && msg.method === method) {
                clearTimeout(timer);
                listeners.delete(fn);
                resolve(msg.params);
              }
            };
            listeners.add(fn);
          });
        },
        async close() {
          await send('Target.closeTarget', { targetId });
          await send('Target.disposeBrowserContext', { browserContextId });
        },
      };
    },
    async close() {
      ws.close();
      child.kill();
      await new Promise((r) => child.once('exit', r));
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
