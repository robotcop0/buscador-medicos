import { doctors, Doctor } from "@/data/doctors";
import { coordsFromCP, haversineKm } from "@/lib/coordinates";

export type DoctorWithDistance = Doctor & { distanceKm: number | null };

export function filterDoctors(
  mutua: string,
  especialidad: string,
  cp: string,
  maxKm?: number
): DoctorWithDistance[] {
  const userCoords = cp ? coordsFromCP(cp) : null;

  return doctors
    .filter((doctor) => {
      const matchMutua =
        !mutua || mutua === "Sin mutua" ? true : doctor.mutuas.includes(mutua);

      const matchEspecialidad =
        !especialidad || doctor.especialidad === especialidad;

      if (!matchMutua || !matchEspecialidad) return false;

      // Si no hay CP, no filtramos por distancia
      if (!cp || !userCoords) return true;

      const doctorCoords = coordsFromCP(doctor.cp);
      if (!doctorCoords) return true; // CP desconocido → incluir

      const km = haversineKm(userCoords, doctorCoords);

      // Sin límite de radio → solo filtrar por provincia (comportamiento anterior)
      if (!maxKm) return doctor.cp.slice(0, 2) === cp.slice(0, 2);

      return km <= maxKm;
    })
    .map((doctor) => {
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
