/**
 * Fusiona los JSON crudos de cada scraper en el formato canonical que consume
 * la UI: `data/doctors.json` + shim `data/doctors.ts`.
 *
 * Fuentes leídas:
 *   - data/adeslas-raw.json  (npm run scrape:adeslas)
 *   - data/occident-raw.json (npm run scrape:occident)
 *
 * Dedup: si dos entradas coinciden en `normalize(nombre) + cp + especialidad`,
 * se fusionan conservando todas las mutuas.
 */
import * as fs from "fs";
import * as path from "path";
import type { RawDoctor } from "./types";

const SOURCES = [
  { path: "../data/adeslas-raw.json", mutua: "Adeslas" },
  { path: "../data/occident-raw.json", mutua: "Occidente" },
  { path: "../data/sanitas-raw.json", mutua: "Sanitas" },
];

const OUT_JSON = path.join(__dirname, "../data/doctors.json");
const OUT_TS = path.join(__dirname, "../data/doctors.ts");

type CanonicalDoctor = {
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
};

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  const buckets: RawDoctor[][] = [];
  for (const src of SOURCES) {
    const p = path.join(__dirname, src.path);
    if (!fs.existsSync(p)) {
      console.warn(`⚠ ${src.mutua}: ${src.path} no existe, omito. Ejecuta 'npm run scrape:${src.mutua.toLowerCase()}' primero.`);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as RawDoctor[];
    console.log(`Leídos ${raw.length} registros de ${src.path}`);
    buckets.push(raw);
  }

  if (buckets.length === 0) {
    console.error("No hay datos de origen. Aborto.");
    process.exit(1);
  }

  // Merge + dedup: conservar primera aparición, fusionar mutuas si coincide
  const map = new Map<string, RawDoctor>();
  for (const bucket of buckets) {
    for (const d of bucket) {
      const key = `${normalizeKey(d.nombre)}::${d.cp}::${normalizeKey(d.especialidad)}`;
      const existing = map.get(key);
      if (existing) {
        for (const m of d.mutuas) {
          if (!existing.mutuas.includes(m)) existing.mutuas.push(m);
        }
        if (!existing.telefono && d.telefono) existing.telefono = d.telefono;
        // Preservar el mejor rating disponible (Sanitas trae valoración real,
        // Adeslas no; nos quedamos con el que tiene más votos).
        if (d.numReviews > existing.numReviews) {
          existing.rating = d.rating;
          existing.numReviews = d.numReviews;
        }
      } else {
        map.set(key, { ...d, mutuas: [...d.mutuas] });
      }
    }
  }

  const all = Array.from(map.values());
  console.log(`Tras dedup: ${all.length} médicos únicos`);

  const canonical: CanonicalDoctor[] = all.map((d, i) => ({
    id: i + 1,
    nombre: d.nombre,
    especialidad: d.especialidad,
    mutuas: d.mutuas,
    direccion: d.direccion,
    cp: d.cp,
    ciudad: d.ciudad,
    telefono: d.telefono,
    rating: d.rating,
    numReviews: d.numReviews,
  }));

  fs.writeFileSync(OUT_JSON, JSON.stringify(canonical));
  const sizeMb = (fs.statSync(OUT_JSON).size / 1024 / 1024).toFixed(1);
  console.log(`✓ ${canonical.length} médicos → ${path.relative(process.cwd(), OUT_JSON)} (${sizeMb} MB)`);

  const porMutua: Record<string, number> = {};
  for (const d of canonical) {
    for (const m of d.mutuas) porMutua[m] = (porMutua[m] || 0) + 1;
  }
  console.log(`Por mutua: ${Object.entries(porMutua).map(([k, v]) => `${k}=${v}`).join(", ")}`);

  fs.writeFileSync(
    OUT_TS,
    `// Generado por scraper/build-doctors.ts — no editar a mano.
// Total: ${canonical.length} médicos. Última actualización: ${new Date().toISOString()}
import raw from "./doctors.json";
import type { Doctor } from "@/lib/types";

export const doctors: Array<Omit<Doctor, "distanceKm">> = raw as Array<Omit<Doctor, "distanceKm">>;
`
  );
  console.log(`✓ Shim escrito → ${path.relative(process.cwd(), OUT_TS)}`);
}

main();
