import { html, svg } from 'pith';

// Drawings of the products, standing in for photos (the demo ships no images). Each is a few flat shapes on a
// tinted backdrop, in the product's colour (--swatch-<colour> in styles/main.css), so a colour choice changes
// the picture. Decorative: the name next to it says what it is. Always drawn at a fixed size (width/height on
// the <svg>, and aspect-ratio in CSS), so nothing moves when it appears.

// On a 100 × 100 grid. Classes: a = the product's colour, s = a shadow on it, l = a highlight, d = a dark detail.
/** @type {Record<string, () => unknown>} */
const SHAPES = {
  mug: () => svg`<path class="a" d="M30 34h34v34a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8z"/><path class="a" d="M64 42h5a8 8 0 0 1 0 16h-5v-5h5a3 3 0 0 0 0-6h-5z"/>
    <path class="s" d="M30 34h34v6H30z"/><path class="l" d="M36 44h4v22h-4z"/>`,
  bowl: () => svg`<path class="a" d="M22 46h56c0 17-12 28-28 28S22 63 22 46z"/><ellipse class="s" cx="50" cy="46" rx="28" ry="5"/><path class="l" d="M30 52h5c2 8 6 13 11 15-9-1-15-7-16-15z"/>`,
  board: () => svg`<rect class="a" x="22" y="40" width="48" height="30" rx="7"/><path class="a" d="M70 50h10a5 5 0 0 1 0 10H70z"/><circle class="d" cx="79" cy="55" r="1.8"/>
    <path class="s" d="M29 47h34M29 55h30M29 63h34" stroke-width="1.4" fill="none"/>`,
  apron: () => svg`<path class="a" d="M38 22h24v12l10 4v34a4 4 0 0 1-4 4H32a4 4 0 0 1-4-4V38l10-4z"/><path class="d" d="M38 22c0-6 24-6 24 0" fill="none" stroke-width="2"/>
    <rect class="s" x="38" y="52" width="24" height="12" rx="2"/>`,
  tin: () => svg`<rect class="a" x="34" y="30" width="32" height="44" rx="4"/><rect class="s" x="32" y="26" width="36" height="8" rx="3"/><rect class="l" x="40" y="44" width="20" height="16" rx="2"/>`,
  cloth: () => svg`<rect class="a" x="26" y="58" width="48" height="10" rx="3"/><rect class="s" x="28" y="48" width="44" height="10" rx="3"/><rect class="a" x="30" y="38" width="40" height="10" rx="3"/>
    <path class="l" d="M34 41h22" stroke-width="1.5" fill="none"/>`,
  throw: () => svg`<path class="a" d="M24 30h52v40H24z"/><path class="s" d="M24 38h52v4H24zM24 58h52v4H24z"/><path class="d" d="M28 70v6M34 70v6M40 70v6M46 70v6M52 70v6M58 70v6M64 70v6M70 70v6" stroke-width="1.5" fill="none"/>`,
  candle: () => svg`<rect class="a" x="38" y="38" width="24" height="38" rx="3"/><path class="s" d="M38 46h24v3H38zM38 58h24v3H38z"/><path class="d" d="M50 38v-6" stroke-width="1.6" fill="none"/>
    <path class="l" d="M50 20c4 4 4 9 0 11-4-2-4-7 0-11z"/>`,
  bookends: () => svg`<path class="a" d="M22 74V40h6v28h10v6zM78 74V40h-6v28H62v6z"/><rect class="s" x="40" y="44" width="6" height="24" rx="1"/><rect class="l" x="47" y="40" width="7" height="28" rx="1"/>
    <rect class="s" x="55" y="46" width="5" height="22" rx="1"/>`,
  tote: () => svg`<path class="d" d="M38 40c0-16 24-16 24 0" fill="none" stroke-width="2.5"/><path class="a" d="M28 40h44l-4 36H32z"/><rect class="s" x="42" y="52" width="16" height="12" rx="2"/>`,
  cushion: () => svg`<path class="a" d="M24 36q26-8 52 0q-6 16 0 32q-26 8-52 0q6-16 0-32z"/><path class="s" d="M30 52h40" stroke-width="1.5" fill="none"/><circle class="s" cx="50" cy="52" r="3"/>`,
  vase: () => svg`<path class="a" d="M42 24h16v8c10 6 12 16 10 28-2 10-8 16-18 16s-16-6-18-16c-2-12 0-22 10-28z"/><path class="l" d="M40 44c-3 6-3 14 0 20" fill="none" stroke-width="2.5"/>
    <path class="d" d="M50 24V12M50 18l-6-6M50 16l6-5" fill="none" stroke-width="1.6"/>`,
  basket: () => svg`<path class="d" d="M34 44c0-14 32-14 32 0" fill="none" stroke-width="2.5"/><path class="a" d="M24 44h52l-6 32H30z"/><path class="s" d="M26 52h48M27 60h46M29 68h42" fill="none" stroke-width="1.5"/>`,
  pot: () => svg`<path class="a" d="M30 36h40l-6 38H36z"/><rect class="s" x="27" y="32" width="46" height="10" rx="2"/><path class="d" d="M50 32c-2-10 2-14 8-16-1 6-3 10-8 16zM50 32c0-8-4-12-10-13 1 6 4 10 10 13z"/>`,
  can: () => svg`<rect class="a" x="34" y="40" width="30" height="34" rx="4"/><path class="a" d="M62 46l18-14 3 3-17 18z"/><path class="d" d="M38 40c0-10 22-10 22 0" fill="none" stroke-width="2.5"/>
    <rect class="s" x="34" y="48" width="30" height="4"/>`,
  packet: () => svg`<rect class="a" x="32" y="26" width="36" height="48" rx="2"/><path class="s" d="M32 26h36v8H32z"/><circle class="l" cx="50" cy="52" r="9"/><path class="d" d="M50 52v12M50 58l-4-3" fill="none" stroke-width="1.6"/>`,
  snips: () => svg`<circle class="a" cx="36" cy="64" r="8"/><circle class="a" cx="56" cy="68" r="8"/><circle class="l" cx="36" cy="64" r="3.5"/><circle class="l" cx="56" cy="68" r="3.5"/>
    <path class="d" d="M40 58l24-30M52 61l4-31" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  planter: () => svg`<path class="d" d="M34 48c-2-10 2-14 6-16 0 6-2 10-6 16zM50 48c0-12 3-16 8-18 0 8-3 12-8 18zM64 48c-1-8 2-12 6-13-1 5-2 9-6 13z"/><path class="a" d="M20 48h60l-4 22H24z"/><rect class="s" x="20" y="48" width="60" height="5"/>`,
  gloves: () => svg`<path class="a" d="M28 74V46c0-4 6-4 6 0v-8c0-4 6-4 6 0v-2c0-4 6-4 6 0v6c0-4 6-4 6 0v32z"/><path class="s" d="M28 66h24v8H28z"/>
    <path class="a" d="M56 74V50l4-6c2-4 7-2 6 2l-2 6h6v22z" opacity="0.75"/>`,
  notebook: () => svg`<rect class="s" x="34" y="26" width="34" height="46" rx="3"/><rect class="a" x="30" y="30" width="34" height="46" rx="3"/><rect class="l" x="38" y="40" width="18" height="6" rx="1"/>
    <path class="d" d="M58 30v46" stroke-width="1.5" fill="none"/>`,
  pencils: () => svg`<path class="a" d="M30 74l6-44 4 0-6 44zM44 74l2-44h4l-2 44zM58 74l-2-44h4l2 44z"/><path class="d" d="M36 30l2-6 2 6zM46 30l2-6 2 6zM56 30l2-6 2 6z"/>
    <rect class="s" x="26" y="66" width="40" height="10" rx="2"/>`,
  calendar: () => svg`<path class="s" d="M26 72h48l-6 4H32z"/><rect class="a" x="30" y="28" width="40" height="44" rx="3"/><rect class="s" x="30" y="28" width="40" height="10" rx="3"/>
    <path class="l" d="M36 46h6v6h-6zM46 46h6v6h-6zM56 46h6v6h-6zM36 56h6v6h-6zM46 56h6v6h-6z"/>`,
  cards: () => svg`<rect class="s" x="30" y="30" width="40" height="28" rx="2" transform="rotate(-8 50 44)"/><rect class="a" x="28" y="40" width="44" height="30" rx="2"/>
    <path class="l" d="M34 48h20M34 54h28M34 60h24" fill="none" stroke-width="1.6"/>`,
};

/**
 * A product's drawing.
 * @param {{ art: string, name: string }} p
 * @param {string} colour a colour id (sage, clay, …)
 * @param {{ size?: number, className?: string }} [options] size: its width and height in px
 */
export function productArt(p, colour, { size = 320, className = 'art' } = {}) {
  return html`<svg class=${className} viewBox="0 0 100 100" width=${size} height=${size} aria-hidden="true"
    style=${`--c: var(--swatch-${colour})`}>
    ${svg`<rect class="art-bg" width="100" height="100"/><ellipse class="art-floor" cx="50" cy="78" rx="30" ry="4"/>`}
    ${(SHAPES[p.art] ?? SHAPES.tin)()}
  </svg>`;
}
