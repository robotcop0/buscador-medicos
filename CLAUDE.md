# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server on :3000
- `npm run build` / `npm run start` — production build & serve
- `npm run lint` — Next.js ESLint
- `npm run scrape:adeslas` — pulls ~72k docs from Adeslas' public Elastic App Search into `data/adeslas-raw.json`. Flags: `--all` (adds MUFACE/ISFAS/Senior), `--limit=N` (debug).
- `npm run scrape:occident` — optional offline scrape of Occident (not wired into UI; the UI hits Occident live).
- `npx tsx scraper/build-doctors.ts` — converts raw JSONs → `data/doctors.json` (consumed by UI) + shim `data/doctors.ts`.
- `npm run scrape` / `npm run scrape:doctoralia` / `npm run scrape:google` — legacy Doctoralia+Google pipeline, kept for future cross-source enrichment but not wired into the current UI.

No test runner is configured.

## Architecture

Next.js 14 App Router + TypeScript + Tailwind. Two data paths converge at search time:

- **Offline path** (Adeslas): scraper → `data/doctors.json` (+ `doctors.ts` shim) → static filter → UI.
- **Live path** (Occident): `lib/sources/<mutua>.ts` hits the mutua's public API from the server at request time and merges with the offline dataset.

No live LLM calls at query time — Claude/AI is reserved for a future result-presentation step (not scraping, not searching).

### Types (`lib/types.ts`)
Single canonical `Doctor` type used everywhere (UI, search, scraper output, live clients). `telefono` and `distanceKm` are optional — scrapers/live clients populate `telefono`, `distanceKm` is computed per-query from CP.

### Search (`lib/doctorSearch.ts` → `lib/search.ts`)
`findDoctors()` is the single entry point and is **async**. It delegates to `filterDoctors()` which:
1. Filters `data/doctors.ts` offline by mutua/especialidad.
2. If the selected mutua has a live client (or no mutua is selected) and `especialidad` is present, kicks off that client in parallel.
3. Applies Haversine/province geo-filter (`lib/coordinates.ts`) to both sets and merges.

Especialidad uses **accent-insensitive partial match** so the UI dropdown ("Cardiología") matches subspecialties ("Cardiología Infantil", "Cirugía General Y Del Aparato Digestivo", etc.). When `maxKm` is absent, falls back to province match (`cp.slice(0,2)`). Sort: rating desc, then numReviews desc.

Live clients (e.g. `lib/sources/occident.ts`) cache token + taxonomy in module memory, never throw (return `[]` on error) so a live source failing doesn't break the offline results.

### Results page (`app/resultados/page.tsx`)
Server component. Paginates 20 results/page via `?page=N`, preserving all other filters in the href helper. `totalFound` vs `pageResults.length` drives "Mostrando X–Y" caption. Component-level `Pagination` / `PageLink` / `buildPageList` render the 1 · 2 · … · N control.

### Search form (`components/SearchForm.tsx`)
Custom `Combobox` (not native `<select>`) with internal search, 5-row scroll, and disabled state for "En desarrollo" mutuas. `AVAILABLE_MUTUAS` currently = `["Adeslas", "Occidente"]`; everything else rendered with an amber construction icon and badge.

### Scraper (`scraper/`)
Standalone `tsx` pipeline, not part of the Next build.

- **`sources/adeslas.ts`** (primary offline source): hits Adeslas' public Elastic App Search (`https://sca-cm-prod.ent.westeurope.azure.elastic-cloud.com/api/as/v1/engines/cm-pre/elasticsearch/_search`) with the Bearer token that the web client itself exposes. Paginates via `search_after` on `id_doc`. Dedup by `nombre::cp::especialidad`. ~72k docs for `md_id=1` in ~100s at 250ms throttle.
- **`sources/occident.ts`** + **`scrape-occident.ts`**: optional offline scraper (concurrency=8, iterates especialidad×provincia). Not currently consumed by the UI, which prefers `lib/sources/occident.ts` live.
- **`scrape-adeslas.ts`**, **`scrape-occident.ts`**: standalone wrappers that write `data/<mutua>-raw.json`.
- **`build-doctors.ts`**: merges every `data/<mutua>-raw.json` into canonical `data/doctors.json` + `doctors.ts` shim. Dedups by `normalize(nombre) + cp + especialidad`, fusing mutuas on collision.
- **Legacy (`sources/doctoralia.ts` + `sources/googlemaps.ts` + `scrape.ts` + `merge.ts`)**: cheerio/axios + Playwright pipeline left in place for future enrichment (ratings/reviews). Not consumed.

