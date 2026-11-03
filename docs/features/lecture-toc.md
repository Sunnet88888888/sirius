# Lecture table of contents

## What it does
In dynamic-page lectures the text takes the full page width. A small tab on the left edge of the window opens the table of contents as a panel over the text: it slides in while the pointer is over the tab or the panel and slides out a quarter of a second after the pointer leaves. There is no pinning.

- Lists headings of level 1 to 3 only; headings without text are skipped. Fewer than two headings: nothing is shown.
- The section being read is highlighted; clicking an entry scrolls to it smoothly (below the sticky course header).
- Headings with the same text get distinct, stable ids (`heading-example`, `heading-example-2`, ...). Before, the second link jumped to the first heading, and empty headings got a random id on every render.
- Touch screens (no hover): tap the tab to open, tap outside or on an entry to close.
- Keyboard: Tab focuses the tab and opens the panel, Esc closes it. Dark theme and reduced motion are respected.
- The embedded lecture view still passes `hideTableOfContents`, so nothing shows there.

## Files (all in `lms/apps/web`)
- `components/Objects/Activities/DynamicCanva/TableOfContents.tsx` (panel), `tocHeadings.ts` (pure helpers), `DynamicCanva.tsx` (the panel is no longer a layout column), `CustomHeadingExtenstion.tsx` (no random ids), `styles/globals.css` (`.toc-*`).
- Tests: `tests/lecture-toc.test.mjs` (`bun test tests/lecture-toc.test.mjs`).

## Rollback
Revert the commit; no data or API is involved.
