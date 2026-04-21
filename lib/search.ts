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
import { enrichWithGoogle } from "@/lib/google-ratings-index";
import { mergeRatings } from "@/lib/ratings-merge";
import { sortByRating } from "@/lib/ratings-sort";
import { enrichCentrosLive } from "@/lib/google-live-enrich";
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

  const enriched = merged
    .map(enrichWithDoctoralia)
    .map(enrichWithGoogle)
    .map(mergeRatings);

  // Enriquecimiento live de TODOS los centros sin rating cacheado (no solo
  // los de la página actual). Necesario para que el sort global respete
  // orden por rating merged: si live-enrichamos solo una página, centros
  // rated aparecen tanto arriba como abajo y el usuario ve pages vacías
  // intercaladas. Concurrencia 8, timeout global 10 s: centros que no
  // respondan en ese presupuesto quedan "unrated" y van al final del
  // listado (consistente con el split rated/unrated); en siguientes
  // visitas se sirven desde cache persistente y esta etapa es <100 ms.
  const liveEnriched = await enrichCentrosLive(enriched, {
    concurrency: 8,
    perRequestTimeoutMs: 8_000,
    globalTimeoutMs: 10_000,
  });

  return sortByRating(liveEnriched);
}
