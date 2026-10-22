// ui tests. Called by index.html with the shared helpers.
import { html, signal, effect } from '../mini/index.js';
import { dialog, confirm, toast } from '../mini/ui.js';

/** @param {any} t */
export default async function (t) {
  const { test, eq, tick, waitUntil, expectWarning } = t;
  const until = (check) => waitUntil(check, 2000);
  const openDialog = () => /** @type {HTMLDialogElement | null} */ (document.querySelector('dialog.mini-dialog'));
  /** @param {string} text @returns {HTMLButtonElement} */
  const button = (text) => [...document.querySelectorAll('dialog.mini-dialog button')]
    .map((b) => /** @type {HTMLButtonElement} */ (b)).find((b) => b.textContent?.trim() === text) ?? /** @type {any} */ (null);
  // A visible button outside the dialog, to check focus comes back to it.
  const opener = () => {
    const b = document.createElement('button');
    b.textContent = 'open';
    document.body.append(b);
    b.focus();
    return b;
  };
  const cleanup = () => {
    document.querySelectorAll('dialog.mini-dialog, .mini-toasts').forEach((el) => el.remove());
  };

  // ---------- dialog ----------

  await test('ui dialog: shows modal, close(value) resolves, removes it and disposes its scope', async () => {
    try {
      const count = signal(0);
      let runs = 0;
      const result = dialog((close) => {
        effect(() => { count.value; runs++; });
        return html`<p>Body ${count}</p><button type="button" @click=${() => close('done')}>Finish</button>`;
      }, { label: 'Settings' });
      const d = openDialog();
      eq(d?.open, true);
      eq(d.matches(':modal'), true);
      eq(d.getAttribute('aria-label'), 'Settings');
      eq(d.textContent.includes('Body 0'), true);
      count.value = 1;
      eq(runs, 2);
      button('Finish').click();
      eq(await result, 'done');
      eq(openDialog(), null);
      count.value = 2;
      eq(runs, 2); // the effect was disposed with the dialog
    } finally {
      cleanup();
    }
  });

  await test('ui dialog: labelled by its first heading when no label is given', async () => {
    try {
      /** @type {any} */
      let close;
      const result = dialog((c) => ((close = c), html`<h2>Edit todo</h2><p>x</p>`));
      const d = openDialog();
      const id = d.getAttribute('aria-labelledby');
      eq(document.getElementById(id)?.textContent, 'Edit todo');
      eq(d.hasAttribute('aria-label'), false);
      close();
      eq(await result, undefined);
    } finally {
      cleanup();
    }
  });

  await test('ui dialog: Esc and a backdrop click resolve undefined; clicks inside do not close', async () => {
    try {
      let result = dialog(() => html`<p>Hi</p>`, { label: 'A' });
      const esc = new Event('cancel', { cancelable: true });
      openDialog().dispatchEvent(esc);
      eq(esc.defaultPrevented, true);
      eq(await result, undefined);
      eq(openDialog(), null);

      result = dialog(() => html`<p id="inside">Hi</p>`, { label: 'B' });
      let settled = false;
      result.then(() => (settled = true));
      document.getElementById('inside').click();
      await tick();
      eq(settled, false);
      openDialog().click(); // the dialog element itself is only exposed by its backdrop
      eq(await result, undefined);
      eq(openDialog(), null);
    } finally {
      cleanup();
    }
  });

  await test('ui dialog: focus returns to the element focused before opening', async () => {
    const b = opener();
    try {
      /** @type {any} */
      let close;
      const result = dialog((c) => ((close = c), html`<button type="button">Inside</button>`), { label: 'F' });
      eq(document.activeElement, button('Inside'));
      close(1);
      await result;
      eq(document.activeElement, b);
    } finally {
      b.remove();
      cleanup();
    }
  });

  await test('ui dialog: warns when it has no label or heading', () =>
    expectWarning(/W050/, async () => {
      try {
        /** @type {any} */
      let close;
        const result = dialog((c) => ((close = c), html`<p>no name</p>`));
        close();
        await result;
      } finally {
        cleanup();
      }
    }));

  // ---------- confirm ----------

  await test('ui confirm: OK → true, Cancel → false, Esc → false; focus starts on OK', async () => {
    const b = opener();
    try {
      let result = confirm('Delete it?');
      eq(openDialog().getAttribute('aria-label'), 'Delete it?');
      eq(openDialog().textContent.includes('Delete it?'), true);
      eq(document.activeElement, button('OK'));
      button('OK').click();
      eq(await result, true);
      eq(document.activeElement, b);

      result = confirm('Again?', { ok: 'Yes', cancel: 'No' });
      button('No').click();
      eq(await result, false);

      result = confirm('Esc?');
      openDialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      eq(await result, false);
    } finally {
      b.remove();
      cleanup();
    }
  });

  await test('ui confirm: danger starts focus on Cancel and marks the OK button', async () => {
    try {
      const result = confirm('Clear all?', { ok: 'Clear', danger: true });
      eq(document.activeElement, button('Cancel'));
      eq(button('Clear').classList.contains('danger'), true);
      button('Clear').click();
      eq(await result, true);
    } finally {
      cleanup();
    }
  });

  // ---------- toast ----------

  const region = () => /** @type {HTMLElement | null} */ (document.querySelector('.mini-toasts'));
  const toasts = () => [...document.querySelectorAll('.mini-toast')];

  await test('ui toast: one polite live region; error toasts are alerts; Dismiss removes', async () => {
    try {
      const d1 = toast('Saved', { type: 'success', timeout: 0 });
      const d2 = toast('Failed', { type: 'error', timeout: 0 });
      const r = region();
      eq(document.querySelectorAll('.mini-toasts').length, 1);
      eq(r.getAttribute('role'), 'status');
      eq(r.getAttribute('aria-live'), 'polite');
      if (HTMLElement.prototype.showPopover) {
        eq(r.getAttribute('popover'), 'manual');
        eq(r.matches(':popover-open'), true);
      }
      eq(toasts().length, 2);
      eq(toasts()[0].hasAttribute('role'), false);
      eq(toasts()[1].getAttribute('role'), 'alert');
      eq(toasts()[0].textContent.includes('Saved'), true);
      const dismiss = toasts()[1].querySelector('button[aria-label="Dismiss"]');
      /** @type {HTMLButtonElement} */ (dismiss).click();
      eq(toasts().length, 1);
      d1();
      d2(); // dismissing twice is harmless
      eq(toasts().length, 0);
      eq(region(), null); // the region goes away when empty
    } finally {
      cleanup();
    }
  });

  await test('ui toast: disappears after its timeout; timeout 0 stays', async () => {
    try {
      toast('Quick', { timeout: 30 });
      const stay = toast('Stays', { timeout: 0 });
      eq(toasts().length, 2);
      await until(() => toasts().length === 1);
      await new Promise((r) => setTimeout(r, 60));
      eq(toasts()[0].textContent.includes('Stays'), true);
      stay();
      eq(toasts().length, 0);
    } finally {
      cleanup();
    }
  });

  await test('ui toast: shows above an open modal dialog', async () => {
    try {
      const done = toast('Before', { timeout: 0 });
      /** @type {any} */
      let close;
      const result = dialog((c) => ((close = c), html`<p>x</p>`), { label: 'Over' });
      const dismiss = toast('After', { timeout: 0 });
      if (HTMLElement.prototype.showPopover) {
        // Drawn on top and not made inert by the modal: hit-testing the toast's centre finds the toast.
        const box = toasts()[1].getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        eq(!!hit?.closest('.mini-toast'), true);
      }
      close();
      await result;
      eq(region()?.parentElement, document.body); // back out of the closed dialog
      eq(toasts().length, 2);
      done();
      dismiss();
    } finally {
      cleanup();
    }
  });

  await test('ui toast: warns about an unknown type', () =>
    expectWarning(/W051.*"warning"/, () => {
      try {
        toast('x', { type: /** @type {any} */ ('warning'), timeout: 0 })();
      } finally {
        cleanup();
      }
    }));
}
