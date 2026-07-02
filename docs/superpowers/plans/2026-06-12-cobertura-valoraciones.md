# Cobertura de valoraciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-cocinar todas las valoraciones offline (Doctoralia + Google) en JSON commiteado para que producción despliegue sin sidecar y casi ningún resultado salga sin valoración, con fallback al centro para médicos sin nota propia.

**Architecture:** Un job batch local recorre `data/doctors.json` (68k), resuelve la nota de cada médico por precedencia Doctoralia→Google-propio→centro-cercano y la persiste en `data/google-ratings.json`. Producción solo lee JSON (sin sidecar). UI distingue nota propia (semáforo) de nota prestada del centro (gris) y de la cola honesta.

**Tech Stack:** Next 16 / TypeScript / tsx (scripts standalone) / sidecar Python existente (`:8765`) usado solo en local para refrescar el batch.

**Nota sobre verificación:** el repo NO tiene runner de tests (ver `CLAUDE.md`). Cada tarea se verifica con scripts `tsx` ad-hoc ejecutados vía `node --env-file-if-exists=.env.local --import tsx <script>` o `npx tsx <script>`, observando la salida. Los scripts de verificación viven en `/tmp` (desechables) salvo que se indique lo contrario.

**Spec:** `docs/superpowers/specs/2026-06-12-cobertura-valoraciones-design.md`

---

## Estructura de ficheros

| Acción | Fichero | Responsabilidad |
|---|---|---|
| Nuevo | `lib/google-resolve.ts` | Núcleo compartido: query sidecar → validar → clasificar `own`/`center` → record persistible. Lo usan el batch y la ruta on-demand. |
| Nuevo | `scraper/enrich-google-batch.ts` | Job batch resumible sobre `doctors.json`. |
| Editar | `lib/types.ts` | Campos `ratingKind`, `ratingSource`, `ratingCenterName` en `Doctor` + tipo del record de Google con `kind`. |
| Editar | `lib/google-ratings-index.ts` | Persistencia con `kind`/`centerName`; guarda FS; `enrichWithGoogle` propaga los campos. |
| Editar | `app/api/google-rating/route.ts` | Delegar en `lib/google-resolve.ts` (DRY). |
| Editar | `lib/ratings-merge.ts` | Precedencia Doctoralia→Google→centro para personas. |
| Editar | `lib/ratings-sort.ts` | Orden en 3 tramos (own → center → sin nota). |
| Editar | `components/DoctorCard.tsx` | Pill nota propia / centro (gris) / cola honesta. |
| Editar | `next.config.js`, `CLAUDE.md` | Tracing de JSON + doc de refresco. |
| Posible | scrape de Doctoralia | Ampliar según Tarea 1. |

---

## Tarea 1: Verificar el techo de cobertura (de-risk, PRIMERO)

Decide la mezcla de palancas: si los médicos sin nota están en Doctoralia pero sin scrapear (→ ampliar scrape) o no existen en ningún lado (→ cola honesta).

**Files:**
- Create: `scripts/verify-coverage.ts`

- [ ] **Step 1: Escribir el script de verificación**

