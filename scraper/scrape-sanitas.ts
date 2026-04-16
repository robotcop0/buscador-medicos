/**
 * Scraper standalone del cuadro médico de Sanitas.
 *
 * Uso:
 *   npm run scrape:sanitas               → barre las 52 provincias × todas las especialidades
 *   npm run scrape:sanitas -- --limit=500  → para en cuanto llega a 500 docs únicos (debug)
 *   npm run scrape:sanitas -- --provincias=28,08  → solo Madrid y Barcelona
 *
 * Output: data/sanitas-raw.json
 */
import * as fs from "fs";
import * as path from "path";
import { scrapeSanitas } from "./sources/sanitas";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? parseInt(limitArg, 10) : undefined;
const provinciasArg = args.find((a) => a.startsWith("--provincias="))?.split("=")[1];
const provincias = provinciasArg
  ? provinciasArg.split(",").map((p) => parseInt(p, 10)).filter((n) => !isNaN(n))
  : undefined;

const OUT = path.join(__dirname, "../data/sanitas-raw.json");

function log(msg: string) {
  const t = new Date().toLocaleTimeString("es-ES");
  console.log(`[${t}] ${msg}`);
}

async function main() {
  log("=== Sanitas scraper ===");
  const t0 = Date.now();

  const docs = await scrapeSanitas({
    limit,
    provincias,
    logger: log,
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log(`✓ ${docs.length} médicos únicos en ${elapsed}s`);

  fs.writeFileSync(OUT, JSON.stringify(docs, null, 2));
  log(`✓ Escrito en ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
