# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server on :3000
- `npm run build` / `npm run start` — production build & serve
- `npm run lint` — Next.js ESLint
- `npm run scrape` — full scraper (Doctoralia + Google Maps), regenerates `data/doctors.ts`
- `npm run scrape:doctoralia` / `npm run scrape:google` — single-source scraping (flag `--only=<source>`)

No test runner is configured.

## Architecture

Next.js 14 App Router + TypeScript + Tailwind. Data flow: **scraper → `data/doctors.ts` → static filter → UI**. No live LLM calls at query time — Claude/AI is reserved for a future result-presentation step (not scraping).

### Types (`lib/types.ts`)
Single canonical `Doctor` type used everywhere (UI, search, scraper output). `telefono` and `distanceKm` are optional — the scraper currently doesn't populate phone, and `distanceKm` is computed per-query.

### Search (`lib/doctorSearch.ts` → `lib/search.ts`)
`findDoctors()` is the single entry point. It delegates to `filterDoctors()` which reads `data/doctors.ts` and filters by mutua/especialidad/CP with Haversine distance via `lib/coordinates.ts`. When `maxKm` is absent, it falls back to province match (`cp.slice(0,2)`). Sort: rating desc, then numReviews desc.

### Scraper (`scraper/`)
Standalone `tsx` pipeline, not part of the Next build. `scrape.ts` orchestrates `sources/doctoralia.ts` (primary, cheerio/axios with 1.2s throttle) and `sources/googlemaps.ts` (Playwright, only for names *not* already in Doctoralia — deduped via normalised `name::ciudad` key). `merge.ts` deduplicates and emits `data/doctors.ts` importing the canonical `Doctor` type. Partial results are persisted to `scraper/cache.json` after each source so a failure in step 2 doesn't lose step 1's work.

### Shared concerns
- `@/` path alias → repo root (see `tsconfig.json`).
- CP → coordinates mapping and Haversine live in `lib/coordinates.ts`.
- `DoctorCard` consumes the canonical `Doctor` type directly.