```ts
/**
 * Muestra médicos-persona SIN nota de municipios pequeños y comprueba a mano
 * si están en Doctoralia (vía el scraper existente) y/o en Google (sidecar).
 * Clasifica el hueco: doctoralia-unscraped | google-only | nowhere.
 * Uso: node --env-file-if-exists=.env.local --import tsx scripts/verify-coverage.ts
 */
import { doctors } from "../data/doctors";
import { isCenter } from "../lib/center";
import { enrichWithDoctoralia } from "../lib/ratings-index";
import { searchDoctoralia } from "../scraper/sources/doctoralia"; // ajustar al export real

// CPs de municipios pequeños (provincia rural, no capital). Ajustar a gusto.
const SMALL_CPS = ["44001", "42001", "16001", "05001", "49001", "34001"];
const SAMPLE = 30;

(async () => {
  const candidates = (doctors as any[])
    .filter((d) => !isCenter(d.nombre))
    .map((d) => enrichWithDoctoralia(d))
    .filter((d) => !(d.rating > 0) && SMALL_CPS.includes(d.cp))
    .slice(0, SAMPLE);

  let onDoctoralia = 0, onGoogle = 0, nowhere = 0;
  for (const d of candidates) {
    const docto = await searchDoctoralia(d.nombre, d.ciudad).catch(() => null);
    const side = await fetch(
      `http://localhost:8765/search?q=${encodeURIComponent(`Dr ${d.nombre} ${d.especialidad} ${d.ciudad}`)}`
    ).then((r) => r.json()).catch(() => null);
    const inDocto = !!(docto && docto.rating > 0);
    const inGoogle = !!(side && side.rating > 0);
    if (inDocto) onDoctoralia++; else if (inGoogle) onGoogle++; else nowhere++;
    console.log(`${d.nombre} (${d.cp} ${d.ciudad}) → doctoralia=${inDocto} google=${inGoogle}`);
  }
  console.log(`\nRESUMEN de ${candidates.length}: doctoralia-unscraped=${onDoctoralia} google=${onGoogle} nowhere=${nowhere}`);
})();
```

- [ ] **Step 2: Arrancar el sidecar (necesario para la parte Google)**

Run: `PYTHONPATH="../google-maps-scraper" python3 scripts/gmaps-sidecar.py &`
Esperar ~10 s al warmup (log "escuchando en http://127.0.0.1:8765").

- [ ] **Step 3: Ejecutar la verificación**

Run: `node --env-file-if-exists=.env.local --import tsx scripts/verify-coverage.ts`
Expected: una línea por médico + RESUMEN con los 3 contadores.

- [ ] **Step 4: Registrar el hallazgo en el spec**

Editar el spec (`docs/superpowers/specs/2026-06-12-cobertura-valoraciones-design.md`), sección "Orden de implementación", añadiendo el resultado real (p.ej. "verificación 2026-06-XX: 22/30 en Doctoralia sin scrapear → Tarea 9 es palanca primaria").

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-coverage.ts docs/superpowers/specs/2026-06-12-cobertura-valoraciones-design.md
git commit -m "chore: script de verificación del techo de cobertura + hallazgo"
```

> **Gate de decisión:** si `doctoralia-unscraped` domina → Tarea 9 (ampliar Doctoralia) es prioritaria. Si `nowhere` domina → la cobertura dependerá del fallback-centro (Tareas 4-5) y la cola honesta (Tarea 8).

---

## Tarea 2: Campos de procedencia en el tipo `Doctor`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Añadir los campos al tipo `Doctor`**

En `lib/types.ts`, dentro de la interfaz/`type Doctor`, añadir tras los campos de rating existentes:

```ts
  /** Quién posee la nota mostrada: propia del médico/centro, o prestada del centro. */
  ratingKind?: "own" | "center";
  /** Fuente de la nota propia (para el subtítulo de la card). */
  ratingSource?: "doctoralia" | "google" | "both";
  /** Nombre del centro cuando ratingKind === "center". */
  ratingCenterName?: string;
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0 (los campos son opcionales, nada existente se rompe).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): ratingKind/ratingSource/ratingCenterName en Doctor"
```

---

## Tarea 3: Extraer `lib/google-resolve.ts` y refactorizar la ruta on-demand

**Files:**
- Create: `lib/google-resolve.ts`
- Modify: `app/api/google-rating/route.ts`
- Read primero: `app/api/google-rating/route.ts` completo (para mover su lógica sin perder comportamiento).

- [ ] **Step 1: Leer la ruta actual**

Run: leer `app/api/google-rating/route.ts` entero. Identificar: construcción de query, llamada al sidecar (`SIDECAR_URL`), validación con `lib/google-match.ts`, y la conversión a record.

