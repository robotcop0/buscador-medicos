# Ratings de Google Maps on-demand (enfoque híbrido + reorden en cliente)

Fecha: 2026-05-12

## Problema

Hoy `lib/search.ts` enriquece **todos** los centros del listado con ratings de
Google Maps de forma **SSR-blocking** (`enrichCentrosLive`): en la primera visita
a una zona "fría" (centros aún no cacheados en `data/google-ratings.json`) el
servidor llama al sidecar Python para cada centro y la página tarda ~10-15 s en
renderizar. Además, si el sidecar no está arriba, la página igual paga ese coste
de timeout antes de mostrar "Sin valoraciones".

Objetivo: que la página de resultados cargue **instantánea** y que los ratings de
Google se resuelvan **on-demand desde el cliente**, aceptando un orden "best
effort" en la primera visita a una zona fría (en la segunda visita ya está
cacheado y el orden es correcto).

## Decisión de diseño

Enfoque **híbrido (B)** con **reorden dentro de la página en cliente**:

- El **SSR** ordena usando solo lo que hay en cache (`enrichWithGoogle` lee
  `data/google-ratings.json`) → instantáneo. Los centros cacheados salen con su
  pill y en su posición correcta; el resto sale en el bloque "no valorados".
- El **cliente** (un nuevo componente `<ResultsList>` que posee el array de las
  20 cards visibles) dispara `/api/google-rating` para los centros sin rating, va
  rellenando los pills sobre un esqueleto, y al terminar **reordena las 20 cards**.

Dentro de "B" había dos sub-arquitecturas: (1) un slot autocontenido por card que
se busca su propio rating, o (2) un componente padre que posee el array. Como se
quiere **reordenar**, hace falta (2): solo el padre puede reordenar.

Alternativas descartadas: on-demand puro en cliente sin reorden (rompe el orden
incluso en visitas con todo cacheado); dejarlo como está (la primera carga sigue
lenta y el SSR queda atado a tener el sidecar vivo); precomputar offline a un JSON
estático (no aplica a la fuente live Occident; se deja como follow-up opcional).

## Arquitectura y flujo de datos

### Servidor

`lib/search.ts` — se elimina `enrichCentrosLive` del path. La cadena queda:

```
merge fuentes → enrichWithDoctoralia → enrichWithGoogle (lee cache) → mergeRatings → sortByRating
```

El SSR ya no llama al sidecar → primera carga instantánea (solo latencia de
fuentes live tipo Occident, <1 s).

`app/resultados/page.tsx` — deja de hacer `pageResults.map(<DoctorCard>)` y pasa a
renderizar `<ResultsList doctors={pageResults} searchCp={cp} />`. La `<section>`
con `animate-fade-up` que envuelve las cards se mueve dentro de `ResultsList`.
Se actualizan los comentarios que mencionan `enrichCentrosLive`.

### Cliente — `components/ResultsList.tsx` (nuevo, `"use client"`)

- `useState` con el array de doctores (inicial = `props.doctors`). Cada doctor
  puede llevar un campo efímero `googleStatus: "loading" | "done"` (solo en el
  estado del cliente; no se persiste).
- Al montar (`useEffect`), para cada doctor con `isCenter(nombre) && rating === 0`:
  lo marca `googleStatus: "loading"` y dispara
  `fetch('/api/google-rating?nombre=<nombre>&cp=<cp>&ciudad=<ciudad>')`.
  - El navegador limita a ~6 conexiones concurrentes por origen → no hace falta
    throttling explícito.
  - `AbortController` con timeout de ~16 s por fetch como red de seguridad sobre
    el timeout interno de la ruta (15 s al sidecar).
- Al resolver cada fetch:
  - **hit** (`rating > 0` en la respuesta): actualiza ese doctor en el estado con
    `googleRating` / `googleNumReviews` / `googlePlaceId`, recalcula `rating` /
    `numReviews` aplicando `mergeRatings`, y pone `googleStatus: "done"`.
  - **miss** (`rating === 0`, sidecar caído, no-ok, o timeout): solo
    `googleStatus: "done"`, sin cambios de datos.
