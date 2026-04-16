# Doctoralia Ratings Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enriquecer `data/doctors.json` con `rating`/`numReviews`/`doctoraliaUrl` extraídos de Doctoralia para los profesionales sin rating propio de la mutua; UI muestra badge enlazado al perfil + aviso global sobre precisión del matcheo.

**Architecture:** Scraper offline (especialidad × provincia) → JSON raw → merger que fusiona contra el dataset canonical por nombre+especialidad+provincia con umbral Jaccard 0.5. UI lee el dataset ya enriquecido; sin cambios en el pipeline live.

**Tech Stack:** TypeScript + tsx (scraper), axios + cheerio (fetch/parse HTML), Next.js App Router (UI). Sin test runner — verificación manual vía CLI + navegador.

---

## File Structure

**Nuevos:**
- `scraper/sources/doctoralia-ratings.ts` — lógica core del scrape (fetch + parse + dedup por `entityId`)
- `scraper/scrape-doctoralia-ratings.ts` — CLI wrapper; escribe `data/doctoralia-ratings.json`
- `scraper/enrich-ratings.ts` — merger; lee ambos JSONs, escribe `data/doctors.json` + regenera `doctors.ts` shim

**Modificados:**
- `lib/types.ts` — añade `doctoraliaUrl?: string` al tipo `Doctor`
- `components/DoctorCard.tsx` — badge envuelto en `<a>` si hay URL, estado "—" si no hay rating
- `app/resultados/page.tsx` — aviso global bajo el header
- `package.json` — actualiza script `scrape:doctoralia` al nuevo CLI

**Generados (commit final):**
- `data/doctoralia-ratings.json` — ~3-6 MB, profesionales únicos de Doctoralia en España
- `data/doctors.json` + `data/doctors.ts` — regenerados con los ratings enriquecidos

---

## Task 1: UI — tipo, tarjeta con link al rating, estado "sin valoraciones", aviso global

**Files:**
- Modify: `lib/types.ts`
- Modify: `components/DoctorCard.tsx`
- Modify: `app/resultados/page.tsx`

La UI se modifica primero porque es tolerante al campo ausente (`doctoraliaUrl?`) y a `rating===0`. Una vez integrado, el pipeline de datos puede irse construyendo en paralelo sin romper nada en producción.

- [ ] **Step 1.1: Añadir campo opcional `doctoraliaUrl` al tipo Doctor**

Reemplaza `lib/types.ts` completo:

```ts
export type Doctor = {
  id: number;
  nombre: string;
  especialidad: string;
  mutuas: string[];
  direccion: string;
  cp: string;
  ciudad: string;
  telefono?: string;
  rating: number;
  numReviews: number;
  doctoraliaUrl?: string;
  distanceKm?: number | null;
};

export type SearchResponse = {
  doctors: Doctor[];
};
```

- [ ] **Step 1.2: `DoctorCard.tsx` — badge enlazado + estado "sin valoración"**

En `components/DoctorCard.tsx`, reemplaza el bloque `{/* Rating */}` actual (líneas ~78-93) por:

