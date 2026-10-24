---
name: pith-design
description: >
  Make a Pith page look right: layout, spacing, typography, color, dark theme, phones, polish.
  Use it for any visual work (a new page's look, "make it look better", restyling, responsive fixes) and to
  review UI you just built. It requires looking at screenshots of the result before calling it done.
---

# Designing with Pith

Good UI here means calm, consistent and readable, built from the project's design system, and checked by
looking at it. You can see your work: `npm run see` saves screenshots, and you can open them.

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

- **Tokens** (light and dark already defined): `--bg` page, `--surface` cards, `--text`, `--muted` secondary
  text, `--border`, `--accent` and `--accent-text` (primary actions, links), `--accent-soft` (selected and
  hover backgrounds), `--danger`, `--focus`, `--radius`, `--shadow`, `--font`, `--mono`.
- **Classes:** `btn` (`primary`, `ghost`), `icon-btn`, `card`, `section`, `narrow`, `hero`, `lead`, `muted`,
  `note` (small text that wraps), `small` (short labels; doesn't wrap), `grid`, `row`, `input`, `form`,
  `field-label` / `field-hint` / `field-error`, `form-error`, `empty`, `loading`, `load-error`, `notice`, `chip`,
  `sr-only`, `status-page`.
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

- Use `transition()` for items appearing, moving and leaving, and CSS for small hovers (under 200ms).
- Animate opacity and transform, not size or position properties.
- Respect `@media (prefers-reduced-motion: reduce)`: turn movement off there.

## Polish that's easy to miss

- No layout jump when data arrives: give loading states the space the content will take.
- Empty, error and loading states look designed, not like leftovers (see pith-frontend).
- Hover and active states on everything clickable; `:focus-visible` stays visible.
- Images: `alt` text, fixed `width`/`height` or `aspect-ratio` so they don't push content.
- Consistent wording: the same thing has the same name everywhere; sentence case on buttons and headings.
- Icons next to text, not instead of it, unless they have an `aria-label`.

## Review checklist

- [ ] Screenshots looked at: desktop, phone, dark (full page)
- [ ] Matches the pages around it: same widths, spacing, buttons, cards
- [ ] One primary action; clear hierarchy from `<h1>` down
- [ ] Nothing cramped, nothing floating far from what it belongs to
- [ ] Phone: no sideways scroll, readable text, tappable buttons
- [ ] Dark: nothing invisible, no hard-coded colors
- [ ] `npm run check` prints All good
