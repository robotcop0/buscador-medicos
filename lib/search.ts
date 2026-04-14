import { doctors } from "@/data/doctors";
import { coordsFromCP, haversineKm } from "@/lib/coordinates";
import { searchOccident } from "@/lib/sources/occident";
import { searchAllianz } from "@/lib/sources/allianz";
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
  const userCoords = cp ? coordsFromCP(cp) : null;
  return list
    .filter((doctor) => {
      if (!cp || !userCoords) return true;
      const doctorCoords = coordsFromCP(doctor.cp);
      if (!doctorCoords) return true;
      const km = haversineKm(userCoords, doctorCoords);
      if (!maxKm) return doctor.cp.slice(0, 2) === cp.slice(0, 2);
      return km <= maxKm;
    })
    .map<Doctor>((doctor) => {
      const doctorCoords = userCoords ? coordsFromCP(doctor.cp) : null;
      const distanceKm =
        userCoords && doctorCoords ? Math.round(haversineKm(userCoords, doctorCoords)) : null;
      return { ...doctor, distanceKm };
    });
}

export async function filterDoctors(
  mutua: string,
  especialidad: string,
  cp: string,
  maxKm?: number
): Promise<Doctor[]> {
  const wantAdeslas = !mutua || mutua === "Adeslas";
  const wantOccidente = !mutua || mutua === "Occidente";
  const wantAllianz = !mutua || mutua === "Allianz";

  const offline = wantAdeslas
    ? (doctors as Doctor[]).filter((d) => {
        const matchMutua = !mutua ? true : d.mutuas.includes(mutua);
        return matchMutua && especialidadMatches(d.especialidad, especialidad);
      })
    : [];

  // Occident exige especialidad en su endpoint. Allianz sí sabe hacer fan-out
  // cuando no se especifica (barre todas las especialidades principales).
  const [occident, allianz] = await Promise.all([
    wantOccidente && especialidad ? searchOccident(cp, especialidad) : Promise.resolve([]),
    wantAllianz && cp ? searchAllianz(cp, especialidad) : Promise.resolve([]),
  ]);

  const merged = [
    ...applyGeo(offline, cp, maxKm),
    ...applyGeo(occident, cp, maxKm),
    ...applyGeo(allianz, cp, maxKm),
  ];

  return merged.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.numReviews - a.numReviews;
  });
}
