---
name: pith-design
description: >
  Make a Pith page look right and stand out: layout, spacing, typography, color, dark theme, phones, polish,
  and recipes for impressive touches (featured card, badge, segmented toggle, accent hero, check lists, hover lift).
  Use it for any visual work (a new page's look, "make it look better", landing or pricing pages, restyling,
  responsive fixes) and to review UI you just built. It requires looking at screenshots before calling it done.
---

# Designing with Pith

Good UI here means calm, clear and readable, in Pith's Apple-inspired style: soft gray pages, white cards
floating on soft shadows (no borders), one blue for actions, big tight headlines, pill buttons, frosted glass
for things on top, true black in dark mode. Built from the project's design system, and checked by looking at it. You can see your work: `npm run see` saves screenshots, and you can open them.

## The look-at-it loop (required)

```sh
npm run see /the-page --full            # desktop, whole page
npm run see /the-page --mobile --full   # phone (390px)
npm run see /the-page --dark --full     # dark theme (also checks contrast in it)
```
Open each screenshot from `.pith/screenshots/`. Compare it with a page you didn't touch, fix what's off, and
look again. The text output also names sideways scrolling and accessibility problems. Do this before saying
done; "the code looks right" isn't the same as the page looking right.

## Use the design system first

Everything lives in `styles/main.css`. Reuse before you add.

