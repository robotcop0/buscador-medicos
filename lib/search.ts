import { doctors } from "@/data/doctors";
import { coordsFromCP, haversineKm } from "@/lib/coordinates";
import { searchAllianz } from "@/lib/sources/allianz";
import { searchMapfre } from "@/lib/sources/mapfre";
import { searchAxa } from "@/lib/sources/axa";
import type { Doctor } from "@/lib/types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function especialidadMatches(doctor: string, query: string): boolean {
  if (!query) return true;
  const d = normalize(doctor);
  const q = normalize(query);
  return d.includes(q) || q.includes(d);
}

function applyGeo(list: Doctor[], cp: string, maxKm?: number): Doctor[] {
  if (!cp) return list;
  const userCoords = coordsFromCP(cp);
  // Sin radio: filtro por provincia.
  if (!maxKm) {
    return list
      .filter((d) => d.cp.slice(0, 2) === cp.slice(0, 2))
      .map((d) => {
        const dc = coordsFromCP(d.cp);
        const distanceKm =
          userCoords && dc ? Math.round(haversineKm(userCoords, dc)) : null;
        return { ...d, distanceKm };
      });
  }
  // Con radio: filtro por Haversine. Si no tenemos coords del usuario, no hay nada que hacer.
  if (!userCoords) return [];
  return list
    .map((d) => {
      const dc = coordsFromCP(d.cp);
      const km = dc ? haversineKm(userCoords, dc) : null;
      return { ...d, _km: km };
    })
    .filter((d) => d._km !== null && d._km <= maxKm)
    .map(({ _km, ...d }) => ({ ...d, distanceKm: Math.round(_km as number) }));
}

export async function filterDoctors(
  mutua: string,
  especialidad: string,
  cp: string,
  maxKm?: number
): Promise<Doctor[]> {
  // Mutuas offline (datos en data/doctors.ts generado por scraper).
  const offlineMutuas = new Set(["Adeslas", "Sanitas"]);
  const wantOffline = !mutua || offlineMutuas.has(mutua);
  const wantAllianz = !mutua || mutua === "Allianz";
  const wantMapfre = !mutua || mutua === "Mapfre";
  const wantAxa = !mutua || mutua === "AXA Salud";

  const offline = wantOffline
    ? (doctors as Doctor[]).filter((d) => {
        const matchMutua = !mutua ? true : d.mutuas.includes(mutua);
        return matchMutua && especialidadMatches(d.especialidad, especialidad);
      })
    : [];

  // Allianz hace fan-out si no se pasa especialidad.
  // Mapfre acepta radio sin especialidad (devuelve todo lo cercano).
  const [allianz, mapfre, axa] = await Promise.all([
    wantAllianz && cp ? searchAllianz(cp, especialidad) : Promise.resolve([]),
    wantMapfre && cp ? searchMapfre(cp, especialidad) : Promise.resolve([]),
    wantAxa && cp ? searchAxa(cp, especialidad) : Promise.resolve([]),
  ]);

  const merged = [
    ...applyGeo(offline, cp, maxKm),
    ...applyGeo(allianz, cp, maxKm),
    ...applyGeo(mapfre, cp, maxKm),
    ...applyGeo(axa, cp, maxKm),
  ];

  return merged.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.numReviews - a.numReviews;
  });
}
