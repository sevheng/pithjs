// Accessibility checks on a rendered page, run by `npm run check` on every route (via see.html) and
// printed by `npm run see`. Each problem names the element and how to fix it. They cover the rules in
// AGENTS.md that a person using a screen reader or keyboard trips over, plus text contrast:
//   form fields without a label, buttons and links without a name, images without alt, duplicate ids,
//   <label for> pointing nowhere, more than one <h1>, no <html lang>, and text below WCAG AA contrast
//   (4.5:1, or 3:1 for large text).
// Contrast is skipped where the background isn't a plain color (images, gradients).

/**
 * @param {Document} doc
 * @param {{ contrastOnly?: boolean }} [options] contrastOnly: the dark-theme pass (structure doesn't change)
 * @returns {string[]}
 */
export function accessibilityProblems(doc, { contrastOnly = false } = {}) {
  const problems = contrastOnly ? [] : structure(doc);
  return [...problems, ...contrast(doc)];
}

/** How a problem names an element: <tag#id.class> "its text". */
function describe(el) {
  const id = el.id ? `#${el.id}` : '';
  const cls = !id && el.classList.length ? `.${[...el.classList].join('.')}` : '';
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
  return `<${el.localName}${id}${cls}>${text ? ` "${text}"` : ''}`;
}

const visible = (el) => el.checkVisibility({ visibilityProperty: true, opacityProperty: true });

/** The accessible name, roughly as a screen reader finds it (enough to tell "has one" from "has none"). */
function nameOf(el) {
  const doc = el.ownerDocument;
  const byIds = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
    .map((id) => doc.getElementById(id)?.textContent ?? '').join(' ');
  const labels = 'labels' in el && el.labels ? [...el.labels].map((l) => l.textContent).join(' ') : '';
  const images = [...el.querySelectorAll('img[alt], svg title')].map((i) => i.getAttribute('alt') ?? i.textContent).join(' ');
  return [el.getAttribute('aria-label'), byIds, labels, el.getAttribute('title'), images].join(' ').trim();
}

function structure(doc) {
  const problems = [];
  if (!doc.documentElement.lang) problems.push('<html> has no lang: add <html lang="en"> (screen readers pick the voice from it)');

  const fields = doc.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=reset]):not([type=button]):not([type=image]), select, textarea');
  for (const el of fields) {
    if (!nameOf(el)) problems.push(`${describe(el)} has no label: add <label for="${el.id || '…'}"> (class "sr-only" hides it visually) or aria-label`);
  }
  for (const el of doc.querySelectorAll('button, a[href], [role=button], input[type=submit], input[type=button]')) {
    const text = el.localName === 'input' ? /** @type {HTMLInputElement} */ (el).value : el.textContent;
    if (!(text ?? '').trim() && !nameOf(el)) problems.push(`${describe(el)} has no name: give it text, or aria-label if it's icon-only`);
  }
  for (const img of doc.querySelectorAll('img:not([alt])')) {
    problems.push(`<img src="${img.getAttribute('src') ?? ''}"> has no alt: describe it, or alt="" if it's decoration`);
  }

  const ids = new Map();
  for (const el of doc.querySelectorAll('[id]')) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) problems.push(`id="${id}" is used ${n} times: ids must be unique (labels and aria-* point at the first one only)`);
  for (const label of doc.querySelectorAll('label[for]')) {
    const id = label.getAttribute('for');
    if (!doc.getElementById(id)) problems.push(`${describe(label)} points at id="${id}", which doesn't exist`);
  }

  const h1s = [...doc.querySelectorAll('h1')].filter(visible);
  if (h1s.length > 1) problems.push(`${h1s.length} <h1>s (${h1s.map((h) => `"${h.textContent.trim().slice(0, 20)}"`).join(', ')}): use one per page, then <h2>`);
  return problems;
}

// ---------- Contrast (WCAG 2 AA) ----------

function contrast(doc) {
  const view = doc.defaultView;
  // Any CSS color (oklch, color-mix, named...) → sRGB, by painting it on a 1px canvas.
  const ctx = doc.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (color) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#0000';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  /** @param {number[]} top @param {number[]} below */
  const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
  // The color behind el: its own and its ancestors' backgrounds, blended, down to the first solid one.
  // null when an image or gradient is in the way (can't know the color).
  const background = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const style = view.getComputedStyle(e);
      if (style.backgroundImage !== 'none') return null;
      const c = rgba(style.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    return layers.reduceRight((below, layer) => over(layer, below), [255, 255, 255]);
  };
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const problems = [];
  const seen = new Set();
  for (const el of doc.body.querySelectorAll('*')) {
    if (!/** @type {any} */ ([...el.childNodes]).some((n) => n.nodeType === 3 && n.data.trim())) continue;
    if (el.closest(':disabled, [aria-hidden=true], script, style, noscript') || !visible(el)) continue;
    const box = el.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue; // visually hidden (sr-only)
    const style = view.getComputedStyle(el);
    const bg = background(el);
    if (!bg) continue;
    const fg = over(rgba(style.color), bg);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, bg);
    if (got >= need) continue;
    const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    const key = `${hex(fg)} ${hex(bg)} ${large}`;
    if (seen.has(key)) continue; // one report per color pair: the fix is usually one CSS token
    seen.add(key);
    problems.push(`${describe(el)}: text contrast ${got.toFixed(1)}:1 (${hex(fg)} on ${hex(bg)}), needs ${need}:1${large ? ' for large text' : ''}`);
  }
  return problems;
}
