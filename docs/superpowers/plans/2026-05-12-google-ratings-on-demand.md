# Ratings de Google Maps on-demand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el enriquecimiento de centros con ratings de Google Maps de SSR-blocking global a fetch on-demand desde el cliente, con reorden de las cards visibles cuando llegan los ratings.

**Architecture:** El SSR (`lib/search.ts`) deja de llamar al sidecar Python y ordena solo con lo cacheado en `data/google-ratings.json` → carga instantánea. Un nuevo client component `components/ResultsList.tsx` (que envuelve las 20 cards de la página actual) dispara `/api/google-rating` para los centros sin rating, muestra un pill esqueleto mientras tanto, rellena los pills a medida que llegan y, cuando todos resuelven, reordena las 20 cards con `sortByRating`. `DoctorCard` pasa a client component y acepta una prop `loading`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, React client components (`useState`/`useEffect`).

> **Nota sobre testing:** este repo **no tiene test runner** (ver `CLAUDE.md` → "No test runner is configured"). En lugar de tests automáticos, la "verificación" de cada tarea es: `npm run build` (typecheck + compilación) + `npm run lint` + una comprobación manual en el navegador descrita en la tarea. No inventes ni añadas un framework de tests.

> **Referencia útil:** el spec completo está en `docs/superpowers/specs/2026-05-12-google-ratings-on-demand-design.md` (edge cases y limitaciones conocidas).

---

## File Structure

- `lib/search.ts` — **modificar**: quitar la etapa `enrichCentrosLive`. Único responsable: filtrar/mergear/ordenar resultados server-side.
- `lib/google-live-enrich.ts` — **borrar**: queda sin uso.
- `components/ResultsList.tsx` — **crear**: client component dueño del array de las 20 cards visibles; orquesta el fetch on-demand de ratings de Google y el reorden.
- `components/DoctorCard.tsx` — **modificar**: `"use client"` + prop `loading?: boolean` + pill esqueleto. Único responsable: render de una card de médico/centro (presentacional).
- `app/resultados/page.tsx` — **modificar**: usar `<ResultsList>` en vez de `pageResults.map(<DoctorCard>)`; quitar el import de `DoctorCard`; actualizar comentarios obsoletos.
- `CLAUDE.md` — **modificar**: reescribir los puntos 5 y 6 de la sección "Google Maps (centros)".

---

## Task 1: Quitar `enrichCentrosLive` del path server-side

**Files:**
- Modify: `lib/search.ts`
- Delete: `lib/google-live-enrich.ts`

- [ ] **Step 1: Editar `lib/search.ts`**

Quitar la línea de import (actualmente línea 21):

```ts
import { enrichCentrosLive } from "@/lib/google-live-enrich";
```

Y reemplazar el bloque final de `filterDoctors` (actualmente líneas ~132-151, desde `const enriched = merged` hasta el cierre `}` de la función) por:

```ts
  const enriched = merged
    .map(enrichWithDoctoralia)
    .map(enrichWithGoogle)
    .map(mergeRatings);

  // Los ratings de Google de los centros que falten se resuelven on-demand
  // desde el cliente (`components/ResultsList.tsx` → `/api/google-rating`).
  // Aquí solo ordenamos con lo que haya cacheado en `data/google-ratings.json`.
  return sortByRating(enriched);
}
```

(No toques los imports `enrichWithDoctoralia`, `enrichWithGoogle`, `mergeRatings`, `sortByRating` — siguen en uso.)

- [ ] **Step 2: Borrar el fichero muerto**

```bash
git rm lib/google-live-enrich.ts
```

- [ ] **Step 3: Verificar que no queda ninguna referencia**

Run: `grep -rn "enrichCentrosLive\|google-live-enrich" --include="*.ts" --include="*.tsx" .`
Expected: solo aparece (si acaso) en `docs/` y en comentarios de `app/resultados/page.tsx` (esos comentarios se arreglan en la Task 4). En `lib/`, `components/` y código real: **sin resultados**.

- [ ] **Step 4: Compilar**

