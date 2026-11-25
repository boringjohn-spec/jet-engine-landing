# Kiln Propulsion · Ember K1 landing page

Concept landing page for a hybrid propulsion stack, built with Vite, three.js and anime.js v4.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## What's where

- `src/model.js` loads `public/models/engine.fbx` and splits the single mesh into 12 flight modules (connected parts + clean seams along the body).
- `src/rocket-stage.js` is the pinned hero + exploded view. One anime.js timeline is synced to scroll with `onScroll`: explode → paper line drawing with callouts → reassemble.
- `src/particle-field.js` is the "Burn" section: ~28k GPU particles morphing rocket → injector face → exhaust plume on scroll, pushed by the cursor, with a click pulse.
- `src/companion.js` brings the assembled rocket back after the Burn section: a fixed layer behind the content that glides between parked spots (specs heading → test-log line → contact) and settles horizontally on the footer dock. Keyframes are measured from the live layout, so they follow the content on any screen size.
- `src/main.js` handles loading, intro, tabs, test log, and form.
- `docs/brief.md` has the Mobbin research, mood board, structure and copy deck.

Add `?exact` to the URL to lock the 3D to the scrollbar without smoothing (useful for QA and screenshots).

Textures were downscaled from the 4K source (`Roket2.rar`) to 2K WebP; the original `.blend` isn't used.