```tsx
{/* Rating */}
<div className="flex-shrink-0 text-right">
  {doctor.rating > 0 ? (
    doctor.doctoraliaUrl ? (
      <a
        href={doctor.doctoraliaUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Ver perfil en Doctoralia"
        className="group/rating inline-block"
      >
        <div
          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-sm font-semibold tabular-nums transition-colors ${ratingStyle(doctor.rating)} group-hover/rating:border-gray-400`}
        >
          {doctor.rating.toFixed(1)}
          <span aria-hidden="true">★</span>
        </div>
        {doctor.numReviews > 0 && (
          <p className="tabular-nums text-[11px] text-gray-400 mt-1 group-hover/rating:text-gray-600 transition-colors">
            {doctor.numReviews.toLocaleString("es-ES")} reseñas
          </p>
        )}
      </a>
    ) : (
      <>
        <div
          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-sm font-semibold tabular-nums ${ratingStyle(doctor.rating)}`}
        >
          {doctor.rating.toFixed(1)}
          <span aria-hidden="true">★</span>
        </div>
        {doctor.numReviews > 0 && (
          <p className="tabular-nums text-[11px] text-gray-400 mt-1">
            {doctor.numReviews.toLocaleString("es-ES")} reseñas
          </p>
        )}
      </>
    )
  ) : (
    <div
      title="Sin valoraciones disponibles"
      className="inline-flex items-center px-2 py-0.5 rounded-full border text-sm text-gray-300 border-gray-100 bg-gray-50 tabular-nums"
    >
      —
    </div>
  )}
</div>
```

- [ ] **Step 1.3: Aviso global en `resultados/page.tsx`**

En `app/resultados/page.tsx`, añade un párrafo de aviso **inmediatamente después** del `<p>` "Mostrando X–Y · ordenados por valoración" (línea ~127). Inserta este bloque:

```tsx
{totalFound > 0 && (
  <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
    Las valoraciones provienen de Doctoralia. El matcheo por nombre y provincia puede no ser 100% exacto.
  </p>
)}
```

- [ ] **Step 1.4: Verificar compilación y render en dev**

Ejecuta:

```bash
npm run dev
```

Abre `http://localhost:3000/resultados?mutua=Adeslas&especialidad=Alergología&cp=08024` en el navegador.
Expected:
- No hay errores en la consola de Next ni en el navegador.
- Cada tarjeta muestra badge `—` gris a la derecha (aún no hay ratings).
- Bajo "Mostrando X–Y · ordenados por valoración" aparece el aviso en gris claro.

Mata el dev (`Ctrl+C`).

- [ ] **Step 1.5: Commit**

```bash
git add lib/types.ts components/DoctorCard.tsx app/resultados/page.tsx
git commit -m "Añade doctoraliaUrl al tipo Doctor + badge enlazado y aviso de matcheo en UI"
```

---

## Task 2: Scraper Doctoralia — fuente y CLI

**Files:**
- Create: `scraper/sources/doctoralia-ratings.ts`
- Create: `scraper/scrape-doctoralia-ratings.ts`
- Modify: `package.json`

La fuente itera especialidad × provincia usando el endpoint `/buscar` con `spec=` y `loc=`, pagina hasta agotar, dedup por `data-eec-entity-id`. Delay 250ms entre requests, backoff exponencial ante 403/429.

- [ ] **Step 2.1: Crear `scraper/sources/doctoralia-ratings.ts`**

Contenido completo:

```ts
import axios from "axios";
import * as cheerio from "cheerio";

export type DoctoraliaProfile = {
  entityId: string;
  url: string;
  name: string;
  especialidadDoctoralia: string;
  especialidadCanonical: string;
  provincia: string;
  cities: string[];
  streets: string[];
  rating: number;
  numReviews: number;
};

// Combo UI → slug Doctoralia (singular masculino, sin acentos, guiones).
// Provisional: verificar HTTP 200 + cards > 0 en Step 2.4.
export const ESPECIALIDAD_SLUGS: Record<string, string> = {
  "Alergología": "alergologo",
  "Andrología": "andrologo",
  "Aparato digestivo": "gastroenterologo",
  "Cardiología": "cardiologo",
  "Cirugía general": "cirujano-general",
  "Cirugía plástica": "cirujano-plastico",
  "Dermatología": "dermatologo",
  "Endocrinología": "endocrinologo",
  "Fisioterapia": "fisioterapeuta",
  "Ginecología": "ginecologo",
  "Hematología": "hematologo",
  "Logopedia": "logopeda",
  "Medicina de urgencias": "medico-de-urgencias",
  "Medicina estética": "medico-estetico",
  "Medicina general": "medico-de-cabecera",
  "Medicina interna": "internista",
  "Nefrología": "nefrologo",
  "Neumología": "neumologo",
  "Neurocirugía": "neurocirujano",
  "Neurología": "neurologo",
  "Nutrición y dietética": "nutricionista",
  "Odontología": "dentista",
  "Oftalmología": "oftalmologo",
  "Oncología": "oncologo",
  "Otorrinolaringología": "otorrinolaringologo",
  "Pediatría": "pediatra",
  "Podología": "podologo",
  "Psicología": "psicologo",
  "Psiquiatría": "psiquiatra",
  "Rehabilitación": "medico-rehabilitador",
  "Reumatología": "reumatologo",
  "Traumatología": "traumatologo",
  "Urología": "urologo",
};

// 52 provincias españolas. Usamos el nombre como `loc=` param.
export const PROVINCIAS: string[] = [
  "A Coruña", "Álava", "Albacete", "Alicante", "Almería", "Asturias",
  "Ávila", "Badajoz", "Baleares", "Barcelona", "Burgos", "Cáceres",
  "Cádiz", "Cantabria", "Castellón", "Ceuta", "Ciudad Real", "Córdoba",
  "Cuenca", "Girona", "Granada", "Guadalajara", "Guipúzcoa", "Huelva",
  "Huesca", "Jaén", "La Rioja", "Las Palmas", "León", "Lleida", "Lugo",
  "Madrid", "Málaga", "Melilla", "Murcia", "Navarra", "Ourense",
  "Palencia", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife",
  "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo",
  "Valencia", "Valladolid", "Vizcaya", "Zamora", "Zaragoza",
];

const BASE = "https://www.doctoralia.es";
const DELAY_MS = 250;
const MAX_PAGES = 20;
const TIMEOUT_MS = 15000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithBackoff(url: string): Promise<string | null> {
  const delays = [5000, 15000, 30000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT_MS });
      return res.data as string;
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; code?: string };
      const status = e?.response?.status;
      if (status === 404) return null;
      if ((status === 403 || status === 429) && attempt < delays.length) {
        console.warn(`    [${status}] backoff ${delays[attempt]}ms → ${url}`);
        await sleep(delays[attempt]);
        continue;
      }
      console.warn(`    [warn] fetch failed (${status ?? e?.code ?? "?"}): ${url}`);
      return null;
    }
  }
  return null;
}

function parsePage(
  html: string,
  especialidadCanonical: string,
  provincia: string
): DoctoraliaProfile[] {
  const $ = cheerio.load(html);
  const out: DoctoraliaProfile[] = [];
  $("[data-id='result-item']").each((_, el) => {
    const card = $(el);
    const entityId = card.attr("data-eec-entity-id");
    if (!entityId) return;
    const name = card.attr("data-doctor-name")?.trim() ?? "";
    if (!name) return;
    const url = card.attr("data-doctor-url") ?? "";
    const especialidadDoctoralia =
      card.attr("data-eec-specialization-name")?.trim() ?? "";
    const rating = parseFloat(card.attr("data-eec-stars-rating") ?? "0") || 0;
    const numReviews =
      parseInt(card.attr("data-eec-opinions-count") ?? "0", 10) || 0;

    const cities = new Set<string>();
    card.find("[itemprop='addressLocality']").each((_, e) => {
      const v = $(e).attr("content")?.trim();
      if (v) cities.add(v);
    });
    const streets = new Set<string>();
    card.find("[itemprop='streetAddress']").each((_, e) => {
      const v = $(e).attr("content")?.trim();
      if (v) streets.add(v);
    });

    out.push({
      entityId,
      url,
      name,
      especialidadDoctoralia,
      especialidadCanonical,
      provincia,
      cities: [...cities],
      streets: [...streets],
      rating,
      numReviews,
    });
  });
  return out;
}

export type ScrapeOptions = {
  limitEspecialidades?: number;
  limitProvincias?: number;
  log?: (s: string) => void;
};

export async function scrapeDoctoralia(
  opts: ScrapeOptions = {}
): Promise<DoctoraliaProfile[]> {
  const log = opts.log ?? console.log;
  const especialidades = Object.entries(ESPECIALIDAD_SLUGS).slice(
    0,
    opts.limitEspecialidades ?? Infinity
  );
  const provincias = PROVINCIAS.slice(0, opts.limitProvincias ?? Infinity);

  // Dedup global por entityId — un mismo doctor sale en varias provincias/páginas.
  const byEntity = new Map<string, DoctoraliaProfile>();
  let totalFetches = 0;

  for (const [especialidadCanonical, slug] of especialidades) {
    for (const provincia of provincias) {
      log(`  ${especialidadCanonical} · ${provincia}`);
      for (let page = 1; page <= MAX_PAGES; page++) {
        await sleep(DELAY_MS);
        const url = `${BASE}/buscar?spec=${slug}&loc=${encodeURIComponent(
          provincia
        )}${page > 1 ? `&page=${page}` : ""}`;
        const html = await fetchWithBackoff(url);
        totalFetches++;
        if (!html) break;
        const profiles = parsePage(html, especialidadCanonical, provincia);
        if (profiles.length === 0) break;
        let added = 0;
        for (const p of profiles) {
          const existing = byEntity.get(p.entityId);
          if (existing) {
            // fusionar cities/streets
            const ci = new Set([...existing.cities, ...p.cities]);
            const st = new Set([...existing.streets, ...p.streets]);
            existing.cities = [...ci];
            existing.streets = [...st];
          } else {
            byEntity.set(p.entityId, p);
            added++;
          }
        }
        log(
          `    pág ${page}: ${profiles.length} cards, ${added} nuevos (total únicos: ${byEntity.size})`
        );
        if (profiles.length < 10) break; // última página
      }
    }
  }
  log(`\nFetches totales: ${totalFetches}. Profesionales únicos: ${byEntity.size}`);
  return [...byEntity.values()];
}
```

- [ ] **Step 2.2: Crear `scraper/scrape-doctoralia-ratings.ts` (CLI)**

Contenido completo:

```ts
import * as fs from "fs";
import * as path from "path";
import { scrapeDoctoralia } from "./sources/doctoralia-ratings";

const OUT = path.join(__dirname, "../data/doctoralia-ratings.json");

function argInt(name: string): number | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  const n = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const limitEspecialidades = argInt("limit-esp");
  const limitProvincias = argInt("limit-prov");
  console.log(
    `Doctoralia ratings · limitEsp=${limitEspecialidades ?? "∞"} limitProv=${
      limitProvincias ?? "∞"
    }`
  );
  const t0 = Date.now();
  const profiles = await scrapeDoctoralia({
    limitEspecialidades,
    limitProvincias,
  });
  const elapsedMin = ((Date.now() - t0) / 60000).toFixed(1);
  fs.writeFileSync(OUT, JSON.stringify(profiles));
  const sizeMb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(
    `\n✓ ${profiles.length} perfiles → ${path.relative(
      process.cwd(),
      OUT
    )} (${sizeMb} MB, ${elapsedMin} min)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2.3: Actualizar `package.json`**

Reemplaza la línea del script `scrape:doctoralia` actual (que apunta al legacy `scrape.ts --only=doctoralia`) por:

```json
"scrape:doctoralia": "tsx scraper/scrape-doctoralia-ratings.ts",
```

El objeto `scripts` completo queda:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "scrape": "tsx scraper/scrape.ts",
  "scrape:doctoralia": "tsx scraper/scrape-doctoralia-ratings.ts",
  "scrape:google": "tsx scraper/scrape.ts --only=google",
  "scrape:adeslas": "tsx scraper/scrape-adeslas.ts",
  "scrape:occident": "tsx scraper/scrape-occident.ts"
}
```

- [ ] **Step 2.4: Smoke test — 2 especialidades × 2 provincias (~2 min)**

Ejecuta:

```bash
npm run scrape:doctoralia -- --limit-esp=2 --limit-prov=2
```

Expected stdout (aprox):
```
Doctoralia ratings · limitEsp=2 limitProv=2
  Alergología · A Coruña
    pág 1: N cards, N nuevos (total únicos: N)
    ...
  Alergología · Álava
    ...
  Andrología · A Coruña
    ...
  Andrología · Álava
    ...

