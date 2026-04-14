import { doctors } from "@/data/doctors";
import { coordsFromCP, haversineKm } from "@/lib/coordinates";
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
  // Match permisivo: "Cardiología" encuentra "Cardiología Infantil",
  // "Cirugía general" encuentra "Cirugía General Y Del Aparato Digestivo", etc.
  return d.includes(q) || q.includes(d);
}

export function filterDoctors(
  mutua: string,
  especialidad: string,
  cp: string,
  maxKm?: number
): Doctor[] {
  const userCoords = cp ? coordsFromCP(cp) : null;

  return doctors
    .filter((doctor) => {
      const matchMutua =
        !mutua || mutua === "Sin mutua" ? true : doctor.mutuas.includes(mutua);

      const matchEspecialidad = especialidadMatches(doctor.especialidad, especialidad);

      if (!matchMutua || !matchEspecialidad) return false;

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
        userCoords && doctorCoords
          ? Math.round(haversineKm(userCoords, doctorCoords))
          : null;
      return { ...doctor, distanceKm };
    })
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.numReviews - a.numReviews;
    });
}
