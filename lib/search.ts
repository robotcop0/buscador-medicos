import { doctors } from "@/data/doctors";
import { coordsFromCP, haversineKm } from "@/lib/coordinates";
import { searchOccident } from "@/lib/sources/occident";
import { searchAllianz } from "@/lib/sources/allianz";
import { searchMapfre } from "@/lib/sources/mapfre";
import { searchSanitas } from "@/lib/sources/sanitas";
import { searchAxa } from "@/lib/sources/axa";
import { searchCaser } from "@/lib/sources/caser";
import { searchCigna } from "@/lib/sources/cigna";
import { searchDivinaPastora } from "@/lib/sources/divina-pastora";
import { searchAsisa } from "@/lib/sources/asisa";
import { searchDkv } from "@/lib/sources/dkv";
import { searchImq } from "@/lib/sources/imq";
import { searchMuface } from "@/lib/sources/muface";
import { searchGenerali } from "@/lib/sources/generali";
import { searchFiatc } from "@/lib/sources/fiatc";
import { enrichWithDoctoralia } from "@/lib/ratings-index";
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
  const wantMapfre = !mutua || mutua === "Mapfre";
  const wantSanitas = !mutua || mutua === "Sanitas";
  const wantAxa = !mutua || mutua === "AXA Salud";
  const wantCaser = !mutua || mutua === "Caser Salud";
  const wantCigna = !mutua || mutua === "Cigna";
  const wantDivina = !mutua || mutua === "Divina Pastora";
  const wantAsisa = !mutua || mutua === "Asisa";
  const wantDkv = !mutua || mutua === "DKV";
  const wantImq = !mutua || mutua === "IMQ";
  const wantFiatc = !mutua || mutua === "Fiatc";
  // MUFACE no es una mutua; es un régimen que delega en Adeslas + Asisa con
  // cuadros específicos. Solo se consulta cuando el usuario lo pide explícito
  // (si no, los mismos médicos ya vendrían vía Adeslas/Asisa "Salud").
  const wantMuface = mutua === "MUFACE";
  // Generali Salud Premium es co-branded Sanitas: solo lo consultamos si el
  // usuario filtra por "Generali". Si no, los mismos médicos ya llegan por
  // Sanitas (evitamos duplicados en el merge "todas las mutuas").
  const wantGenerali = mutua === "Generali";

  const offline = wantAdeslas
    ? (doctors as Doctor[]).filter((d) => {
        const matchMutua = !mutua ? true : d.mutuas.includes(mutua);
        return matchMutua && especialidadMatches(d.especialidad, especialidad);
      })
    : [];

  // Occident exige especialidad. Allianz hace fan-out si no se pasa.
  // Mapfre acepta radio sin especialidad (devuelve todo lo cercano).
  // Divina Pastora / Asisa / MUFACE exigen especialidad.
  const [occident, allianz, mapfre, sanitas, axa, caser, cigna, divina, asisa, dkv, imq, muface, generali, fiatc] = await Promise.all([
    wantOccidente && especialidad ? searchOccident(cp, especialidad) : Promise.resolve([]),
    wantAllianz && cp ? searchAllianz(cp, especialidad) : Promise.resolve([]),
    wantMapfre && cp ? searchMapfre(cp, especialidad) : Promise.resolve([]),
    wantSanitas && cp ? searchSanitas(cp, especialidad) : Promise.resolve([]),
    wantAxa && cp ? searchAxa(cp, especialidad) : Promise.resolve([]),
    wantCaser && cp && especialidad ? searchCaser(cp, especialidad) : Promise.resolve([]),
    wantCigna && cp && especialidad ? searchCigna(cp, especialidad) : Promise.resolve([]),
    wantDivina && cp && especialidad ? searchDivinaPastora(cp, especialidad) : Promise.resolve([]),
    wantAsisa && cp && especialidad ? searchAsisa(cp, especialidad) : Promise.resolve([]),
    wantDkv && cp && especialidad ? searchDkv(cp, especialidad) : Promise.resolve([]),
    wantImq && cp && especialidad ? searchImq(cp, especialidad) : Promise.resolve([]),
    wantMuface && cp && especialidad ? searchMuface(cp, especialidad) : Promise.resolve([]),
    wantGenerali && cp ? searchGenerali(cp, especialidad) : Promise.resolve([]),
    wantFiatc && cp && especialidad ? searchFiatc(cp, especialidad) : Promise.resolve([]),
  ]);

  const merged = [
    ...applyGeo(offline, cp, maxKm),
    ...applyGeo(occident, cp, maxKm),
    ...applyGeo(allianz, cp, maxKm),
    ...applyGeo(mapfre, cp, maxKm),
    ...applyGeo(sanitas, cp, maxKm),
    ...applyGeo(axa, cp, maxKm),
    ...applyGeo(caser, cp, maxKm),
    ...applyGeo(cigna, cp, maxKm),
    ...applyGeo(divina, cp, maxKm),
    ...applyGeo(asisa, cp, maxKm),
    ...applyGeo(dkv, cp, maxKm),
    ...applyGeo(imq, cp, maxKm),
    ...applyGeo(muface, cp, maxKm),
    ...applyGeo(generali, cp, maxKm),
    ...applyGeo(fiatc, cp, maxKm),
  ];

  const enriched = merged.map(enrichWithDoctoralia);

  // Split: primero los que tienen valoración, después los que no. Dentro de
  // cada grupo, los valorados por rating↓ (desempatando por nº reseñas↓) y
  // los no valorados por distancia↑ (o por nombre si no hay CP).
  const rated: Doctor[] = [];
  const unrated: Doctor[] = [];
  for (const d of enriched) {
    if (d.numReviews > 0 && d.rating > 0) rated.push(d);
    else unrated.push(d);
  }

  rated.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.numReviews - a.numReviews;
  });

  unrated.sort((a, b) => {
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return [...rated, ...unrated];
}
