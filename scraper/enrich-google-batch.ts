/**
 * Enriquecimiento offline de ratings de Google Maps para toda la base de datos.
 *
 * Lee `data/doctors.json`, llama al sidecar Python en localhost:8765
 * para cada doctor/centro y persiste los resultados en `data/google-ratings.json`.
 *
 * Uso:
 *   npm run enrich:google                                    → todos los registros
 *   npm run enrich:google -- --only=centers                 → solo centros (isCenter)
 *   npm run enrich:google -- --only=persons                 → solo personas
 *   npm run enrich:google -- --especialidad=Cardiología     → filtro por especialidad
 *   npm run enrich:google -- --provincia=28                 → filtro por 2 primeros dígitos del CP
 *   npm run enrich:google -- --limit=100                    → máximo 100 entradas procesadas
 *   npm run enrich:google -- --resume                       → salta entradas ya frescas (TTL 90 días)
 *
 * Todos los flags son combinables.
 *
 * La lista de trabajo se ordena por frecuencia de especialidad descendente para
 * aprovechar el calentamiento del sidecar en las especialidades más comunes primero.
 *
 * Diseñado para ejecutarse secuencialmente (el sidecar es un proceso single-instance).
 */
import * as fs from "fs";
import * as path from "path";
import { resolveGoogleRating, persistGoogleRating } from "@/lib/google-resolve";
import { isCenter } from "@/lib/center";
import { normNameKey } from "@/lib/ratings-index";
import { readMisses, persistMiss, MISS_TTL_MS } from "@/lib/google-misses";
import type { Doctor } from "@/lib/types";
import type { GoogleRatingRecord } from "@/lib/google-ratings-index";

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

const resume = args.includes("--resume");
const onlyArg = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const especialidadArg = args
  .find((a) => a.startsWith("--especialidad="))
  ?.split("=")
  .slice(1)
  .join("=");
const provinciaArg = args.find((a) => a.startsWith("--provincia="))?.split("=")[1];
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? parseInt(limitArg, 10) : undefined;

// ─── Paths ───────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const DOCTORS_FILE = path.join(DATA_DIR, "doctors.json");
const RATINGS_FILE = path.join(DATA_DIR, "google-ratings.json");

// ─── TTL para el modo --resume ────────────────────────────────────────────────

const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 días en milisegundos

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  const t = new Date().toLocaleTimeString("es-ES");
  console.log(`[${t}] ${msg}`);
}