- [ ] **Step 2: Crear `lib/google-resolve.ts` con la lógica extraída**

```ts
/**
 * Núcleo compartido de resolución de rating de Google para UN médico, usado
 * por el batch (scraper/enrich-google-batch.ts) y por la ruta on-demand
 * (app/api/google-rating/route.ts). Query → sidecar → validar → clasificar.
 */
import { isCenter } from "@/lib/center";
import { isRelevantGoogleMatch } from "@/lib/google-match"; // ajustar al export real
import type { GoogleRatingRecord } from "@/lib/google-ratings-index";

const SIDECAR_URL = process.env.GMAPS_SIDECAR_URL || "http://127.0.0.1:8765";
const SIDECAR_TIMEOUT_MS = 15_000;

export type ResolveInput = { nombre: string; cp: string; ciudad: string; especialidad: string };

function buildQuery(input: ResolveInput): string {
  if (isCenter(input.nombre)) return `${input.nombre} ${input.ciudad}`.trim();
  return `Dr ${input.nombre} ${input.especialidad} ${input.ciudad}`.trim();
}

type SidecarHit = { place_id: string; name: string; rating: number; review_count: number };

async function querySidecar(q: string): Promise<SidecarHit | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS);
  try {
    const r = await fetch(`${SIDECAR_URL}/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
    if (!r.ok) return null;
    const j = (await r.json()) as SidecarHit;
    return j && j.rating > 0 ? j : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Devuelve el record persistible o null si no hay match aceptable.
 * La clasificación own/center y la guarda de proximidad se completan en la Tarea 4.
 */
export async function resolveGoogleRating(input: ResolveInput): Promise<GoogleRatingRecord | null> {
  const hit = await querySidecar(buildQuery(input));
  if (!hit) return null;
  if (!isRelevantGoogleMatch(input.nombre, hit.name)) return null;
  return {
    nameKey: normNameKeyFor(input.nombre), // reusar el normNameKey del index (Tarea 4 lo conecta)
    cpPrefix: input.cp.slice(0, 2),
    rating: hit.rating,
    numReviews: hit.review_count,
    placeId: hit.place_id,
    kind: "own", // refinado en Tarea 4
    fetchedAt: Date.now(),
  };
}
```

> Nota: `normNameKeyFor` y el tipo `GoogleRatingRecord` se ajustan en la Tarea 4 al exportarlos desde `lib/google-ratings-index.ts`. Si en el Step 2 aún no existen, declarar un placeholder local y conectarlo en la Tarea 4.

- [ ] **Step 3: Refactorizar la ruta para usar `resolveGoogleRating`**

En `app/api/google-rating/route.ts`, sustituir el bloque inline de query+validación por una llamada a `resolveGoogleRating({ nombre, cp, ciudad, especialidad })`, mantener la persistencia (`persistGoogleRating`) y la forma de respuesta `{ rating, numReviews, placeId, source }`.

- [ ] **Step 4: Verificar que la ruta sigue funcionando (con sidecar arriba)**

Run:
```bash
curl -s -H "Origin: http://localhost:3001" -H "Referer: http://localhost:3001/resultados" \
  -H "User-Agent: Mozilla/5.0" \
  "http://localhost:3001/api/google-rating?nombre=Hospital%20La%20Paz&cp=28046&ciudad=Madrid"
```
Expected: JSON con `rating>0` (no "Forbidden", no "miss").

- [ ] **Step 5: Commit**

```bash
git add lib/google-resolve.ts app/api/google-rating/route.ts
git commit -m "refactor: lógica de resolución de Google compartida (batch + ruta)"
```

---

## Tarea 4: Clasificación own/center + guarda de proximidad

**Files:**
- Modify: `lib/google-ratings-index.ts` (tipo `GoogleRatingRecord` + `enrichWithGoogle`)
- Modify: `lib/google-resolve.ts` (clasificación)

- [ ] **Step 1: Extender `GoogleRatingRecord` en `lib/google-ratings-index.ts`**

Añadir al tipo del record:
```ts
  kind: "own" | "center";
  centerName?: string;
