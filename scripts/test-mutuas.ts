/**
 * Health-check de las fuentes LIVE (`lib/sources/*`).
 *
 * Los clientes live nunca lanzan: devuelven [] en cualquier error, así que un
 * fallo (API caída, markup cambiado, token ausente) queda SILENCIADO en la UI.
 * Este script los ejerce uno a uno para detectar esas roturas mudas.
 *
 * Cada fuente se prueba con CPs de su región NÚCLEO (las regionales — IMQ/País
 * Vasco, Occident/Fiatc/Cataluña, Divina Pastora/Valencia — dan 0 en Madrid sin
 * estar rotas). Se prueba en orden hasta que una devuelve resultados.
 *
 * Uso: npm run test:mutuas   (carga .env.local vía --env-file-if-exists)
 */
import { searchOccident } from "../lib/sources/occident";
import { searchAllianz } from "../lib/sources/allianz";
import { searchMapfre } from "../lib/sources/mapfre";
import { searchSanitas } from "../lib/sources/sanitas";
import { searchAxa } from "../lib/sources/axa";
import { searchCaser } from "../lib/sources/caser";
import { searchCigna } from "../lib/sources/cigna";
import { searchDivinaPastora } from "../lib/sources/divina-pastora";
import { searchAsisa } from "../lib/sources/asisa";
import { searchDkv } from "../lib/sources/dkv";
import { searchImq } from "../lib/sources/imq";
import { searchMuface } from "../lib/sources/muface";
import { searchGenerali } from "../lib/sources/generali";
import { searchFiatc } from "../lib/sources/fiatc";
import type { Doctor } from "../lib/types";

type Fn = (cp: string, especialidad: string) => Promise<Doctor[]>;
// [nombre, fn, [CPs región-núcleo a probar en orden], expectedZero?]
// expectedZero=true → devolver 0 es lo ESPERADO (no una regresión), p.ej. las
// fuentes que requieren un secret que hoy no está configurado.
const SOURCES: Array<[string, Fn, string[], boolean?]> = [
  ["Occidente",      searchOccident,      ["08001", "28001"]],
  ["Allianz",        searchAllianz,       ["28001", "08001"]],
  ["Mapfre",         searchMapfre,        ["28001", "08001"]],
  ["AXA",            searchAxa,           ["28001", "08001"]],
  ["Caser",          searchCaser,         ["28001", "08001"]],
  ["Cigna",          searchCigna,         ["28001", "08001"]],
  ["Asisa",          searchAsisa,         ["28001", "08001"]],
  ["DKV",            searchDkv,           ["28001", "08001"]],
  ["Divina Pastora", searchDivinaPastora, ["46001", "28001"]],
  ["Fiatc",          searchFiatc,         ["08001", "28001"]],
  ["IMQ",            searchImq,           ["48001", "28001"]],
  ["MUFACE",         searchMuface,        ["28001", "41001"]],
  ["Sanitas",        searchSanitas,       ["28001", "08001"], true], // requiere SANITAS_APIKEY
  ["Generali",       searchGenerali,      ["28001", "08001"], true], // delega en Sanitas
];

const ESPECIALIDAD = "Cardiología";
const TIMEOUT_MS = 20000;

async function withTimeout(p: Promise<Doctor[]>): Promise<Doctor[]> {
  return Promise.race([
    p,
    new Promise<Doctor[]>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

(async () => {
  let regressions = 0;
  for (const [name, fn, cps, expectedZero] of SOURCES) {
    let ok = false;
    let lastMs = 0;
    let example = "";
    for (const cp of cps) {
      const t0 = Date.now();
      try {
        const r = await withTimeout(fn(cp, ESPECIALIDAD));
        lastMs = Date.now() - t0;
        if (r.length > 0) {
          ok = true;
          example = `n=${r.length} cp=${cp} ${lastMs}ms — ${r[0].nombre} (${r[0].cp} ${r[0].ciudad ?? ""})`;
          break;
        }
      } catch (e) {
        lastMs = Date.now() - t0;
        console.log(`${name.padEnd(15)} ERR  cp=${cp} ${lastMs}ms  ${(e as Error).message}`);
      }
    }
    if (ok) {
      console.log(`${name.padEnd(15)} ✅  ${example}`);
    } else if (expectedZero) {
      console.log(`${name.padEnd(15)} 🚧  0 (esperado — sin secret configurado)`);
    } else {
      console.log(`${name.padEnd(15)} ❌  0 en ${cps.join("/")} → POSIBLE REGRESIÓN`);
      regressions++;
    }
  }
  console.log(
    regressions === 0
      ? "\n✓ Todas las fuentes operativas dieron resultados."
      : `\n✗ ${regressions} fuente(s) sin resultados inesperadamente — revisar.`
  );
  process.exit(regressions === 0 ? 0 : 1);
})();