Fetches totales: ~10-30. Profesionales únicos: ~20-60.
✓ N perfiles → data/doctoralia-ratings.json (0.01-0.05 MB, ~1-2 min)
```

Valida que `data/doctoralia-ratings.json` existe y contiene al menos un elemento con todos los campos:

```bash
node -e "const d=require('./data/doctoralia-ratings.json'); console.log('items:',d.length); console.log('sample:', JSON.stringify(d[0],null,2))"
```

Expected: `items: >0`, y el `sample` tiene `entityId`, `name`, `especialidadCanonical`, `provincia`, `rating`, `numReviews`, `url`, `cities: [...]`, `streets: [...]`.

Si `items: 0` o los slugs retornan 404, revisa el mapeo `ESPECIALIDAD_SLUGS` y corrige antes de commitear.

- [ ] **Step 2.5: Commit**

```bash
git add scraper/sources/doctoralia-ratings.ts scraper/scrape-doctoralia-ratings.ts package.json
git commit -m "Añade scraper bulk de Doctoralia (fetch + parse + dedup por entityId)"
```

No commitear aún `data/doctoralia-ratings.json` — el dataset completo se genera en Task 4.

---

## Task 3: Merger — enriquecer doctors.json con ratings

**Files:**
- Create: `scraper/enrich-ratings.ts`

Lee `doctors.json` y `doctoralia-ratings.json`, aplica matcheo por Jaccard(nombre) ≥ 0.5 + especialidad + provincia, desempata por subcadena de dirección, propaga rating a todas las filas del mismo doctor (mismo nombre+especialidad), escribe `doctors.json` y regenera `doctors.ts` shim.

- [ ] **Step 3.1: Crear `scraper/enrich-ratings.ts`**

Contenido completo:

```ts
import * as fs from "fs";
import * as path from "path";
import type { DoctoraliaProfile } from "./sources/doctoralia-ratings";