- Cuando ya **ningún** doctor del array está en `"loading"` → re-ejecuta
  `sortByRating(doctores)` y hace `setState`. Una sola reordenación al final (los
  pills van apareciendo progresivamente sobre el esqueleto a medida que llegan;
  el reorden ocurre una vez).
- Render: mapea el array y renderiza `<DoctorCard doctor={d} searchCp={searchCp}
  loading={d.googleStatus === "loading"} />` dentro de la `<section>`.

`ResultsList` importa `sortByRating` de `lib/ratings-sort.ts` y `mergeRatings` de
`lib/ratings-merge.ts` directamente (ambos son puros — solo dependen del tipo
`Doctor` — y por tanto utilizables en un client component). Si en la
implementación se descubre que `lib/ratings-merge.ts` arrastra algún import
server-only, se inlinea en `ResultsList` un merge trivial equivalente (para un
centro de Occident sin Doctoralia, `mergeRatings` se reduce a copiar
`googleRating → rating` y `googleNumReviews → numReviews`).

### Cliente — `components/DoctorCard.tsx` (pasa a `"use client"`)

- Se le añade `"use client"` (no tiene dependencias server-only; ya importa
  `ReviewsSection`, `GoogleReviewsSection` y `TrackedAnchor`, todos cliente).
- Nueva prop opcional `loading?: boolean`. Cuando `loading === true`, en el hueco
  del rating renderiza un **pill esqueleto** en lugar de "Sin valoraciones": un
  `<span>` gris del mismo tamaño aproximado que el pill real, con `animate-pulse`
  de Tailwind (cero salto de layout).
- Todo lo demás idéntico. Cuando `loading` es falsy y el doctor tiene
  `googlePlaceId`, sigue montando `<GoogleReviewsSection placeId={...}>` como hoy
  — funciona igual para un centro que recibió el `placeId` vía el fetch on-demand,
  porque el `setState` de `ResultsList` incluye `googlePlaceId`.
- Se actualiza el comentario interno que dice "El SSR ya resolvió todos los
  ratings (Doctoralia + Google) vía `enrichCentrosLive`…".

### Ficheros eliminados

`lib/google-live-enrich.ts` — queda muerto (solo lo usaba `lib/search.ts`). Se borra.

## Comportamiento, edge cases y limitaciones conocidas

- **Sidecar caído**: `/api/google-rating` devuelve `{ source: "miss", rating: 0 }`
  con 200 rápidamente (connection refused) → el esqueleto parpadea un instante y
  la card cae a "Sin valoraciones". La página carga al momento. Mejor que hoy
  (hoy bloquea ~10-15 s para acabar mostrando lo mismo).
- **Bots / curl sin JS**: ya no disparan llamadas al sidecar (antes el SSR las
  hacía en cada carga, ejecutara JS el cliente o no). Las llamadas al sidecar pasan
  a venir solo de navegadores reales. Efecto colateral positivo para el
  anti-scraping.
- **Centro con rating de Doctoralia pero sin Google cacheado**: en esta versión el
  fetch on-demand **solo** se dispara para centros con `rating === 0`, así que a un
  centro que ya muestra nota Doctoralia no se le busca Google. Se queda con la nota
  Doctoralia; cuando una visita futura haya cacheado su rating de Google, el SSR
  hará el `mergeRatings` ponderado. Limitación asumida (los centros con nota
  Doctoralia son minoría).
- **Página 2 y siguientes**: las 20 cards de `?page=N` son el slice global
  `(N-1)*20 .. N*20`. El reorden en cliente solo baraja esas 20 entre sí. Si un
  centro de la página 2 recibe un rating alto on-demand, "debería" subir a la
  página 1 pero no puede (paginación server-side) → sube dentro de la página 2. En
  la siguiente visita ya está cacheado y el servidor lo coloca en su posición
  global. Limitación inherente a "on-demand + paginación en servidor"; aceptada.
