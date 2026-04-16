# Enriquecimiento de valoraciones vía Doctoralia

**Fecha**: 2026-04-16
**Estado**: diseño aprobado, pendiente plan de implementación
**Motivación**: 10 de 12 mutuas del catálogo no exponen `rating`/`numReviews` en su API. Se añade Doctoralia como fuente de valoraciones públicas, matcheadas por nombre + especialidad + provincia. Cobertura esperada medida: ~25% de los médicos del dataset tendrán al menos una reseña.

## Alcance

- **Incluido**: scraper bulk offline de Doctoralia, merge contra `doctors.json`, UI con badge enlazado y aviso global.
- **Excluido**: Google Places, scraping live per-request, cron de refresco, fallback para centros médicos/clínicas (tasa de match baja, fuera de scope).

## Arquitectura

Tres componentes independientes:

```
scraper/sources/doctoralia-ratings.ts   # fetch + parse
       ↓
data/doctoralia-ratings.json            # raw output (idempotente)
       ↓
scraper/enrich-ratings.ts               # merge en data/doctors.json
       ↓
components/DoctorCard.tsx               # render badge enlazado
app/resultados/page.tsx                 # aviso global
```

El scraper NO toca `doctors.json`; escribe su propio JSON. El merger lee ambos y enriquece `doctors.json` in-place. Así cada pieza es testeable por separado y el scrape puede re-correrse sin romper el dataset canonical.

## Componente 1 — Scraper Doctoralia

**Fichero**: `scraper/sources/doctoralia-ratings.ts`
**Entry point CLI**: `scraper/scrape-doctoralia-ratings.ts` (registrado como `npm run scrape:doctoralia`)
**Output**: `data/doctoralia-ratings.json`

### Estrategia

Itera **especialidad × provincia** sobre URLs canonical:

```
https://www.doctoralia.es/<especialidad-slug>/<provincia-slug>?page=<n>
```

- Especialidades: las 33 del combo en `components/SearchForm.tsx` (constante `ESPECIALIDADES`).
- Provincias: las 52 provincias españolas (ya hay mapeo CP→provincia en `lib/coordinates.ts`).
- Pagina hasta que una página devuelva 0 resultados, con tope de seguridad de 20 páginas.
- Delay `250ms` entre requests. Sin paralelismo entre iteraciones (evita pico de tráfico sostenido).

### Taxonomía de slugs

Doctoralia usa slugs singulares-masculinos (`cardiologo`, `dermatologo`). Se define un mapa `ESPECIALIDAD → slug_doctoralia` en el propio fichero del scraper. Casos edge documentados: `Odontología → dentista`, `Medicina general → medico-de-cabecera`, `Medicina estética → medico-estetica`.

### Parseo por card

Por cada `[data-id='result-item']` extrae:

```ts
{
  entityId: string,            // data-eec-entity-id (ID estable Doctoralia)
  url: string,                 // data-doctor-url
  name: string,                // data-doctor-name, con prefijo Dr./Dra.
  especialidadDoctoralia: string, // data-eec-specialization-name
  especialidadCanonical: string,  // mapeo inverso al valor del combo
  provincia: string,              // derivado del slug de provincia iterado
  cities: string[],               // [itemprop=addressLocality][content]
  streets: string[],              // [itemprop=streetAddress][content]
  rating: number,                 // data-eec-stars-rating (0 si no aplica)
  numReviews: number              // data-eec-opinions-count
}
```

### Deduplicación

Clave: `entityId`. Si el mismo profesional aparece en varias páginas/provincias (médicos con múltiples consultas), se fusionan: `cities` y `streets` se concatenan deduplicados; se queda con el `rating`/`numReviews` de la primera aparición (son los mismos, es per-profesional no per-consulta).

### Estimación de volumen

- 33 especialidades × ~52 provincias × ~5 páginas × 12 resultados ≈ 100k fetches → deduplicado ~15-30k profesionales únicos.
- Latencia observada por fetch: ~144ms. Con delay 250ms serial → ~25-35 min de scrape.
- Tamaño output estimado: 3-6 MB JSON.

### Robustez

- HTTP 403/429: backoff exponencial 5s/15s/30s, abandona tras 3 fallos consecutivos en la misma combinación esp×prov.
- HTML sin cards: loggea y sigue. No romper por una página vacía.
- Idempotencia: puede re-correrse; re-sobrescribe el output completo.

## Componente 2 — Merger

**Fichero**: `scraper/enrich-ratings.ts` (CLI standalone, `npx tsx scraper/enrich-ratings.ts`)
**Input**: `data/doctors.json` + `data/doctoralia-ratings.json`
**Output**: `data/doctors.json` actualizado in-place + `data/doctors.ts` shim regenerado

### Algoritmo de matching

Para cada `Doctor` de `doctors.json` **donde `rating === 0`** (no pisar Sanitas/DKV):

1. Construye candidates = doctoralia-ratings filtrados por:
   - `especialidadCanonical === doctor.especialidad` (match exacto)
   - `provincia` coincide con la derivada de `doctor.cp.slice(0,2)`
