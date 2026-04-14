/**
 * Buscador de Médicos — Scraper
 *
 * Uso:
 *   npx tsx scraper/scrape.ts              → scraping completo (Doctoralia + Google Maps)
 *   npx tsx scraper/scrape.ts --only=doctoralia  → solo Doctoralia (más rápido)
 *   npx tsx scraper/scrape.ts --only=google      → solo Google Maps
 *
 * Genera data/doctors.ts con datos reales.
 * Duración estimada: 20-40 min (completo), 10-15 min (solo Doctoralia)
 */

import * as fs from "fs";
import * as path from "path";
import { scrapeDoctoralia } from "./sources/doctoralia";
import { scrapeGoogleMaps } from "./sources/googlemaps";
import { mergeAndDeduplicate, toTypeScriptFile } from "./merge";
import { RawDoctor } from "./types";

const args = process.argv.slice(2);
const onlyFlag = args.find((a) => a.startsWith("--only="))?.split("=")[1];

const OUT_PATH = path.join(__dirname, "../data/doctors.ts");
const CACHE_PATH = path.join(__dirname, "cache.json");

function log(msg: string) {
  const time = new Date().toLocaleTimeString("es-ES");
  console.log(`[${time}] ${msg}`);
}

function saveCache(data: RawDoctor[]) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
  log(`Cache guardado en scraper/cache.json (${data.length} médicos)`);
}

function loadCache(): RawDoctor[] | null {
  if (!fs.existsSync(CACHE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

async function main() {
  log("=== Buscador de Médicos — Scraper iniciado ===");

  let allDoctors: RawDoctor[] = [];

  // --- Doctoralia ---
  if (!onlyFlag || onlyFlag === "doctoralia") {
    log("\n[1/2] Scraping Doctoralia...");
    log("  (pausa de 1.2s entre peticiones para evitar bloqueos)");
    try {
      const doctoraliaResults = await scrapeDoctoralia(log);
      log(`  ✓ Doctoralia: ${doctoraliaResults.length} médicos únicos`);
      allDoctors.push(...doctoraliaResults);
      saveCache(allDoctors);
    } catch (err) {
      log(`  ✗ Error en Doctoralia: ${err}`);
      log("  Intentando cargar cache anterior...");
      const cached = loadCache();
      if (cached) {
        allDoctors = cached.filter((d) => d.source === "doctoralia");
        log(`  Cache cargado: ${allDoctors.length} médicos`);
      }
    }
  }

  // --- Google Maps ---
  if (!onlyFlag || onlyFlag === "google") {
    log("\n[2/2] Scraping Google Maps (complemento)...");
    log("  (solo médicos no encontrados en Doctoralia)");

    const knownNames = new Set(
      allDoctors.map((d) =>
        d.nombre
          .toLowerCase()
          .replace(/^(dr\.?a?\.?\s+)/i, "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim() +
        "::" +
        d.ciudad.toLowerCase()
      )
    );

    try {
      const googleResults = await scrapeGoogleMaps(knownNames, log);
      log(`  ✓ Google Maps: ${googleResults.length} médicos adicionales`);
      allDoctors.push(...googleResults);
      saveCache(allDoctors);
    } catch (err) {
      log(`  ✗ Error en Google Maps: ${err}`);
    }
  }

  // --- Merge & dedup ---
  log("\n[3/3] Deduplicando y mergeando...");
  const merged = mergeAndDeduplicate(allDoctors);
  log(`  Total final: ${merged.length} médicos únicos`);

  // Estadísticas
  const porCiudad = merged.reduce<Record<string, number>>((acc, d) => {
    acc[d.ciudad] = (acc[d.ciudad] || 0) + 1;
    return acc;
  }, {});
  log("  Por ciudad: " + Object.entries(porCiudad).map(([c, n]) => `${c}: ${n}`).join(", "));

  const porFuente = merged.reduce<Record<string, number>>((acc, d) => {
    acc[d.source] = (acc[d.source] || 0) + 1;
    return acc;
  }, {});
  log("  Por fuente: " + Object.entries(porFuente).map(([s, n]) => `${s}: ${n}`).join(", "));

  // --- Escribir output ---
  const tsContent = toTypeScriptFile(merged);
  fs.writeFileSync(OUT_PATH, tsContent);
  log(`\n✓ Datos escritos en data/doctors.ts`);
  log("  Ejecuta 'npm run build' para verificar que compila.");
  log("\n=== Scraper completado ===");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
