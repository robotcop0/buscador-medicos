# Cobertura de valoraciones: pre-cocinado offline + fallback al centro

**Fecha:** 2026-06-12
**Estado:** diseño aprobado, pendiente de plan de implementación

## Contexto y problema

Las valoraciones del buscador salen hoy de dos fuentes con arquitecturas opuestas:

- **Doctoralia** (personas / médicos): pre-scrapeado offline a `data/doctoralia-ratings.json` (~45k perfiles, 28.7k con nota), se commitea, despliega bien. Enriquecimiento en runtime vía `enrichWithDoctoralia` (`lib/ratings-index.ts`).
- **Google Maps** (centros / clínicas / hospitales): en vivo bajo demanda vía un sidecar Python local (`scripts/gmaps-sidecar.py`, `:8765`) que el cliente (`components/ResultsList.tsx`) consulta por página. **No despliega** en serverless.

**Cobertura real medida** (Cardiología/Madrid, sidecar incluido):
- Centros: ~19% solo con caché; **~90%** de acierto cuando el sidecar corre.
- Personas: 9-27%. Medido que **el matching no se fuga** (0 de 687 sin-nota estaban en el índice por nombre) → es un **problema de datos**, no de matching.

**Señal del usuario:** médicos buenos y conocidos aparecen sin valoración, sobre todo en **municipios pequeños**. Hipótesis: muchos *sí* están en Doctoralia pero **no los hemos scrapeado** (nuestro índice es un subconjunto); el resto son la cola real de zonas rurales donde las plataformas de reseñas no tienen presencia.

## Objetivo y no-objetivos

**Objetivo:** maximizar la cobertura de valoraciones (que casi ningún resultado salga "Sin valoraciones"), funcionando **en producción / el lanzamiento**, no solo en local.

**No-objetivo (realidad aceptada):** el 100% **no es alcanzable solo con reseñas reales**. Las plataformas (Doctoralia, Google) están sesgadas a ciudad; un médico de pueblo a menudo no tiene reseñas en ningún sitio. El residuo se trata con honestidad, no se inventa.

## Enfoque elegido (A): pre-cocinar todo offline + fallback al centro

Unificar las dos fuentes en **un único paso batch offline** que procesa los 68k médicos enteros y escribe ratings en JSON commiteado. Producción **solo lee JSON** — sin sidecar, deploy trivial, cobertura completa (se procesa todo el dataset, no solo lo que cada usuario abre).

```
[batch local, periódico]                          [producción, runtime]
doctors.json (68k)                                 doctors.json
   → resolver Doctoralia (índice)                  + ratings pre-cocinados (JSON)
   → resolver Google (sidecar, throttled)    ──►        ↓
   → resolver fallback-centro                     enrichWith* (solo lee JSON)
   → escribir ratings a JSON commiteado           → merge → sort → UI
```

## Diseño

### 1. Precedencia de fuentes

| Tipo | 1ª opción | 2ª | Fallback | Si nada |
|---|---|---|---|---|
| **Médico (persona)** | **Doctoralia** (mejor dato: reseñas del médico) | Google del médico (si casa nombre) | Nota del **centro** cercano, etiquetada | cola honesta |
| **Centro/gabinete** | **Google** | — | — | cola honesta |
| **Ambos con nota** (centro) | media ponderada por nº reseñas (ya existe en `ratings-merge.ts`) | | | |

Doctoralia nunca lo pisa Google para personas. El fallback-centro es display puro: no se mezcla en la media ni contamina la nota propia del centro.

### 2. El job batch (`scraper/enrich-google-batch.ts`, nuevo)

- **Lógica compartida** `lib/google-resolve.ts` (nuevo): núcleo *query sidecar → validar (`lib/google-match.ts`) → clasificar → persistir*, usado por el batch **y** por la ruta on-demand `app/api/google-rating/route.ts` (que queda como herramienta de refresco local).
- Por cada médico: **skip si ya fresco** (resumible); query según tipo (centro: `nombre + ciudad`; persona: `"Dr/Dra Nombre Apellido especialidad ciudad"`); llamada al sidecar (secuencial/baja concurrencia, ~1-1.5 s); validar + clasificar; persistir a `data/google-ratings.json` con campo nuevo **`kind: "own" | "center"`** (+ `centerName`).
- **Coste:** ~15-19 h secuencial para 68k. Flags: `--resume`, `--only=centers|persons`, `--especialidad=`, `--provincia=`. **Orden por popularidad** (especialidades/provincias más buscadas primero).

### 3. Fallback al centro (proximidad-guarded)

