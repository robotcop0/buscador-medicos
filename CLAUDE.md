# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server on :3000
- `npm run build` / `npm run start` — production build & serve
- `npm run lint` — Next.js ESLint
- `npm run scrape:adeslas` — pulls ~72k docs from Adeslas' public Elastic App Search into `data/adeslas-raw.json`. Flags: `--all` (adds MUFACE/ISFAS/Senior), `--limit=N` (debug).
- `npx tsx scraper/build-doctors.ts` — converts `data/adeslas-raw.json` → `data/doctors.json` (consumed by UI) + shim `data/doctors.ts`.
- `npm run scrape` / `npm run scrape:doctoralia` / `npm run scrape:google` — legacy Doctoralia+Google pipeline, kept for future cross-source enrichment but not wired into the current UI.

No test runner is configured.

## Architecture

Next.js 14 App Router + TypeScript + Tailwind. Data flow: **scraper → `data/doctors.json` (+ `doctors.ts` shim) → static filter → UI**. No live LLM calls at query time — Claude/AI is reserved for a future result-presentation step (not scraping, not searching).

### Types (`lib/types.ts`)
Single canonical `Doctor` type used everywhere (UI, search, scraper output). `telefono` and `distanceKm` are optional — the Adeslas scraper populates `telefono`, `distanceKm` is computed per-query from CP.

### Search (`lib/doctorSearch.ts` → `lib/search.ts`)
`findDoctors()` is the single entry point. It delegates to `filterDoctors()` which reads `data/doctors.ts` (shim over `doctors.json`) and filters by mutua/especialidad/CP with Haversine distance via `lib/coordinates.ts`. Especialidad uses **accent-insensitive partial match** so the UI dropdown ("Cardiología") matches subspecialties Adeslas returns ("Cardiología Infantil", "Cirugía General Y Del Aparato Digestivo", etc.). When `maxKm` is absent, falls back to province match (`cp.slice(0,2)`). Sort: rating desc, then numReviews desc.

### Results page (`app/resultados/page.tsx`)
Server component. Paginates 20 results/page via `?page=N`, preserving all other filters in the href helper. `totalFound` vs `pageResults.length` drives "Mostrando X–Y" caption. Component-level `Pagination` / `PageLink` / `buildPageList` render the 1 · 2 · … · N control.

### Search form (`components/SearchForm.tsx`)
Custom `Combobox` (not native `<select>`) with internal search, 5-row scroll, and disabled state for "En desarrollo" mutuas. `AVAILABLE_MUTUAS` = ["Adeslas"]; everything else rendered with an amber construction icon and badge. When adding a new mutua scraper, move its name from `COMING_SOON_MUTUAS` to `AVAILABLE_MUTUAS`.

### Scraper (`scraper/`)
Standalone `tsx` pipeline, not part of the Next build.

- **`sources/adeslas.ts`** (primary, current UI data source): hits Adeslas' public Elastic App Search (`https://sca-cm-prod.ent.westeurope.azure.elastic-cloud.com/api/as/v1/engines/cm-pre/elasticsearch/_search`) with the Bearer token that the web client itself exposes. Paginates via `search_after` on `id_doc` (keyword, sortable). Deduplicates by `nombre::cp::especialidad` since Adeslas indexes one row per doctor×specialty×subheading. ~72k docs for `md_id=1` (general) in ~100s at 250ms throttle.
- **`scrape-adeslas.ts`**: standalone script wrapping the above, writes `data/adeslas-raw.json`.
- **`build-doctors.ts`**: maps `adeslas-raw.json` (RawDoctor shape) → `data/doctors.json` (canonical Doctor) + regenerates `data/doctors.ts` as a thin typed re-export of that JSON. Splitting JSON from TS avoids a 70k-entry TS literal that would blow up the bundler.
- **Legacy (`sources/doctoralia.ts` + `sources/googlemaps.ts` + `scrape.ts` + `merge.ts`)**: cheerio/axios + Playwright pipeline left in place for future enrichment (ratings/reviews, since Adeslas data has `rating=0` / `numReviews=0`). Not currently consumed by `data/doctors.json`.

### Shared concerns
- `@/` path alias → repo root (see `tsconfig.json`).
- CP → coordinates mapping and Haversine live in `lib/coordinates.ts`.
- `DoctorCard` consumes the canonical `Doctor` type directly.
- `data/adeslas-raw.json` and `data/doctors.json` are checked in: they ARE the dataset the UI ships with, so the site works without a build-time scrape.

## Adding a new mutua

1. Open its "cuadro médico" page in Chrome DevTools and inspect XHRs; most Spanish insurers have a public SPA with a reachable search API (`reference_adeslas_api.md` in memory covers the Adeslas playbook).
2. Create `scraper/sources/<mutua>.ts` exporting `scrape<Mutua>(): Promise<RawDoctor[]>`. Use `source: "<mutua>"` in the output.
3. Wire it into `build-doctors.ts` (concat with Adeslas, dedupe by name+cp if the same doctor appears in multiple insurers).
4. Move the name in `components/SearchForm.tsx` from `COMING_SOON_MUTUAS` → `AVAILABLE_MUTUAS`.
