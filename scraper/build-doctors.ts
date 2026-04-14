/**
 * Convierte `data/adeslas-raw.json` (output del scraper) al formato canonical
 * consumido por la UI: `data/doctors.json` + un shim `data/doctors.ts`.
 *
 * Se ejecuta como un paso separado del scraping para poder iterar sobre el
 * formato sin volver a pegar a Adeslas.
 */
import * as fs from "fs";
import * as path from "path";
import type { RawDoctor } from "./types";

const RAW = path.join(__dirname, "../data/adeslas-raw.json");
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

function main() {
  if (!fs.existsSync(RAW)) {
    console.error(`No existe ${RAW}. Ejecuta primero: npm run scrape:adeslas`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RAW, "utf-8")) as RawDoctor[];
  console.log(`Leídos ${raw.length} registros de adeslas-raw.json`);

  const canonical: CanonicalDoctor[] = raw.map((d, i) => ({
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

  // Shim TS que re-exporta el JSON con el tipo canonical.
  const shim = `// Generado por scraper/build-doctors.ts — no editar a mano.
// Total: ${canonical.length} médicos (Adeslas cuadro general, última actualización ${new Date().toISOString()})
import raw from "./doctors.json";
import type { Doctor } from "@/lib/types";

export const doctors = raw as Omit<Doctor, "distanceKm" | "telefono"> &
  { telefono?: string }[] extends infer _ ? Array<Omit<Doctor, "distanceKm" | "telefono"> & { telefono?: string }> : never;
`;

  // Simpler shim — el tipo complicado de arriba es una tontería.
  fs.writeFileSync(
    OUT_TS,
    `// Generado por scraper/build-doctors.ts — no editar a mano.
// Total: ${canonical.length} médicos (Adeslas cuadro general).
import raw from "./doctors.json";
import type { Doctor } from "@/lib/types";

export const doctors: Array<Omit<Doctor, "distanceKm">> = raw as Array<Omit<Doctor, "distanceKm">>;
`
  );
  console.log(`✓ Shim escrito → ${path.relative(process.cwd(), OUT_TS)}`);
}

main();