Run: `npm run build`
Expected: build OK, sin errores de TypeScript.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add lib/search.ts
git commit -m "Quita el enriquecimiento SSR-blocking de centros con Google Maps"
```

(El `git rm` del Step 2 ya stageó el borrado; entra en este mismo commit.)

---

## Task 2: `DoctorCard` → client component con prop `loading` y pill esqueleto

**Files:**
- Modify: `components/DoctorCard.tsx`

- [ ] **Step 1: Añadir `"use client"` y la prop `loading`**

En la primera línea del fichero, antes de los imports, añadir:

```tsx
"use client";
```

En el tipo `Props`, añadir `loading`:

```tsx
type Props = {
  doctor: Doctor;
  searchCp?: string;
  loading?: boolean;
};
```

En la firma del componente, desestructurar `loading`:

```tsx
export default function DoctorCard({ doctor, searchCp, loading }: Props) {
```

- [ ] **Step 2: Actualizar el comentario obsoleto**

Reemplazar el comentario que dice (actualmente líneas ~32-33):

```tsx
  // El SSR ya resolvió todos los ratings (Doctoralia + Google) vía
  // `enrichCentrosLive` en `app/resultados/page.tsx`. El card solo lee.
```

por:

```tsx
  // El rating de Doctoralia y los de Google ya cacheados los resuelve el SSR;
  // los de Google que falten los rellena `ResultsList` on-demand y nos llega
  // `loading` mientras tanto. El card solo lee y pinta.
```

- [ ] **Step 3: Añadir el branch del pill esqueleto**

En el bloque "Rating" (el `<div className="flex-shrink-0 text-right">`), el `else` final actualmente es:

```tsx
          ) : (
            <span
              title="Este médico aún no tiene reseñas en nuestras fuentes"
              className="text-[11px] text-gray-400 italic whitespace-nowrap"
            >
              Sin valoraciones
            </span>
          )}
```

Reemplazarlo por:

```tsx
          ) : loading ? (
            <span
              aria-hidden="true"
              title="Buscando valoración…"
              className="inline-block h-6 w-14 rounded-full bg-gray-100 animate-pulse"
            />
          ) : (
            <span
              title="Este médico aún no tiene reseñas en nuestras fuentes"
              className="text-[11px] text-gray-400 italic whitespace-nowrap"
            >
              Sin valoraciones
            </span>
          )}
```

- [ ] **Step 4: Compilar**

Run: `npm run build`
Expected: build OK. (En este punto `page.tsx` aún renderiza `<DoctorCard>` sin `loading`, así que `loading` es `undefined` y el comportamiento es idéntico al actual.)

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 6: Comprobación manual rápida**

Con `npm run dev` arrancado, abrir `/resultados?mutua=Occidente&especialidad=Otorrinolaringología&cp=08402&radio=2` y confirmar que la página sigue funcionando igual que antes de la tarea (centros sin rating cacheado muestran "Sin valoraciones").

- [ ] **Step 7: Commit**

```bash
git add components/DoctorCard.tsx
git commit -m "DoctorCard: client component + prop loading con pill esqueleto"
```

---

## Task 3: Crear `components/ResultsList.tsx`

**Files:**
- Create: `components/ResultsList.tsx`

- [ ] **Step 1: Crear el fichero con este contenido exacto**

```tsx
"use client";

/**
 * Lista de resultados con enriquecimiento on-demand de ratings de Google Maps
 * para centros.
 *
 * El SSR (`lib/search.ts`) ya ordenó el listado usando solo lo cacheado en
 * `data/google-ratings.json`. Aquí, en cliente, para cada centro que aún no
 * tiene rating disparamos `/api/google-rating` (que a su vez consulta el
 * sidecar Python y persiste el hit en la cache). Mientras la petición está en
 * vuelo, la card muestra un pill esqueleto (`loading`). Cuando llega un hit,
 * mergeamos el rating de Google con el que hubiera (Doctoralia) vía
 * `mergeRatings`. Cuando TODAS las peticiones han resuelto, reordenamos las
 * cards visibles una sola vez con `sortByRating`.
 *
 * Limitaciones conocidas (ver el spec): el reorden solo baraja las 20 cards de
 * la página actual (la paginación es server-side), y `sortByRating` recalcula
 * el prior bayesiano sobre esas 20 → el color de algún pill puede variar de
 * forma casi imperceptible. En la segunda visita todo está cacheado y el SSR
 * lo coloca/colorea bien a nivel global.
 */
import { useEffect, useState } from "react";
import type { Doctor } from "@/lib/types";
import DoctorCard from "@/components/DoctorCard";
import { isCenter } from "@/lib/center";
import { sortByRating } from "@/lib/ratings-sort";
import { mergeRatings } from "@/lib/ratings-merge";

type DoctorWithStatus = Doctor & { googleStatus?: "loading" | "done" };

type Props = {
  doctors: Doctor[];
  searchCp?: string;
};

type GoogleRatingResponse = {
  rating: number;
  numReviews: number;
  placeId: string;
  source: "cache" | "live" | "miss";
};

// Red de seguridad sobre el timeout interno de /api/google-rating (15 s al
// sidecar): si la ruta se cuelga, no dejamos la card con el esqueleto eterno.
const FETCH_TIMEOUT_MS = 16_000;

