# Dark theme

## What it does
A light/dark switch for the whole app. The choice is saved in the browser (`sirius-theme`: `light`, `dark` or `system`) and applied before the page paints, so there is no flash. The default is light.

## Where the toggle is
- Org header (signed in and signed out).
- Login and sign-up pages, top corner.
- Dashboard: user menu at the bottom of the left menu.

## How it works
- `html.dark` turns it on. Tailwind color classes compile to CSS variables, so `styles/dark.css` swaps the palette: light tints become dark tints and the other way round. Mid tones are unchanged. Neutral 600 is lightened because it is secondary text.
- Overrides are generated for the places where the same variable is used both for backgrounds and for text (`bg-white` / `text-white`, `bg-gray-900` / `text-gray-900`, light text on dark buttons, hex colors in arbitrary classes).
- Elements that already carry their own `dark:` variant are skipped by the generator.
- Code editors are dark in both themes (unchanged).

## Regenerating after adding color classes
From `lms/apps/web`: `node scripts/gen-dark-css.mjs`, then commit `styles/dark.css`.

## Known gaps
- Colors set as inline `style` values or raw hex in CSS are not covered.
- Dark logos on dark backgrounds need a light version of the logo file.
- Not every screen has been checked in dark. Report screens that look wrong with the page name.

## Rollback
Remove the `dark.css` import from `app/layout.tsx`; the toggle then does nothing visible.