2. Scorea cada candidato por `jaccard(tokens(doctor.nombre), tokens(candidate.name))` tras normalizar (remover `Dr./Dra.`, acentos, caracteres no alfanuméricos).
3. Toma el mejor. Si `score < 0.5` → no match, deja rating=0.
4. Si hay **empate** en score ≥ 0.5 → desempata por coincidencia de tokens entre `doctor.direccion` y cualquier `candidate.streets[i]`. Si sigue empate → deja rating=0 (conservador; preferimos no-rating a rating incorrecto).
5. Asigna `rating`, `numReviews`, y un nuevo campo **`doctoraliaUrl`** (URL del perfil).

### Propagación a múltiples consultas

El mismo doctor puede tener varios registros en `doctors.json` (distinta consulta/CP). Una vez hecho el match para uno, los demás registros con el mismo `normalize(nombre) + especialidad` heredan el mismo rating+url.

### Logging

Reporta al final:
- total procesados
- matcheados (`rating > 0` aplicado)
- no matcheados (dejados en 0)
- desempates descartados (stat de calidad)

## Componente 3 — Tipos

**Fichero**: `lib/types.ts`

Añade campo opcional:

```ts
export type Doctor = {
  ...
  rating: number;
  numReviews: number;
  doctoraliaUrl?: string;     // ← nuevo
  distanceKm?: number | null;
};
```

Opcional porque solo se llena para los matcheados. El build del dataset lo omite cuando no aplica.

## Componente 4 — UI

### `components/DoctorCard.tsx`

Hoy: `{doctor.rating > 0 && <badge>}`
Cambio:

- Si `rating > 0`: el badge sigue como hoy **pero envuelto en `<a href={doctoraliaUrl} target="_blank" rel="noopener noreferrer">`** con `title="Ver perfil en Doctoralia"`. Hover sutil (underline o ligero cambio de borde).
- Si `rating === 0`: badge gris claro con un guión `—` y tooltip "Sin valoraciones disponibles". Ocupa el mismo espacio (evita que las cards salten).

### `app/resultados/page.tsx`

Encima del listado, bajo los chips de filtros, un aviso discreto en gris:

> *Las valoraciones provienen de Doctoralia. El matcheo por nombre y provincia puede no ser 100% exacto.*

Texto fijo, sin dismissible. Tamaño `text-xs text-gray-400`. Una sola línea.

## Data flow end-to-end

1. `npm run scrape:doctoralia` → genera `data/doctoralia-ratings.json` (~25 min, una vez)
2. `npx tsx scraper/enrich-ratings.ts` → merge en `data/doctors.json`
3. `npm run dev` → UI ya refleja ratings + link Doctoralia + aviso global

No hay nada live: `lib/search.ts` no cambia, `lib/sources/*.ts` no cambia. Todo el trabajo ocurre en build-time.

## Qué puede salir mal (y mitigación)

| Riesgo | Mitigación |
|---|---|
| Doctoralia cambia HTML | El parseo se aísla en `doctoralia-ratings.ts`; un cambio obliga a actualizar ese fichero solo. |
| Falsos positivos en match (rating incorrecto atribuido) | Umbral Jaccard 0.5 + match estricto de especialidad + desempate por calle + descarte conservador si sigue habiendo ambigüedad. El aviso global cubre lo residual. |
| Centros médicos reciben rating de un doctor con nombre similar | El filtro `^(Centro|Clinica|Policlinic|Hospital|...)` del nombre en el merger descarta esos registros del matching. |
| Cloudflare baneo durante el scrape | Delay 250ms + backoff 5s/15s/30s. Si persiste, abandonar y retomar más tarde (el output es incremental a nivel esp×prov). |

## Testing (manual, no hay test runner)

1. Ejecutar `npm run scrape:doctoralia` con flag `--limit=2` (limitar a 2 especialidades) para smoke test en <2 min.
2. Ejecutar merger y verificar contadores en stdout: matcheados debería ser >10% del dataset (era 25% en la muestra).
3. `npm run dev`; buscar `Adeslas + Alergología + 08024` y confirmar:
   - Magdalena Lluch Pérez muestra rating (si Doctoralia ya tuviera reviews) o "—"
   - Click en el badge con rating abre `doctoralia.es/magdalena-lluch-perez/...` en nueva pestaña
   - Aviso "Las valoraciones provienen de Doctoralia..." visible arriba

## Orden de commits sugerido

1. Nuevo campo `doctoraliaUrl?` en `lib/types.ts` + badge con link y estado "sin valoraciones" en `DoctorCard.tsx` + aviso en `resultados/page.tsx`. (UI lista para recibir datos aunque aún no haya).
2. Scraper `doctoralia-ratings.ts` + script `scrape-doctoralia-ratings.ts` + npm script.
3. Merger `enrich-ratings.ts`.
4. Ejecución real + commit de `data/doctoralia-ratings.json` y `data/doctors.json` actualizados.