function normTextSimple(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function readRatingsFile(): GoogleRatingRecord[] {
  try {
    const raw = fs.readFileSync(RATINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as GoogleRatingRecord[];
  } catch {
    // archivo ausente o corrupto
  }
  return [];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("=== enrich:google — inicio ===");

  // 1. Cargar datos de médicos
  let allDoctors: Doctor[] = [];
  try {
    const raw = fs.readFileSync(DOCTORS_FILE, "utf-8");
    allDoctors = JSON.parse(raw) as Doctor[];
  } catch (err) {
    console.error("No se pudo leer data/doctors.json:", err);
    process.exit(1);
  }
  log(`${allDoctors.length} doctores cargados desde data/doctors.json`);

  // 2. Aplicar filtros de selección
  let workList = allDoctors;

  if (onlyArg === "centers") {
    workList = workList.filter((d) => isCenter(d.nombre));
  } else if (onlyArg === "persons") {
    workList = workList.filter((d) => !isCenter(d.nombre));
  }

  if (especialidadArg) {
    const needle = normTextSimple(especialidadArg);
    workList = workList.filter((d) =>
      normTextSimple(d.especialidad ?? "").includes(needle)
    );
  }

  if (provinciaArg) {
    workList = workList.filter(
      (d) => d.cp?.slice(0, 2) === provinciaArg
    );
  }

  // 3. Ordenar por frecuencia de especialidad descendente (más común primero)
  {
    const counts = new Map<string, number>();
    for (const d of workList) {
      const esp = d.especialidad ?? "";
      counts.set(esp, (counts.get(esp) ?? 0) + 1);
    }
    workList = [...workList].sort(
      (a, b) =>
        (counts.get(b.especialidad ?? "") ?? 0) -
        (counts.get(a.especialidad ?? "") ?? 0)
    );
  }

  // 4. Aplicar --limit DESPUÉS de ordenar por popularidad
  if (limit !== undefined && limit > 0) {
    workList = workList.slice(0, limit);
  }

  log(
    `${workList.length} entradas en la lista de trabajo` +
      (onlyArg ? ` (--only=${onlyArg})` : "") +
      (especialidadArg ? ` (--especialidad=${especialidadArg})` : "") +
      (provinciaArg ? ` (--provincia=${provinciaArg})` : "") +
      (limit !== undefined ? ` (--limit=${limit})` : "")
  );

  // 5. Construir Set de claves frescas si --resume (hits + misses cacheados)
  const freshKeys = new Set<string>();
  const missMap = readMisses();
  if (resume) {
    const existing = readRatingsFile();
    const now = Date.now();
    let freshHitCount = 0;
    for (const rec of existing) {
      if (rec.nameKey && rec.cpPrefix && typeof rec.at === "number") {
        if (now - rec.at < TTL_MS) {
          freshKeys.add(`${rec.nameKey}::${rec.cpPrefix}`);
          freshHitCount++;
        }
      }
    }
    let freshMissCount = 0;
    for (const [key, at] of missMap) {
      if (now - at < MISS_TTL_MS) {
        freshKeys.add(key);
        freshMissCount++;
      }
    }
    log(
      `--resume: ${freshHitCount} ratings frescos (TTL ${TTL_MS / 86400000}d) + ` +
        `${freshMissCount} sin-match frescos (TTL ${MISS_TTL_MS / 86400000}d) → serán omitidos`
    );
  }

  // 6. Procesar secuencialmente
  const total = workList.length;
  let done = 0;
  let hits = 0;
  let misses = 0;
  let skipped = 0;
  let errors = 0;

  for (const doctor of workList) {
    const { nombre, cp, ciudad, especialidad } = doctor;

    // Saltar si ya está fresco (--resume): rating cacheado o miss cacheado
    if (resume && cp && cp.length >= 2) {
      const key = `${normNameKey(nombre)}::${cp.slice(0, 2)}`;
      if (freshKeys.has(key)) {
        done++;
        skipped++;
        if (done % 50 === 0) {
          log(
            `${done}/${total} procesados, ${hits} hits, ${misses} sin-match cacheados, ` +
              `${skipped} omitidos, ${errors} errores`
          );
        }
        continue;
      }
    }

    // Llamar al sidecar (vía resolveGoogleRating, lógica compartida con la API route)
    let rec: GoogleRatingRecord | null = null;
    try {
      rec = await resolveGoogleRating({
        nombre,
        cp: cp ?? "",
        ciudad: ciudad ?? "",
        especialidad: especialidad ?? "",
      });
    } catch (err) {
      // TRANSIENT (sidecar caído / red / JSON inválido): NO cacheamos miss,
      // se reintentará en la próxima corrida.
      errors++;
      log(`WARN: error transitorio al resolver "${nombre}" (${cp}): ${err}`);
      done++;
      continue;
    }

    if (rec) {
      persistGoogleRating(rec);
      hits++;
    } else {
      // GENUINE no-match: Google respondió pero sin nada usable/relevante.
      persistMiss(normNameKey(nombre), (cp ?? "").slice(0, 2));
      misses++;
    }

    done++;

    if (done % 50 === 0) {
      log(
        `${done}/${total} procesados, ${hits} hits, ${misses} sin-match cacheados, ` +
          `${skipped} omitidos, ${errors} errores`
      );
    }
  }

  log(
    `FIN: ${done} procesados, ${hits} hits, ${misses} sin-match cacheados, ` +
      `${skipped} omitidos, ${errors} errores`
  );
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
