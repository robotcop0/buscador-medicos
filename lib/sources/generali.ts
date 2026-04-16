/**
 * Cliente *live* de Generali Salud Premium.
 *
 * Generali vende el producto pero el cuadro médico es el de Sanitas: la
 * página pública https://www.generali.es/cuadro-medico-salud incrusta el SPA
 * de sanitas.es vía iframe con `parametroGet=generali`. No hay API propia de
 * Generali, así que reutilizamos `searchSanitas` y reetiquetamos.
 *
 * Si en el futuro Sanitas expone el subconjunto Generali, habría que
 * resolver los numeric `guias` asociados a `parametroGet=generali` en el
 * bundle del SPA (ver `memory/reference_generali_api.md`).
 */
import { searchSanitas } from "@/lib/sources/sanitas";
import type { Doctor } from "@/lib/types";

const ID_OFFSET = 500_000_000;

export async function searchGenerali(cp: string, especialidad: string): Promise<Doctor[]> {
  const base = await searchSanitas(cp, especialidad).catch(() => []);
  return base.map<Doctor>((d, idx) => ({
    ...d,
    id: ID_OFFSET + idx,
    mutuas: ["Generali"],
  }));
}