Cuando el batch busca a una persona, Google suele devolver **la clínica**, no a la persona. Se clasifica el resultado:
1. Nombre de Google casa con el médico → `kind: "own"`.
2. No casa el nombre, es un centro (`CENTER_RE`) **y está cerca** del CP del médico (radio normal urbano; **ampliado 15-25 km en CPs rurales**) → `kind: "center"` (fallback).
3. Ni casa ni está cerca → descarta (mejor cola honesta que nota inventada).

**Ranking en 3 tramos** (`lib/ratings-sort.ts`):
1. `kind="own"` → por `rankScore` bayesiano (como hoy).
2. `kind="center"` → por rankScore del centro, **siempre bajo el tramo 1**.
3. Sin nota → distancia ↑ / nombre.

Una nota prestada del centro nunca adelanta a un médico con reseñas propias.

### 4. Modelo de datos y UX

**`lib/types.ts`** — 3 campos nuevos en `Doctor`:
```ts
ratingKind?: "own" | "center";              // por defecto "own"
ratingSource?: "doctoralia" | "google" | "both";
ratingCenterName?: string;                  // solo si kind === "center"
```

**`components/DoctorCard.tsx`** — estados del pill:
- **Nota propia:** número + semáforo verde/ámbar/rojo (como hoy) + subtítulo de procedencia ("Doctoralia · 128 reseñas").
- **Fallback-centro:** pill **gris/atenuado, SIN semáforo** → "Sin valoración propia · Centro La Paz: 3,6★ (Google · 1.901)". Se lee como contexto, no como calidad del médico.
- **Cola honesta:** etiqueta neutra "Aún sin reseñas online" (no "Sin valoraciones"); la card se apoya en especialidad, dirección, teléfono y "cubierto por tu mutua".

**Loading/skeleton:** en producción todo pre-cocinado → sin parpadeo. El estado `loading` de la card y el on-demand de `ResultsList` quedan solo para dev local.

### 5. Deploy a producción

- Producción solo lee JSON commiteado (`doctors.json` + `google-ratings.json` + `doctoralia-ratings.json`). Sin sidecar.
- `next.config.js`: `outputFileTracingIncludes: { "/**": ["./data/*.json"] }` para que los JSON leídos vía `fs` viajen con las funciones.
- Proteger `persistGoogleRating` con try/catch (FS read-only en serverless).

### 6. Refresco

Re-correr `enrich:google` + el scrape de Doctoralia **cada 1-3 meses** en local → commit del JSON. Documentar en `CLAUDE.md`. TTL efectivo del artefacto largo (30-90 días).

## Orden de implementación (verificación PRIMERO)

1. **Verificación del techo (de-risk, primero):** spot-check de ~30 médicos sin nota de municipios pequeños — buscarlos a mano en Doctoralia y Google. Resultado decide la mezcla de palancas:
   - "Están en Doctoralia pero no scrapeados" → **ampliar el scrape de Doctoralia** (palanca primaria, alto rendimiento — coherente con la señal del usuario de médicos buenos sin nota).
   - "No existen en ningún lado" → cola real, se cubre con fallback-centro + cola honesta.
2. Ampliar scrape de Doctoralia según (1).
3. `lib/google-resolve.ts` compartido + refactor de la ruta on-demand.
4. `scraper/enrich-google-batch.ts` + npm script `enrich:google`; primera pasada por popularidad.
5. Fallback-centro: clasificación + campo `kind` + radio rural.
6. `types.ts` / `ratings-merge.ts` / `ratings-sort.ts` (precedencia + 3 tramos).
7. `DoctorCard.tsx`: pill centro + cola honesta.
8. Deploy: `next.config` tracing + guardas FS + doc de refresco en `CLAUDE.md`.

## Ficheros que se tocan

| Acción | Fichero |
|---|---|
| Nuevo | `scraper/enrich-google-batch.ts` |
| Nuevo | `lib/google-resolve.ts` |
| Editar | `lib/types.ts` |
| Editar | `lib/ratings-merge.ts` |
| Editar | `lib/ratings-sort.ts` |
| Editar | `lib/google-ratings-index.ts` (campo `kind`, guarda FS) |
| Editar | `components/DoctorCard.tsx` |
| Editar | `app/api/google-rating/route.ts` |
| Editar | `next.config.js`, `CLAUDE.md` |
| Ampliar | scrape de Doctoralia (`scraper/sources/doctoralia.ts` + scrape script) |

## Riesgos

- **Calidad de matching de personas en Google** (falsos positivos): mitigado con `google-match` + guarda de proximidad. La verificación inicial calibra el umbral.
- **Coste/tiempo del batch** (~15-19 h): mitigado con resume + troceo + orden por popularidad.
- **Cola irreducible** en rural: aceptada; tratada con fallback ampliado + etiqueta honesta. No se promete 100%.
- **Rotación/anti-bot de Google y Doctoralia**: el batch es local y throttled; el refresco periódico absorbe cambios de markup.