type DoctorRow = {
  id: number;
  nombre: string;
  especialidad: string;
  mutuas: string[];
  direccion: string;
  cp: string;
  ciudad: string;
  telefono?: string;
  rating: number;
  numReviews: number;
  doctoraliaUrl?: string;
};

const DOCTORS_JSON = path.join(__dirname, "../data/doctors.json");
const DOCTORS_TS = path.join(__dirname, "../data/doctors.ts");
const RATINGS_JSON = path.join(__dirname, "../data/doctoralia-ratings.json");

// CP-prefix (2 dígitos) → provincia, mismo listado que scraper/sources/doctoralia-ratings.ts:PROVINCIAS.
const CP_PREFIX_TO_PROVINCIA: Record<string, string> = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería",
  "05": "Ávila", "06": "Badajoz", "07": "Baleares", "08": "Barcelona",
  "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón",
  "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca",
  "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Guipúzcoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León",
  "25": "Lleida", "26": "La Rioja", "27": "Lugo", "28": "Madrid",
  "29": "Málaga", "30": "Murcia", "31": "Navarra", "32": "Ourense",
  "33": "Asturias", "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra",
  "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria",
  "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona",
  "44": "Teruel", "45": "Toledo", "46": "Valencia", "47": "Valladolid",
  "48": "Vizcaya", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta",
  "52": "Melilla",
};

