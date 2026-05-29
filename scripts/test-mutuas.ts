import { searchAllianz } from "../lib/sources/allianz";
import { searchMapfre } from "../lib/sources/mapfre";
import { searchSanitas } from "../lib/sources/sanitas";
import { searchAxa } from "../lib/sources/axa";
import { searchCaser } from "../lib/sources/caser";
import { searchGenerali } from "../lib/sources/generali";

const tests: Array<[string, () => Promise<any[]>]> = [
  ["Allianz", () => searchAllianz("28001", "Cardiología")],
  ["Mapfre",  () => searchMapfre("28001", "Cardiología")],
  ["Sanitas", () => searchSanitas("28001", "Cardiología")],
  ["AXA",     () => searchAxa("28001", "Cardiología")],
  ["Caser",   () => searchCaser("28001", "Cardiología")],
  ["Generali",() => searchGenerali("28001", "Cardiología")],
];

(async () => {
  for (const [name, fn] of tests) {
    const t0 = Date.now();
    try {
      const r = await Promise.race([
        fn(),
        new Promise<any[]>((_, rej) => setTimeout(() => rej(new Error("timeout 15s")), 15000)),
      ]);
      console.log(`${name.padEnd(10)} OK  n=${r.length}  ${Date.now()-t0}ms`);
    } catch (e: any) {
      console.log(`${name.padEnd(10)} ERR  ${Date.now()-t0}ms  ${e.message?.slice(0,200)}`);
    }
  }
})();