### Shared concerns
- `@/` path alias → repo root (see `tsconfig.json`).
- CP → coordinates mapping and Haversine live in `lib/coordinates.ts`.
- `DoctorCard` consumes the canonical `Doctor` type directly.
- `data/adeslas-raw.json` and `data/doctors.json` are checked in: they ARE the dataset the UI ships with.

## Methodology — adding a new mutua

Every Spanish insurer has the same shape of problem: a public SPA at `<insurer>.com/cuadro-medico` that calls a JSON API. Follow this playbook.

### Step 1 — Investigate with chrome-devtools MCP

Use the `mcp__chrome-devtools__*` tools (never Playwright/Puppeteer scripting for this):

1. `new_page` / `navigate_page` to the public "cuadro médico" URL.
2. Fill the form (`fill`, `click`) with a real CP and specialty to trigger the search. Accept cookies first.
3. `list_network_requests` with `resourceTypes: ["xhr", "fetch"]` — look for the domain-specific backend (`*.elastic-cloud.com`, `pxysvc/proxy/...`, `api.<insurer>.com`, etc.). Ignore analytics noise.
4. `get_network_request` on the hit. Capture: URL pattern, auth header, query params.
5. If auth is a token, find where it comes from: usually a sibling request to `/token.txt`, a config JSON (`/assets/config/*.json`), or hardcoded in a JS bundle. Use `evaluate_script` with `fetch()` to read the bundle and grep for `engine`, `index`, `api`, `token`, etc.
6. Verify by calling the endpoint from the page's JS context (`evaluate_script` → `fetch` with the token) with a minimal query that returns results.
7. Save findings to a memory file: `reference_<mutua>_api.md` with endpoint URL, auth mechanism, relevant query params, and the shape of one response record. Add a line to `MEMORY.md`.

### Step 2 — Decide offline vs live

| Choose offline scrape when…                          | Choose live query when…                       |
|-------------------------------------------------------|-----------------------------------------------|
| Dataset is massive (≥10k) and relatively stable       | Dataset is small per query and volatile       |
| API has cursor/`search_after` pagination              | API requires filters (CP+especialidad) anyway |
| You want sub-ms search (already in `doctors.json`)    | Per-query latency <1s is acceptable           |
| Token is static or rarely rotates                     | Token is rotating or cheap to refresh         |

Adeslas = offline (446k docs, stable Elastic). Occident = live (API needs CP+especialidad, JWT rotates hourly).

### Step 3a — If offline

1. Create `scraper/sources/<mutua>.ts` exporting `scrape<Mutua>(opts): Promise<RawDoctor[]>`. Set `source: "<mutua>"` in the output.
2. Create `scraper/scrape-<mutua>.ts` that writes `data/<mutua>-raw.json`.
3. Add a `scrape:<mutua>` npm script.
4. Add `{ path: "../data/<mutua>-raw.json", mutua: "<Name>" }` to `SOURCES` in `scraper/build-doctors.ts`.
5. Run `npm run scrape:<mutua>` then `npx tsx scraper/build-doctors.ts`.

### Step 3b — If live

1. Create `lib/sources/<mutua>.ts` exporting `search<Mutua>(cp, especialidad): Promise<Doctor[]>`. Cache token + taxonomy in module-level variables. Return `[]` on any error (never throw — don't break the offline results).
2. In `lib/search.ts`, add a branch that calls your function in parallel when the mutua filter is empty or matches. Use offset IDs (`100_000_000 + i` per mutua) to avoid collisions with the offline dataset.

### Step 4 — Expose it in the UI

In `components/SearchForm.tsx`, move the mutua name from `COMING_SOON_MUTUAS` → `AVAILABLE_MUTUAS`. No other UI changes needed — the combobox and filter chain auto-pick it up.

### Step 5 — Verify

Start `npm run dev`, navigate to `/resultados?mutua=<Name>&especialidad=Cardiología&cp=28001`, confirm at least one result and that the mutua badge is correct.