const EXCLUDE_NAME_RE =
  /^(centro|cl[ií]nica|policl[ií]nic|hospital|instituto|sanitas|cap|cm|ambulatori|fundaci[oó]n)\b/i;

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(dr\.?a?\.?\s+)/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normName(s).split(" ").filter((t) => t.length > 2));
}

function jaccard(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter / uni : 0;
}

function streetOverlap(direccion: string, streets: string[]): number {
  if (!direccion || streets.length === 0) return 0;
  const dirToks = tokens(direccion);
  let best = 0;
  for (const s of streets) {
    const sToks = tokens(s);
    let inter = 0;
    for (const t of dirToks) if (sToks.has(t)) inter++;
    if (inter > best) best = inter;
  }
  return best;
}

function main() {
  if (!fs.existsSync(RATINGS_JSON)) {
    console.error(
      `No existe ${RATINGS_JSON}. Ejecuta 'npm run scrape:doctoralia' primero.`
    );
    process.exit(1);
  }
  const doctors = JSON.parse(fs.readFileSync(DOCTORS_JSON, "utf-8")) as DoctorRow[];
  const profiles = JSON.parse(
    fs.readFileSync(RATINGS_JSON, "utf-8")
  ) as DoctoraliaProfile[];
  console.log(`Doctors: ${doctors.length}. Profiles Doctoralia: ${profiles.length}`);

  // Indexar profiles por (especialidad + provincia) para búsqueda rápida.
  const index = new Map<string, DoctoraliaProfile[]>();
  for (const p of profiles) {
    const key = `${p.especialidadCanonical}::${p.provincia}`;
    const arr = index.get(key);
    if (arr) arr.push(p);
    else index.set(key, [p]);
  }

  // Cache de resultado por (normName + especialidad + provincia) para propagar
  // el mismo rating a todos los registros del mismo doctor.
  const cache = new Map<
    string,
    { rating: number; numReviews: number; url: string } | null
  >();

  let matched = 0;
  let ambiguousDiscarded = 0;
  let excludedInstitutional = 0;

  for (const d of doctors) {
    if (d.rating > 0) continue; // ya tiene rating propio de la mutua (Sanitas/DKV)
    if (EXCLUDE_NAME_RE.test(d.nombre)) {
      excludedInstitutional++;
      continue;
    }
    const provincia = CP_PREFIX_TO_PROVINCIA[d.cp.slice(0, 2)];
    if (!provincia) continue;

    const cacheKey = `${normName(d.nombre)}::${d.especialidad}::${provincia}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (cached) {
        d.rating = cached.rating;
        d.numReviews = cached.numReviews;
        d.doctoraliaUrl = cached.url;
        matched++;
      }
      continue;
    }

    const candidates = index.get(`${d.especialidad}::${provincia}`) ?? [];
    const scored = candidates
      .map((c) => ({ c, score: jaccard(c.name, d.nombre) }))
      .filter((x) => x.score >= 0.5)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      cache.set(cacheKey, null);
      continue;
    }

    // Empate: varios candidatos con el mismo score máximo → desempatar por calle.
    const topScore = scored[0].score;
    const tied = scored.filter((x) => x.score === topScore);
    let winner: DoctoraliaProfile | null = null;
    if (tied.length === 1) {
      winner = tied[0].c;
    } else {
      const byStreet = tied
        .map((x) => ({ c: x.c, overlap: streetOverlap(d.direccion, x.c.streets) }))
        .sort((a, b) => b.overlap - a.overlap);
      if (byStreet[0].overlap > 0 && byStreet[0].overlap > (byStreet[1]?.overlap ?? 0)) {
        winner = byStreet[0].c;
      } else {
        ambiguousDiscarded++;
      }
    }

    if (winner && winner.rating > 0) {
      const result = {
        rating: winner.rating,
        numReviews: winner.numReviews,
        url: winner.url,
      };
      d.rating = result.rating;
      d.numReviews = result.numReviews;
      d.doctoraliaUrl = result.url;
      cache.set(cacheKey, result);
      matched++;
    } else if (winner) {
      // matched pero sin reviews → guardamos url por si UI quiere enlazar igualmente,
      // pero no contamos como "con rating"
      d.doctoraliaUrl = winner.url;
      cache.set(cacheKey, {
        rating: 0,
        numReviews: 0,
        url: winner.url,
      });
    } else {
      cache.set(cacheKey, null);
    }
  }

  const withRating = doctors.filter((d) => d.rating > 0).length;
  const withUrl = doctors.filter((d) => d.doctoraliaUrl).length;

  console.log(`\nResultados:`);
  console.log(`  matched (rating aplicado): ${matched}`);
  console.log(`  total con rating final:    ${withRating}`);
  console.log(`  total con doctoraliaUrl:   ${withUrl}`);
  console.log(`  excluídos institucionales: ${excludedInstitutional}`);
  console.log(`  ambiguos descartados:      ${ambiguousDiscarded}`);

  fs.writeFileSync(DOCTORS_JSON, JSON.stringify(doctors));
  const sizeMb = (fs.statSync(DOCTORS_JSON).size / 1024 / 1024).toFixed(1);
  console.log(
    `\n✓ ${doctors.length} médicos → ${path.relative(process.cwd(), DOCTORS_JSON)} (${sizeMb} MB)`
  );

  // Regenerar shim — mismo patrón que scraper/build-doctors.ts
  fs.writeFileSync(
    DOCTORS_TS,
    `// Generado por scraper/enrich-ratings.ts — no editar a mano.
// Total: ${doctors.length} médicos. Última actualización: ${new Date().toISOString()}
import raw from "./doctors.json";
import type { Doctor } from "@/lib/types";

export const doctors: Array<Omit<Doctor, "distanceKm">> = raw as Array<Omit<Doctor, "distanceKm">>;
`
  );
  console.log(`✓ Shim escrito → ${path.relative(process.cwd(), DOCTORS_TS)}`);
}

main();
```

- [ ] **Step 3.2: Smoke test del merger con el output limitado de Step 2.4**

Verifica que el merger corre sin errores sobre el dataset mini generado en Step 2.4:

```bash
npx tsx scraper/enrich-ratings.ts
```

Expected stdout:
```
Doctors: 68473. Profiles Doctoralia: N
Resultados:
  matched (rating aplicado): >=0
  total con rating final:    >=0
  ...
✓ 68473 médicos → data/doctors.json (N.N MB)
✓ Shim escrito → data/doctors.ts
```

El número `matched` puede ser bajo (estamos con dataset mini). Lo importante es que no crashea, que `doctors.json` se reescribe y que los contadores cuadran (matched + ambiguousDiscarded + excludedInstitutional ≤ doctors totales sin rating).

- [ ] **Step 3.3: Revertir cambios de smoke test en data/ antes de commit**

El smoke test ha tocado `data/doctors.json` y `data/doctors.ts` con un dataset parcial. Restáuralos:

```bash
git checkout -- data/doctors.json data/doctors.ts
```

- [ ] **Step 3.4: Commit del merger (sin tocar data/)**

```bash
git add scraper/enrich-ratings.ts
git commit -m "Añade enrich-ratings: matchea doctors.json contra Doctoralia por Jaccard + provincia"
```

---

## Task 4: Ejecución end-to-end + commit de datos

**Files:**
- Generate: `data/doctoralia-ratings.json` (~3-6 MB, ~25-35 min scrape)
- Regenerate: `data/doctors.json` + `data/doctors.ts`

- [ ] **Step 4.1: Scrape completo de Doctoralia (33 especialidades × 52 provincias)**

Ejecuta:

```bash
npm run scrape:doctoralia
```

Expected duración: ~25-35 minutos. Stdout loggea cada combinación especialidad × provincia y cada página. Al final:
```
Fetches totales: ~8000-12000. Profesionales únicos: ~15000-30000.
✓ N perfiles → data/doctoralia-ratings.json (N.N MB, ~30 min)
```

Si alguna especialidad devuelve sistemáticamente 0 resultados en todas las provincias, el slug está mal. Pausa, corrige `ESPECIALIDAD_SLUGS` en `scraper/sources/doctoralia-ratings.ts`, re-ejecuta.

- [ ] **Step 4.2: Ejecutar merger completo**

```bash
npx tsx scraper/enrich-ratings.ts
```

Expected stdout (valor aproximado basado en muestreo previo — ~25% match rate):
```
Doctors: 68473. Profiles Doctoralia: ~20000
Resultados:
  matched (rating aplicado):  ~5000-12000
  total con rating final:     ~5000-12000
  total con doctoraliaUrl:    ~8000-15000
  excluídos institucionales:  ~3000-5000
  ambiguos descartados:       ~100-500
✓ 68473 médicos → data/doctors.json (N.N MB)
✓ Shim escrito → data/doctors.ts
```

Si `matched < 3000`, hay un bug de matching — revisar `normName`, `jaccard` threshold, o el mapeo `CP_PREFIX_TO_PROVINCIA`.

- [ ] **Step 4.3: Verificación manual en navegador**

```bash
npm run dev
```

Navega a `http://localhost:3000/resultados?mutua=Adeslas&especialidad=Dermatología&cp=28001`.
Expected:
- Arriba se ve el número total + aviso "Las valoraciones provienen de Doctoralia..."
- La **primera tarjeta** (ordenado por valoración) muestra un badge con un número tipo `4.8 ★` y debajo `N reseñas`
- Click en el badge abre una pestaña nueva en `doctoralia.es/...`
- Alguna tarjeta más abajo muestra badge gris `—` con tooltip "Sin valoraciones disponibles" al hacer hover

Prueba otra combinación: `?mutua=Sanitas&especialidad=Cardiología&cp=28001`. Expected:
- Los ratings de Sanitas siguen mostrándose (no fueron sobrescritos) — badges verdes/ámbar/rojo
- Sanitas no tiene `doctoraliaUrl`, así que los badges **no son clickables** (no tienen `<a>`). Correcto.

Mata el dev con `Ctrl+C`.

- [ ] **Step 4.4: Commit de datos generados**

```bash
git add data/doctoralia-ratings.json data/doctors.json data/doctors.ts
git commit -m "Datos: enriquece doctors.json con ratings de Doctoralia (~N matches)"
```

Sustituye `N` en el mensaje por el valor real de `matched` reportado en Step 4.2.

---

## Self-Review

**Spec coverage:**
- ✅ Scraper bulk Doctoralia con iteración especialidad × provincia — Task 2
- ✅ Output a `data/doctoralia-ratings.json` dedupado por entityId — Task 2
- ✅ Merger con Jaccard ≥ 0.5, match especialidad, provincia, desempate calle — Task 3
- ✅ No sobrescribir ratings existentes (filtro `if rating > 0 continue`) — Task 3
- ✅ Propagación a múltiples consultas del mismo doctor (cache por nombre+especialidad+provincia) — Task 3
- ✅ Campo `doctoraliaUrl?` en `Doctor` — Task 1
- ✅ Badge enlazado con hover sutil, estado `—` sin rating, tooltip — Task 1
- ✅ Aviso global en resultados — Task 1
- ✅ Filtro institucional para evitar rating a centros — Task 3 (`EXCLUDE_NAME_RE`)
- ✅ Logging de matches + ambiguous discarded + institucionales — Task 3
- ✅ Robustez: backoff 5s/15s/30s para 403/429 — Task 2
- ✅ Idempotencia: el scrape se puede re-correr — Task 2 (output sobrescribe)

**Placeholder scan:** Sin TBDs, sin "implementar después", sin "similar a". Cada step tiene código o comando concreto.

**Type consistency:** `DoctoraliaProfile` definido en `scraper/sources/doctoralia-ratings.ts` e importado en `enrich-ratings.ts`. `DoctorRow` redefinido localmente en el merger (el shape de `data/doctors.json` ya existente — es intencional para no depender del tipo canonical del front). `doctoraliaUrl?` consistente en `Doctor`, `DoctorRow`, y el uso en `DoctorCard`.