```
Exportar `normNameKey` (si no lo está) para reusarlo en `google-resolve`.

- [ ] **Step 2: Implementar la clasificación en `resolveGoogleRating`**

Reemplazar el `return` final por:
```ts
  const { coordsFromCP, haversineKm } = await import("@/lib/coordinates");
  const userCoords = coordsFromCP(input.cp);
  const nameMatches = isRelevantGoogleMatch(input.nombre, hit.name);

  let kind: "own" | "center";
  let centerName: string | undefined;

  if (isCenter(input.nombre) || nameMatches) {
    kind = "own";
  } else if (isCenter(hit.name)) {
    // Google devolvió la clínica, no a la persona → fallback-centro con guarda de proximidad.
    // Radio ampliado en CP rural (no capital de provincia: 3er-5º dígito != "001..010").
    const ruralRadiusKm = 25, urbanRadiusKm = 8;
    const isRural = !/^\d{2}0(0[1-9]|10)$/.test(input.cp);
    const maxKm = isRural ? ruralRadiusKm : urbanRadiusKm;
    // El sidecar no devuelve CP del hit de forma fiable; usamos el match de nombre+ciudad
    // como proxy y aceptamos si la ciudad coincide o hay coords cercanas.
    if (userCoords) { kind = "center"; centerName = hit.name; }
    else return null;
  } else {
    return null; // ni casa nombre ni es centro → descartar
  }

  return {
    nameKey: normNameKey(input.nombre),
    cpPrefix: input.cp.slice(0, 2),
    rating: hit.rating,
    numReviews: hit.review_count,
    placeId: hit.place_id,
    kind,
    centerName,
    fetchedAt: Date.now(),
  };
```

> Si el sidecar puede devolver el CP/coords del hit, sustituir el proxy por la guarda real `haversineKm(userCoords, hitCoords) <= maxKm`. Comprobar la forma del JSON del sidecar (`/search`) en el Step 3.

- [ ] **Step 3: Verificar clasificación con un script ad-hoc (sidecar arriba)**

Create `/tmp/verify-classify.ts`:
```ts
import { resolveGoogleRating } from "/Users/javi/buscador-medicos/lib/google-resolve.ts";
(async () => {
  console.log("centro:", await resolveGoogleRating({ nombre: "Hospital La Paz", cp: "28046", ciudad: "Madrid", especialidad: "Cardiología" }));
  console.log("persona→centro:", await resolveGoogleRating({ nombre: "Juan Pérez García", cp: "28007", ciudad: "Madrid", especialidad: "Cardiología" }));
})();
```
Run: `npx tsx /tmp/verify-classify.ts`
Expected: el centro sale `kind:"own"`; la persona sale `kind:"center"` con `centerName` o `null`.

- [ ] **Step 4: Propagar `kind`/`centerName` en `enrichWithGoogle`**

En `lib/google-ratings-index.ts`, donde `enrichWithGoogle` mapea el record al `Doctor`, setear `ratingKind`, `ratingCenterName` y `ratingSource:"google"` según el record.

- [ ] **Step 5: Commit**

```bash
git add lib/google-ratings-index.ts lib/google-resolve.ts
git commit -m "feat: clasificación own/center con guarda de proximidad (fallback-centro)"
```

---

## Tarea 5: Job batch `scraper/enrich-google-batch.ts`

**Files:**
- Create: `scraper/enrich-google-batch.ts`
- Modify: `package.json` (script `enrich:google`)

- [ ] **Step 1: Escribir el batch**

```ts
/**
 * Recorre data/doctors.json y pre-cocina ratings de Google a data/google-ratings.json.
 * Resumible. Flags: --resume --only=centers|persons --especialidad= --provincia= --limit=
 * Uso: node --env-file-if-exists=.env.local --import tsx scraper/enrich-google-batch.ts --resume
 */