- **Tokens** (light and dark already defined, all text pairs pass 4.5:1): `--bg` page, `--surface` and
  `--surface-2` cards and insets, `--text`, `--muted` secondary text, `--border` and `--hairline` lines,
  `--fill` / `--fill-strong` quiet control backgrounds, `--accent` blue **text and links**, `--accent-fill` with
  `--on-accent` blue **backgrounds** (never `--accent` as a background: in dark mode it's a light blue for text),
  `--accent-soft` selected backgrounds, `--seg-on` the selected segment, `--danger`, `--success`, `--focus`,
  `--radius` / `--radius-sm`, `--shadow` / `--shadow-lift`, `--glass` (frosted bars), `--font`, `--mono`.
- **The shared block:** everything above `/* ===== end of Pith design ===== */` in `styles/main.css` is Pith's
  design; put the site's own styles below it.
- **Classes:** `btn` (`primary`, `ghost`, `danger`: pills), `icon-btn` (round), `card`, `section`, `narrow`, `hero`, `lead`, `muted`,
  `note` (small text that wraps), `small` (short labels; doesn't wrap), `grid`, `row`, `input`, `form`,
  `field-label` / `field-hint` / `field-error`, `form-error`, `empty`, `loading`, `load-error`, `notice`, `chip`,
  `sr-only`, `status-page`, `scroll-quiet` (a lighter scrollbar for a sidebar or a side list).
- **Scrollbars** are styled in the shared block (thin, rounded, themed): don't restyle them per page.
- **New color?** Add it as a token in `:root`, in the dark block **and** in `[data-theme="dark"]`. Never a raw
  hex in a component.
- New CSS goes in `styles/main.css` under a `/* ---------- Name ---------- */` heading, using the tokens.

## Layout

- **Width:** content in `.page` (960px); text-heavy sections in `.narrow` (640px). Lines of text stay under
  ~70 characters.
- **Spacing:** use the steps the file already uses (0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3rem). Related things
  sit closer than unrelated ones: space shows grouping. Sections get `2.5rem` between them.
- **Grids:** `display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr))` works from
  phone to desktop without media queries. Cards in a row should have the same kind of content.
- **Alignment:** one left edge per column. Center only short, standalone things (status pages, a hero CTA).

## Typography and hierarchy

- One `<h1>` per page, `<h2>` per section, `<h3>` inside cards. Don't skip levels for looks; restyle instead.
- One `.lead` under the `<h1>`; body text is `--text`, secondary text `--muted`.
- **One thing is loudest per view:** a single `btn primary`. If everything is bold, nothing is.
- Numbers that change (counts, prices) get `font-variant-numeric: tabular-nums` so they don't jitter.

## Phones (390px)

- No sideways scroll (`npm run check` fails it and names the element). Long words, URLs and code:
  `overflow-wrap: anywhere`; wide tables and code blocks scroll inside their own box.
- Touch targets at least 44px tall; keep 0.5rem between them.
- Rows of buttons wrap (`.row` does); forms are one column.
- Put the primary action where a thumb reaches it, and don't hide it behind a menu.

## Dark theme and contrast

- Every color comes from a token, so dark mode follows. Check both themes: `npm run check` measures text
  contrast (4.5:1, or 3:1 for large text) in light and dark, and names the element and colors.
- Images and icons must work on both backgrounds; use `currentColor` in inline SVG.

## Motion

- Items appearing, moving and leaving: `class="motion"` on their container + `transition()` (the shared block
  animates them and makes the neighbours glide). CSS for small hovers (under 200ms).
- Animate opacity and transform, not size or position properties.
- Respect `@media (prefers-reduced-motion: reduce)`: turn movement off there.
- A sticky or fixed bar (toolbar, bottom bar) needs its own layer during `transition()`, or animated rows are
  drawn over it: copy the `nav-bar` rules from the shared block (dev warning W050 names the bar).
- Don't animate rows inside a scroll box (a list with `overflow: auto`): rows scrolled out of its view are drawn
  outside it while they animate (W051). Let that list change at once.

## Polish that's easy to miss

- No layout jump when data arrives: give loading states the space the content will take.
- Empty, error and loading states look designed, not like leftovers (see pith-frontend).
- Hover and active states on everything clickable; `:focus-visible` stays visible.
- Images: `alt` text, fixed `width`/`height` or `aspect-ratio` so they don't push content.
- Consistent wording: the same thing has the same name everywhere; sentence case on buttons and headings.
- Icons next to text, not instead of it, unless they have an `aria-label`.

## Make it stand out

Correct is the floor. A page people remember has one clear focal point and one or two details made with care.
Add these only where the page has a reason for them, using the recipes below (copy them into `styles/main.css`
the first time a page needs one; they use only the tokens, so dark mode and contrast keep working).

- **One focal point per view:** the thing the page is for (the recommended plan, the main number, the main
  action) gets the most size, color or depth. Everything else steps back.
- **Contrast of scale:** a big number or headline next to small, quiet labels reads as designed; everything at
  the same size reads as a form.
- **Depth, sparingly:** `--shadow` and a lift on the featured or hovered card; flat everywhere else.
- **Color with a job:** `--accent` for the one primary action and the focal item; `--accent-soft` for selected
  and highlighted backgrounds. Never more than one accent hue.
- **Small moments:** a badge ("Most popular", "Save 20%"), check icons in feature lists, a value that animates
  when it changes, a hover response on cards. One or two per page, not everywhere.
- **Limits:** no gradients on text, no more than one background tint per page, motion under 200ms (and off for
  `prefers-reduced-motion`), no decoration that hides content or moves the layout.

### Self-critique (after the screenshots)

Score the screenshots 1-3 on each, and improve anything under 3 once before you finish:
- **Focal point:** in one second, is it obvious what this page is for and what to do?
- **Hierarchy:** do size and weight lead the eye in the right order (h1 → focal item → the rest)?
- **Rhythm:** consistent spacing and edges; related things grouped; nothing cramped or floating?
- **Polish:** states, hover, focus, phone and dark all look intended?
- **Delight:** is there one detail that shows care, without being loud?

### Recipes

**Featured card and badge** (the recommended plan, the main offer):
```css
.card.featured { border: 2px solid var(--accent-fill); box-shadow: var(--shadow-lift); position: relative; }
/* .badge and .badge.soft are in the shared block */
.card.featured > .badge { position: absolute; top: -0.75rem; left: 1.25rem; }
```
```js
html`<article class=${p.popular ? 'card featured' : 'card'}>${p.popular ? html`<span class="badge">Most popular</span>` : null}…</article>`
```

**Segmented toggle** (2-4 choices that switch a view; buttons with `aria-pressed`, in a labelled group). `.segmented`
is in the shared block: a gray track with the selected segment raised, like iOS.
```js
html`<div class="segmented" role="group" aria-label="Billing">${['monthly', 'yearly'].map((b) => html`
  <button type="button" aria-pressed=${() => String(billing.value === b)} @click=${() => (billing.value = b)}>${b === 'monthly' ? 'Monthly' : 'Yearly'}</button>`)}</div>`
```

**Big value with a quiet unit** (prices, stats; numbers don't jitter when they change):
```css
.value { font-size: clamp(2.25rem, 5vw, 3rem); font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1; }
.value small { font-size: 1rem; font-weight: 500; color: var(--muted); letter-spacing: 0; }
```

**Check list** (what's included; an inline SVG check in the accent color). `.check-list` is in the shared block.
```js
const check = () => html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
html`<ul class="check-list">${items.map((t) => html`<li>${check()}<span>${t}</span></li>`)}</ul>`
```

**Accent hero** (the top of a landing, pricing or empty page; one tint per page): `<section class="hero tinted">`,
in the shared block (its glow fades out before its edges, and a soft badge on it gets a surface background).

**Hover lift** (cards that are clickable or compared side by side): add `lift` to the card (in the shared block,
off with reduced motion).

**Frosted bar** (something that floats over content, like a toolbar or a sticky header):
```css
.toolbar { position: sticky; top: 3.25rem; z-index: 10; background: var(--glass); border-bottom: 1px solid var(--hairline);
  -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); }
```

## Review checklist

- [ ] Screenshots looked at: desktop, phone, dark (full page)
- [ ] Matches the pages around it: same widths, spacing, buttons, cards
- [ ] One primary action; clear hierarchy from `<h1>` down; one focal point
- [ ] Self-critique scored, and anything under 3 improved once
- [ ] Nothing cramped, nothing floating far from what it belongs to
- [ ] Phone: no sideways scroll, readable text, tappable buttons
- [ ] Dark: nothing invisible, no hard-coded colors
- [ ] `npm run check` prints All good