async function fetchGoogleRating(
  d: Doctor,
  signal: AbortSignal
): Promise<GoogleRatingResponse | null> {
  const qs = new URLSearchParams({
    nombre: d.nombre,
    cp: d.cp,
    ciudad: d.ciudad ?? "",
  }).toString();
  try {
    const res = await fetch(`/api/google-rating?${qs}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as GoogleRatingResponse;
  } catch {
    // abort / red / json inválido
    return null;
  }
}

export default function ResultsList({ doctors, searchCp }: Props) {
  const [list, setList] = useState<DoctorWithStatus[]>(() =>
    doctors.map((d) =>
      isCenter(d.nombre) && d.rating === 0
        ? { ...d, googleStatus: "loading" as const }
        : d
    )
  );

  useEffect(() => {
    const pending = doctors.filter((d) => isCenter(d.nombre) && d.rating === 0);
    if (pending.length === 0) return;

    let cancelled = false;
    const controllers: AbortController[] = [];

    async function run() {
      await Promise.allSettled(
        pending.map(async (d) => {
          const controller = new AbortController();
          controllers.push(controller);
          const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          const resp = await fetchGoogleRating(d, controller.signal);
          clearTimeout(timer);
          if (cancelled) return;
          setList((prev) =>
            prev.map((item) => {
              if (item.id !== d.id) return item;
              if (resp && resp.rating > 0) {
                const merged = mergeRatings({
                  ...item,
                  googleRating: resp.rating,
                  googleNumReviews: resp.numReviews,
                  googlePlaceId: resp.placeId,
                });
                return { ...merged, googleStatus: "done" as const };
              }
              return { ...item, googleStatus: "done" as const };
            })
          );
        })
      );
      if (cancelled) return;
      // Todas resueltas → una sola reordenación de las cards visibles.
      setList((prev) => sortByRating(prev) as DoctorWithStatus[]);
    }

    run();

    return () => {
      cancelled = true;
      for (const c of controllers) c.abort();
    };
    // Solo al montar: `doctors` es la prop del SSR y no cambia sin navegación
    // (que remonta el componente).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-label="Médicos encontrados"
      className="bg-white rounded-2xl border border-gray-200 px-4 sm:px-6 animate-fade-up"
    >
      {list.map((d) => (
        <DoctorCard
          key={d.id}
          doctor={d}
          searchCp={searchCp}
          loading={d.googleStatus === "loading"}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Compilar**

Run: `npm run build`
Expected: build OK, sin errores de TypeScript. (El componente aún no se usa en ninguna parte; solo comprobamos que compila.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add components/ResultsList.tsx
git commit -m "Añade ResultsList: enriquecimiento on-demand de ratings Google + reorden cliente"
```

---

## Task 4: Conectar `<ResultsList>` en la página de resultados

**Files:**
- Modify: `app/resultados/page.tsx`

- [ ] **Step 1: Cambiar el import**

En `app/resultados/page.tsx`, reemplazar:

```tsx
import DoctorCard from "@/components/DoctorCard";
```

por:

```tsx
import ResultsList from "@/components/ResultsList";
```

- [ ] **Step 2: Actualizar el comentario obsoleto sobre `enrichCentrosLive`**

Reemplazar el comentario que dice (actualmente líneas ~57-59):

```tsx
      // `findDoctors` ya hace el enriquecimiento live de TODOS los centros
      // (no solo los de la página) y ordena globalmente antes de devolver.
      // Aquí nos limitamos a paginar.
```

por:

```tsx
      // `findDoctors` ordena el listado (valorados primero) usando solo los
      // ratings de Google cacheados; los que falten los rellena `ResultsList`
      // on-demand en cliente. Aquí nos limitamos a paginar.
```

- [ ] **Step 3: Reemplazar el `<section>` de cards por `<ResultsList>`**

Localizar el bloque (actualmente líneas ~174-181):

```tsx
                <section
                  aria-label="Médicos encontrados"
                  className="bg-white rounded-2xl border border-gray-200 px-4 sm:px-6 animate-fade-up"
                >
                  {pageResults.map((doctor) => (
                    <DoctorCard key={doctor.id} doctor={doctor} searchCp={cp} />
                  ))}
                </section>
```

Reemplazarlo por:

```tsx
                <ResultsList doctors={pageResults} searchCp={cp} />
```

(El `<Pagination>` que va justo después se queda tal cual; sigue siendo server-side.)

- [ ] **Step 4: Compilar**

Run: `npm run build`
Expected: build OK. No debe quedar ningún uso de `DoctorCard` en `page.tsx` (si lo hubiera, el build fallaría por import eliminado).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 6: Comprobación manual — sidecar caído**

Con `npm run dev` arrancado y **sin** `npm run dev:gmaps` (sidecar caído), abrir `/resultados?mutua=Occidente&especialidad=Otorrinolaringología&cp=08402&radio=2`:
- La página carga al instante (sin esperar ~10-15 s).
- Las cards de centros sin rating muestran un instante el pill esqueleto pulsante y luego caen a "Sin valoraciones".
- La paginación funciona; navegar a `?page=2` también.

- [ ] **Step 7: Comprobación manual — sidecar arriba (si está disponible)**

Si el repo `../google-maps-scraper` está clonado: arrancar `npm run dev:gmaps`, esperar al warmup, recargar la misma URL:
- Carga instantánea; esqueletos en centros.
- Los pills van apareciendo a medida que llegan los ratings; al terminar, las cards se reordenan una vez (valorados arriba).
- `data/google-ratings.json` ahora contiene entradas de Granollers (`grep -i granollers data/google-ratings.json` devuelve líneas).
- Recargar de nuevo: los pills salen ya desde el SSR, sin esqueletos, orden estable.
- Abrir "Ver reseñas" en un centro que recibió rating on-demand → carga las reseñas (usa el `placeId` del fetch).

Si el repo del scraper **no** está clonado, anota que este step queda pendiente de verificar y continúa (el comportamiento con sidecar caído del Step 6 es la garantía mínima).

- [ ] **Step 8: Commit**

```bash
git add app/resultados/page.tsx
git commit -m "Página de resultados: usa ResultsList (ratings Google on-demand)"
```

---

## Task 5: Actualizar `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Reescribir el punto 5 de la sección "Google Maps (centros)"**

Localizar el punto que empieza por `5. **Enriquecimiento SSR-blocking global**` y reemplazar ese punto entero por:

```markdown
5. **Enriquecimiento on-demand en cliente** (`components/ResultsList.tsx`): el SSR (`lib/search.ts`) ya **no** llama al sidecar — ordena el listado usando solo lo que haya en `data/google-ratings.json` (vía `enrichWithGoogle`), así la página de resultados carga al instante. `ResultsList` es un client component que envuelve las 20 cards de la página actual: al montar, para cada centro sin rating dispara `GET /api/google-rating?nombre=&cp=&ciudad=` (que consulta el sidecar y persiste el hit), muestra un pill esqueleto mientras tanto (`DoctorCard` prop `loading`), rellena los pills a medida que llegan (mergeando Google+Doctoralia con `mergeRatings`) y, cuando todas las peticiones han resuelto, reordena las 20 cards una sola vez con `sortByRating`. El navegador limita a ~6 conexiones/origen, así que no hay throttling extra; cada fetch tiene un timeout cliente de 16 s sobre el de la ruta. Coste de hacerlo on-demand: en la primera visita a una zona "fría" el orden es best-effort (un centro de la página 2 que recibe rating sube dentro de la página 2, no salta a la 1) y el color del pill se recalcula con el prior bayesiano de esas 20 cards; en la segunda visita ya está todo cacheado y el SSR lo coloca/colorea bien a nivel global. Si el sidecar está caído, las cards de centros caen a "Sin valoraciones" tras un parpadeo del esqueleto, sin bloquear nada.
```

- [ ] **Step 2: Ajustar el punto 6 (loading.tsx)**

Localizar el punto `6. **Loading UI** (`app/resultados/loading.tsx`)` y reemplazar la frase "streaming fallback de Next mientras el SSR bloquea" por "streaming fallback de Next mientras el SSR resuelve las fuentes live (Occident, etc.)". El resto del punto 6 se mantiene.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Actualiza CLAUDE.md: ratings Google on-demand en cliente"
```

---

## Self-Review (rellenado al escribir el plan)

- **Cobertura del spec:** servidor sin `enrichCentrosLive` → Task 1. Borrado de `lib/google-live-enrich.ts` → Task 1. `ResultsList` (estado, fetch, timeout 16 s, merge, reorden al final) → Task 3. `DoctorCard` client + `loading` + pill esqueleto + comentario → Task 2. `page.tsx` (usa `ResultsList`, quita import `DoctorCard`, comentarios) → Task 4. `CLAUDE.md` puntos 5 y 6 → Task 5. Verificación manual (sidecar caído / arriba / 2ª visita / reseñas / build+lint) → repartida en Tasks 1-4. Limitaciones conocidas → documentadas en el comentario de cabecera de `ResultsList` y en `CLAUDE.md`. ✅ sin huecos.
- **Sin placeholders:** todos los steps de código incluyen el código completo. ✅
- **Consistencia de tipos:** `DoctorWithStatus = Doctor & { googleStatus?: "loading" | "done" }` usado en `ResultsList`; `DoctorCard` prop `loading?: boolean` recibe `d.googleStatus === "loading"`; `GoogleRatingResponse` coincide con lo que devuelve `app/api/google-rating/route.ts` (`{ rating, numReviews, placeId, source }`); `mergeRatings(Doctor): Doctor` y `sortByRating(Doctor[]): Doctor[]` son puros (solo importan el tipo `Doctor`) → usables en client component. ✅