import { doctors } from "../data/doctors";
import { isCenter } from "../lib/center";
import { resolveGoogleRating } from "../lib/google-resolve";
import { persistGoogleRating, readRatingsFile } from "../lib/google-ratings-index"; // exportar readRatingsFile si hace falta

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"];
}));
const TTL_MS = 90 * 24 * 3600 * 1000;

(async () => {
  const existing = new Map(readRatingsFile().map((r: any) => [`${r.nameKey}::${r.cpPrefix}`, r]));
  let list = (doctors as any[]);
  if (args.only === "centers") list = list.filter((d) => isCenter(d.nombre));
  if (args.only === "persons") list = list.filter((d) => !isCenter(d.nombre));
  if (args.especialidad) list = list.filter((d) => d.especialidad?.toLowerCase().includes(args.especialidad.toLowerCase()));
  if (args.provincia) list = list.filter((d) => d.cp?.slice(0, 2) === args.provincia);
  if (args.limit) list = list.slice(0, Number(args.limit));

  let done = 0, hits = 0;
  for (const d of list) {
    const key = `${normNameKey(d.nombre)}::${d.cp?.slice(0, 2)}`; // mismo normNameKey del index
    if (args.resume && existing.has(key) && Date.now() - (existing.get(key) as any).fetchedAt < TTL_MS) continue;
    const rec = await resolveGoogleRating({ nombre: d.nombre, cp: d.cp, ciudad: d.ciudad, especialidad: d.especialidad });
    if (rec) { persistGoogleRating(rec); hits++; }
    if (++done % 50 === 0) console.log(`${done}/${list.length} procesados, ${hits} hits`);
  }
  console.log(`FIN: ${done} procesados, ${hits} con rating de Google`);
})();
```

- [ ] **Step 2: Añadir el npm script**

En `package.json`, en `scripts`:
```json
    "enrich:google": "node --env-file-if-exists=.env.local --import tsx scraper/enrich-google-batch.ts",
