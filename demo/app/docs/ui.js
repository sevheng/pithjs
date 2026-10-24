// Building blocks for docs pages (app/docs/pages/*.js). Everything is escaped text: no innerHTML.
import { html } from 'pith';

/**
 * A code block. `file` names where the code lives (shown above it).
 * @param {string} source @param {{ file?: string, label?: string }} [options]
 */
export const code = (source, { file, label } = {}) => html`
  <figure class="doc-code">
    ${file ? html`<figcaption>${file}</figcaption>` : null}
    <pre class="code" tabindex="0" aria-label=${label ?? (file ? `Code: ${file}` : 'Code example')}><code>${source.trim()}</code></pre>
  </figure>`;

/**
 * An API table: one row per function, option or property.
 * @param {[string, unknown][]} rows [signature, what it does]
 * @param {{ head?: [string, string], anchors?: boolean }} [options] head: the column titles ·
 *   anchors: each row gets its first cell, lowercased, as an id (/docs/warnings#w001)
 */
export const api = (rows, { head = ['API', 'What it does'], anchors = false } = {}) => html`
  <div class="doc-table-wrap"><table class="doc-api">
    <thead><tr><th scope="col">${head[0]}</th><th scope="col">${head[1]}</th></tr></thead>
    <tbody>${rows.map(([sig, what]) => html`<tr id=${anchors ? sig.toLowerCase() : null}><td><code>${sig}</code></td><td>${what}</td></tr>`)}</tbody>
  </table></div>`;

/**
 * A highlighted note. kind: 'tip' (default) or 'warn' (a mistake people make).
 * @param {unknown} content @param {'tip' | 'warn'} [kind]
 */
export const note = (content, kind = 'tip') => html`
  <aside class=${kind === 'warn' ? 'doc-note warn' : 'doc-note'}>
    <strong>${kind === 'warn' ? 'Watch out' : 'Tip'}</strong> <span>${content}</span>
  </aside>`;

/** Inline code inside text: html`Call ${c('refetch()')} to…`. */
export const c = (text) => html`<code>${text}</code>`;
