# Remotion — buscador-medicos

Renders LinkedIn launch announcement stills (1080×1080 PNG) for buscador-medicos.com. Independent subproject — does NOT share `package.json` or `node_modules` with the Next.js webapp in the repo root.

See `../docs/superpowers/specs/2026-05-14-linkedin-post-remotion-design.md` for the full design spec.

## Install

```bash
cd remotion
npm install
```

First install downloads Chromium headless via `@remotion/renderer` — expect 1–3 minutes and ~200 MB on disk.

## Preview in the browser

```bash
npm run studio
```

Opens Remotion Studio at `http://localhost:3001` (port 3001 to avoid colliding with `npm run dev` of the webapp on :3000). The sidebar lists three compositions:

- **PostSplit** — split 52/48 copy + chat mockup.
- **PostMockup** — centered browser-window mockup of the home.
- **PostTipo** — typographic "Acabo de lanzar" bold style.

Iterate by editing the corresponding `src/Post*.tsx` file; the Studio hot-reloads.

## Render to PNG

Render one composition:

```bash
npm run render:split
npm run render:mockup
npm run render:tipo
```

Or all three at once:

```bash
npm run render:all
```

Outputs land in `remotion/out/` (gitignored). Pick the one you like best and upload to LinkedIn manually.

## File layout

- `src/Root.tsx` — registers the three compositions.
- `src/shared/theme.ts` — colors, dimensions, radii. Edit here to retheme all three at once.
- `src/shared/fonts.ts` — loads Inter via `@remotion/google-fonts`.
- `src/shared/Pill.tsx` — reusable pill component.
- `src/PostSplit.tsx`, `src/PostMockup.tsx`, `src/PostTipo.tsx` — one per variant.

## Notes

- No test runner. Verification is visual + dimensional check on the generated PNGs.
- Each composition is `durationInFrames={1}` because we render stills, not video.
- The webapp's `package.json` is untouched by this subproject.