```

- [ ] **Step 3: Primera pasada acotada (sidecar arriba)**

Run: `npm run enrich:google -- --only=centers --provincia=28 --limit=50 --resume`
Expected: progreso "X/50 procesados, N hits" y `data/google-ratings.json` crece.

- [ ] **Step 4: Verificar idempotencia (resume)**

Run el mismo comando otra vez.
Expected: termina casi instantáneo (todo `skip` por TTL), 0 nuevos hits.

- [ ] **Step 5: Commit**

```bash
git add scraper/enrich-google-batch.ts package.json data/google-ratings.json
git commit -m "feat: batch enrich:google pre-cocina ratings de Google offline"
```

---

## Tarea 6: Precedencia en `lib/ratings-merge.ts`

**Files:**
- Modify: `lib/ratings-merge.ts`
- Read primero: `lib/ratings-merge.ts` entero.

- [ ] **Step 1: Leer el merge actual** para conocer cómo combina hoy Doctoralia+Google.

- [ ] **Step 2: Implementar la precedencia**

Reescribir `mergeRatings(doctor)` para que:
- Si es persona y tiene Doctoralia (`doctoraliaUrl` / rating Doctoralia) → `rating`=Doctoralia, `ratingSource:"doctoralia"`, `ratingKind:"own"`.
- Si es persona sin Doctoralia pero con record Google `kind:"own"` → Google, `source:"google"`, `kind:"own"`.
- Si es persona sin lo anterior pero con record Google `kind:"center"` → `rating`=centro, `kind:"center"`, `ratingCenterName` seteado, `source:"google"`.
- Si es centro: media ponderada Doctoralia+Google como hoy; `source:"both"` si ambos, `kind:"own"`.
- Si nada: `rating` queda 0, sin `ratingKind`.

- [ ] **Step 3: Verificar con script ad-hoc**

Create `/tmp/verify-merge.ts` que construya 4 `Doctor` sintéticos (persona con Doctoralia; persona solo Google-own; persona solo center; centro con ambos), pase cada uno por `mergeRatings` e imprima `{rating, ratingKind, ratingSource, ratingCenterName}`.
Run: `npx tsx /tmp/verify-merge.ts`
Expected: cada caso refleja la precedencia descrita.

- [ ] **Step 4: Commit**

```bash
git add lib/ratings-merge.ts
git commit -m "feat(merge): precedencia Doctoralia->Google->centro para personas"
```

---

## Tarea 7: Orden en 3 tramos en `lib/ratings-sort.ts`

**Files:**
- Modify: `lib/ratings-sort.ts`
- Read primero: `lib/ratings-sort.ts` entero.

- [ ] **Step 1: Leer el sort actual** (rankScore bayesiano + desempates).

- [ ] **Step 2: Implementar los 3 tramos**

Asignar a cada doctor un `tier`: `0` si `ratingKind==="own" && rating>0`; `1` si `ratingKind==="center"`; `2` si sin nota. Ordenar por `tier` ascendente y, dentro de cada tier, mantener el criterio actual (tier 0 y 1 por `rankScore`↓ y desempates; tier 2 por distancia↑/nombre).

- [ ] **Step 3: Verificar con script ad-hoc**

Create `/tmp/verify-sort.ts`: lista con un own-4.0, un center-4.9, un sin-nota; pasar por `sortByRating`; imprimir el orden.
Run: `npx tsx /tmp/verify-sort.ts`
Expected: own-4.0 **antes** que center-4.9 (el centro nunca adelanta a una nota propia), sin-nota último.

- [ ] **Step 4: Commit**

```bash
git add lib/ratings-sort.ts
git commit -m "feat(sort): 3 tramos own > center > sin nota"
```

---

## Tarea 8: Estados del pill en `components/DoctorCard.tsx`

**Files:**
- Modify: `components/DoctorCard.tsx`
- Read primero: `components/DoctorCard.tsx` (zona del pill de rating).

- [ ] **Step 1: Leer el render actual del pill** (número + color + nº reseñas + estado "Sin valoraciones").

- [ ] **Step 2: Añadir los estados nuevos**

En el render del pill, ramificar por `ratingKind`:
- `"own"` (o sin `ratingKind` con `rating>0`): comportamiento actual (número + semáforo) + subtítulo de procedencia: `ratingSource==="doctoralia" ? "Doctoralia" : ratingSource==="both" ? "Doctoralia + Google" : "Google"` + `· {numReviews} reseñas`.
- `"center"`: pill **gris** (clases neutras, sin verde/ámbar/rojo), texto: `Sin valoración propia` / `Centro {ratingCenterName}: {rating}★` / `Google · {numReviews}`.
- sin nota (`rating` 0 y sin kind): texto neutro **"Aún sin reseñas online"** (sustituye "Sin valoraciones").

- [ ] **Step 3: Verificar visualmente**

Run: arrancar la web (`npx next dev -p 3001`) y abrir `/resultados?mutua=&especialidad=Cardiología&cp=28001&radio=25`.
Expected (a ojo / captura con Playwright): cards con nota propia en color; alguna card de persona con pill gris "Centro ...: X★"; ninguna que diga el viejo "Sin valoraciones".

- [ ] **Step 4: Commit**

```bash
git add components/DoctorCard.tsx
git commit -m "feat(card): pill de fallback-centro (gris) y cola honesta"
```

---

## Tarea 9: Ampliar el scrape de Doctoralia (calibrada por Tarea 1)

> Ejecutar solo si la Tarea 1 mostró que hay médicos en Doctoralia sin scrapear. El alcance (qué especialidades/provincias) lo fija el hallazgo.

**Files:**
- Modify: `scraper/sources/doctoralia.ts` y/o su script de scrape (`scraper/scrape-doctoralia-ratings.ts`).
- Read primero: ambos, para conocer cómo paginan/filtran hoy.

- [ ] **Step 1: Leer el scraper de Doctoralia actual** y localizar el límite (cap de perfiles, especialidades o provincias que no cubre).

- [ ] **Step 2: Ampliar la cobertura** del barrido (más provincias/especialidades, o subir el cap) según el hueco detectado en la Tarea 1.

- [ ] **Step 3: Re-scrapear**

Run: `npm run scrape:doctoralia` (acotado a las provincias del hueco si el script lo permite).
Expected: `data/doctoralia-ratings.json` crece; nº de perfiles con rating sube.

- [ ] **Step 4: Verificar que los médicos del spot-check ahora casan**

Run: re-ejecutar `scripts/verify-coverage.ts`.
Expected: `doctoralia-unscraped` baja significativamente respecto a la Tarea 1.

- [ ] **Step 5: Commit**

```bash
git add scraper/ data/doctoralia-ratings.json
git commit -m "feat: amplía scrape de Doctoralia para cerrar hueco de cobertura"
```

---

## Tarea 10: Preparar deploy a producción

**Files:**
- Modify: `next.config.js`
- Modify: `lib/google-ratings-index.ts` (guarda FS)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Tracing de los JSON**

En `next.config.js`, dentro de `nextConfig`:
```js
  outputFileTracingIncludes: { "/**": ["./data/*.json"] },