- **Color del pill**: `DoctorCard` colorea el pill por `rankScore ?? rating`
  (umbral 4,5 / 3,5 — promedio bayesiano, ver `lib/ratings-sort.ts`). Al
  reordenar en cliente, `sortByRating` recalcula el prior bayesiano sobre las 20
  cards visibles, no sobre el listado global → el color de algún pill podría variar
  de forma casi imperceptible. Aceptable; si llega a importar, se pasaría el prior
  del servidor como prop a `ResultsList` (no en v1).
- **Carrera en `persistGoogleRating`**: no hay. `fs.readFileSync` / `fs.writeFileSync`
  son síncronos y bloquean el event loop, así que cada ciclo read-modify-write es
  atómico frente a otras peticiones concurrentes. Sin cambios.
- **Rate limiting de `/api/google-rating`**: no se añade. Es una ruta pre-existente
  y pública; solo expone ratings de Google de centros (datos públicos) y no permite
  volcar el dataset de médicos. Fuera de alcance.
- **`app/resultados/loading.tsx`**: se mantiene. Ahora apenas se verá (SSR rápido);
  sigue sirviendo de fallback para la latencia de las fuentes live (Occident, etc.).

## Ficheros tocados (resumen)

| Fichero | Cambio |
|---|---|
| `lib/search.ts` | Quitar import + llamada a `enrichCentrosLive` (y su `await`). El resto de la cadena (`enrichWithDoctoralia` → `enrichWithGoogle` → `mergeRatings` → `sortByRating`) intacto. |
| `lib/google-live-enrich.ts` | **Borrar.** |
| `components/ResultsList.tsx` | **Nuevo** client component (ver arquitectura). Renderiza la `<section aria-label="Médicos encontrados" className="… animate-fade-up">` con las cards dentro. |
| `components/DoctorCard.tsx` | `"use client"`; prop `loading?: boolean`; pill esqueleto pulsante cuando `loading`; actualizar comentario obsoleto. |
| `app/resultados/page.tsx` | Sustituir el bloque `<section>{pageResults.map(<DoctorCard>)}</section>` por `<ResultsList doctors={pageResults} searchCp={cp} />`; actualizar comentarios que mencionan `enrichCentrosLive`. |
| `CLAUDE.md` | Reescribir el punto 5 de la sección "Google Maps (centros)" ("Enriquecimiento SSR-blocking global") para describir el flujo on-demand en cliente. |

No se prevén cambios en `globals.css` (Tailwind ya trae `animate-pulse`), ni en
`lib/google-ratings-index.ts`, `app/api/google-rating/route.ts`,
`components/GoogleReviewsSection.tsx`, `lib/ratings-sort.ts` ni `lib/ratings-merge.ts`
(estos dos últimos solo se importan, no se modifican — salvo el plan B inline si
`ratings-merge` resultara no ser puro).

## Verificación

No hay test runner configurado en el repo → verificación manual, consistente con
el resto del proyecto:

1. **Sidecar caído**: `/resultados?mutua=Occidente&especialidad=Otorrinolaringología&cp=08402&radio=2`
   → carga instantánea; esqueletos breves en las cards de centros; caen a "Sin
   valoraciones"; la página no se cuelga.
2. **Sidecar arriba** (`npm run dev:gmaps`): misma URL → carga instantánea;
   esqueletos → pills aparecen progresivamente → al terminar, una reordenación de
   las 20 cards; `data/google-ratings.json` crece con entradas de Granollers.
3. **Segunda visita** (recarga): pills ya desde el SSR, sin esqueletos, orden
   estable, sin llamadas al sidecar.
4. Abrir "Ver reseñas" en un centro que recibió el rating on-demand →
   `<GoogleReviewsSection>` carga sus reseñas usando el `placeId` del fetch.
5. `npm run build` y `npm run lint` sin errores nuevos.

## Fuera de alcance (posible follow-up)

- Script `npm run scrape:google-ratings` que recorre los centros del dataset
  Adeslas (+ un barrido de centros de Occident) y pre-puebla `data/google-ratings.json`,
  de modo que el "miss" del flujo on-demand pase a ser raro y el orden sea correcto
  casi siempre desde el SSR.
- Pasar el prior bayesiano calculado en el servidor a `ResultsList` para que el
  color de los pills sea idéntico tras el reorden en cliente.
