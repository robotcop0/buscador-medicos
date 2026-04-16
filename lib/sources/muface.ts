/**
 * Cliente *live* de MUFACE (Mutualidad General de Funcionarios Civiles del Estado).
 *
 * MUFACE no tiene cuadro médico propio: delega en las entidades concertadas.
 * En el concierto 2025-2027 (vigente) son **Adeslas** y **Asisa**. Consultamos
 * ambos backends en paralelo con los filtros específicos de MUFACE y fusionamos:
 *   - Adeslas Elastic App Search con `md_id=4` (cuadro MUFACE)
 *   - Asisa AEM con `networkId=2` + `networkName=MUFACE`
 */
import { searchAsisaMuface } from "@/lib/sources/asisa";
import { searchAdeslasLive } from "@/lib/sources/adeslas-live";
import type { Doctor } from "@/lib/types";

export async function searchMuface(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!cp || !especialidad) return [];

  const [adeslas, asisa] = await Promise.all([
    searchAdeslasLive(cp, especialidad, {
      mdId: 4,
      mutuaLabel: "MUFACE",
      idOffset: 600_000_000,
      radiusKm: 25,
      maxResults: 100,
    }),
    searchAsisaMuface(cp, especialidad),
  ]);

  // Dedup cross-source por (nombre normalizado + CP) porque los mismos centros
  // pueden aparecer en ambas entidades con formato ligeramente distinto.
  const seen = new Set<string>();
  const merged: Doctor[] = [];
  for (const d of [...adeslas, ...asisa]) {
    const key = `${d.nombre.toLowerCase().trim()}|${d.cp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(d);
  }
  return merged;
}