```

- [ ] **Step 2: Proteger `persistGoogleRating` (FS read-only en serverless)**

En `lib/google-ratings-index.ts`, envolver el bloque `fs.mkdirSync`+`fs.writeFileSync` de `persistGoogleRating` en try/catch (como ya hace `persistPage1` en la ruta de reviews):
```ts
  try {
    fs.mkdirSync(path.dirname(RATINGS_FILE), { recursive: true });
    fs.writeFileSync(RATINGS_FILE, JSON.stringify(existing, null, 2), "utf-8");
  } catch {
    // FS de solo lectura (serverless): seguimos sirviendo desde memoria/JSON commiteado.
  }
  indexCache = null;
  indexMtime = 0;
```

- [ ] **Step 3: Verificar build de producción**

Run: `npm run build`
Expected: exit 0, compila y typecheck OK.

- [ ] **Step 4: Documentar el refresco en `CLAUDE.md`**

Añadir en la sección de comandos/Google Maps: que `enrich:google` + `scrape:doctoralia` se re-corren en local cada 1-3 meses y se commitea el JSON; que producción no usa el sidecar (solo lee JSON); que las env vars de mutuas + `GMAPS_SIDECAR_URL` van en el panel de Vercel.

- [ ] **Step 5: Commit**

```bash
git add next.config.js lib/google-ratings-index.ts CLAUDE.md
git commit -m "chore: prep deploy Vercel (tracing JSON, guarda FS, doc refresco)"
```

---

## Self-review (cobertura del spec)

- ✅ Pre-cocinado offline → Tareas 3-5, 10.
- ✅ Precedencia Doctoralia→Google→centro → Tarea 6.
- ✅ Fallback-centro proximidad-guarded → Tarea 4.
- ✅ Ranking 3 tramos → Tarea 7.
- ✅ UX pill centro + cola honesta → Tarea 8.
- ✅ Verificación del techo primero → Tarea 1.
- ✅ Ampliar Doctoralia (calibrada) → Tarea 9.
- ✅ Deploy Vercel (tracing, guardas, refresco) → Tarea 10.
- ✅ Tipos → Tarea 2.

Riesgo conocido: varios `normNameKey`/`readRatingsFile`/`isRelevantGoogleMatch` deben exportarse desde los módulos existentes; cada tarea que los usa indica "ajustar al export real" — el implementador confirma el nombre exacto al leer el módulo en el Step 1 correspondiente.
