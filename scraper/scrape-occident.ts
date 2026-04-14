/**
 * Scraper standalone del cuadro médico de Occident.
 *
 * Uso:
 *   npm run scrape:occident                    → todas las especialidades y provincias
 *   npm run scrape:occident -- --limit=500     → primeros 500 (debug)
 *   npm run scrape:occident -- --prov=28,08    → solo Madrid y Barcelona
 *   npm run scrape:occident -- --esp=009       → solo Cardiología
 *
 * Output: data/occident-raw.json
 */
import * as fs from "fs";
import * as path from "path";
import { scrapeOccident } from "./sources/occident";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const espArg = args.find((a) => a.startsWith("--esp="))?.split("=")[1];
const provArg = args.find((a) => a.startsWith("--prov="))?.split("=")[1];

const OUT = path.join(__dirname, "../data/occident-raw.json");

function log(msg: string) {
  const t = new Date().toLocaleTimeString("es-ES");
  console.log(`[${t}] ${msg}`);
}

async function main() {
  log("=== Occident scraper ===");
  const t0 = Date.now();

  const docs = await scrapeOccident({
    limit: limitArg ? parseInt(limitArg, 10) : undefined,
    especialidades: espArg ? espArg.split(",") : undefined,
    provincias: provArg ? provArg.split(",") : undefined,
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
