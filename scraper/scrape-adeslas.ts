/**
 * Scraper standalone del cuadro médico de Adeslas.
 *
 * Uso:
 *   npm run scrape:adeslas               → cuadro general (md_id=1, ~72k docs)
 *   npm run scrape:adeslas -- --all      → todos los cuadros (general + MUFACE + ISFAS + Senior)
 *   npm run scrape:adeslas -- --limit=500  → primeros 500 (debug)
 *
 * Output: data/adeslas-raw.json
 */
import * as fs from "fs";
import * as path from "path";
import { scrapeAdeslas } from "./sources/adeslas";

const args = process.argv.slice(2);
const all = args.includes("--all");
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? parseInt(limitArg, 10) : undefined;

const OUT = path.join(__dirname, "../data/adeslas-raw.json");

function log(msg: string) {
  const t = new Date().toLocaleTimeString("es-ES");
  console.log(`[${t}] ${msg}`);
}

async function main() {
  log("=== Adeslas scraper ===");
  const t0 = Date.now();

  const docs = await scrapeAdeslas({
    mdIds: all ? [1, 2, 4, 27] : [1],
    limit,
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
