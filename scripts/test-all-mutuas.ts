/**
 * End-to-end check del camino REAL de la página de resultados: `findDoctors()`
 * (offline Adeslas + fuentes live + geo-filtro + merge + orden bayesiano).
 *
 * A diferencia de `test-mutuas.ts` (que llama directo a cada `lib/sources/*`),
 * esto ejercita exactamente lo que ejecuta `/resultados` por cada mutua del
 * desplegable, con su nombre EXACTO tal y como lo manda `SearchForm`.
 *
 * Uso: node --env-file-if-exists=.env.local --import tsx scripts/test-all-mutuas.ts
 */
import { findDoctors } from "../lib/doctorSearch";

// [nombre EXACTO del form, [CPs región-núcleo a probar en orden]]
const MUTUAS: Array<[string, string[]]> = [
  ["Adeslas", ["28001"]],
  ["Allianz", ["28001"]],
  ["Asisa", ["28001"]],
  ["AXA Salud", ["08001", "28001"]],
  ["Caser Salud", ["28001"]],
  ["Cigna", ["28001"]],
  ["DKV", ["28001"]],
  ["Divina Pastora", ["46001", "28001"]],
  ["Fiatc", ["08001", "28001"]],
  ["Generali", ["28001"]],
  ["IMQ", ["48001", "28001"]],
  ["Mapfre", ["28001"]],
  ["MUFACE", ["28001"]],
  ["Occidente", ["08001", "28001"]],
  ["Sanitas", ["28001"]],
];

const ESPECIALIDAD = "Cardiología";
const TIMEOUT_MS = 25000;

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

(async () => {
  let failures = 0;
  for (const [mutua, cps] of MUTUAS) {
    let ok = false;
    let example = "";
    for (const cp of cps) {
      const t0 = Date.now();
      try {
        const { doctors } = await withTimeout(findDoctors(mutua, ESPECIALIDAD, cp));
        const ms = Date.now() - t0;
        if (doctors.length > 0) {
          const d = doctors[0];
          ok = true;
          example = `n=${doctors.length} cp=${cp} ${ms}ms — ${d.nombre} (${d.cp} ${d.ciudad ?? ""}) [${d.mutuas.join(",")}]`;
          break;
        }
      } catch (e) {
        console.log(`${mutua.padEnd(16)} ERR  cp=${cp}  ${(e as Error).message}`);
      }
    }
    if (ok) {
      console.log(`${mutua.padEnd(16)} ✅  ${example}`);
    } else {
      console.log(`${mutua.padEnd(16)} ❌  0 en ${cps.join("/")} → NO FUNCIONA`);
      failures++;
    }
  }
  console.log(
    failures === 0
      ? "\n✓ Las 15 mutuas devuelven resultados por el camino real de /resultados."
      : `\n✗ ${failures} mutua(s) sin resultados — revisar.`
  );
  process.exit(failures === 0 ? 0 : 1);
})();
