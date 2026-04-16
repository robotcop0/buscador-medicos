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
  /^(centro|cl[ií]nica|policl[ií]nica?|hospital|instituto|sanitas|cap|cm|ambulatori[oa]?|fundaci[oó]n)\b/i;

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
  if (!fs.existsSync(DOCTORS_JSON)) {
    console.error(
      `No existe ${DOCTORS_JSON}. Ejecuta 'npm run scrape:adeslas' + 'npx tsx scraper/build-doctors.ts' primero.`
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
        d.doctoraliaUrl = cached.url;
        // Mismo criterio que la rama de fresh-compute: sólo contamos
        // "matched" y asignamos rating cuando el candidato tenía rating > 0.
        if (cached.rating > 0) {
          d.rating = cached.rating;
          d.numReviews = cached.numReviews;
          matched++;
        }
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
