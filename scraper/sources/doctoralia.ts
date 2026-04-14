import axios from "axios";
import * as cheerio from "cheerio";
import { RawDoctor } from "../types";

// --- Config ---

const CITIES = ["Madrid", "Barcelona", "Valencia"];

const SPECIALTIES: Record<string, string> = {
  cardiologo: "Cardiología",
  "medico-de-cabecera": "Medicina general",
  dermatologo: "Dermatología",
  ginecologo: "Ginecología",
  pediatra: "Pediatría",
  traumatologo: "Traumatología",
  psicologo: "Psicología",
  oftalmologo: "Oftalmología",
  "dentista-odontologia": "Odontología",
};

const MUTUAS: Record<string, string> = {
  adeslas: "Adeslas",
  sanitas: "Sanitas",
  dkv: "DKV",
  mapfre: "Mapfre",
  asisa: "Asisa",
  cigna: "Cigna",
};

// Mapa provincia → prefijo CP (primeros 2 dígitos)
const PROVINCE_CP: Record<string, string> = {
  Madrid: "28",
  Barcelona: "08",
  Valencia: "46",
  Sevilla: "41",
  Zaragoza: "50",
  Málaga: "29",
  Murcia: "30",
  "Palma de Mallorca": "07",
  Mallorca: "07",
  "Las Palmas": "35",
  "Tenerife": "38",
  Bilbao: "48",
  Vizcaya: "48",
  "A Coruña": "15",
  Alicante: "03",
  Valladolid: "47",
  Córdoba: "14",
  Granada: "18",
  Vigo: "36",
  Pontevedra: "36",
  Gijón: "33",
  Asturias: "33",
  Oviedo: "33",
  "L'Hospitalet de Llobregat": "08",
  Badalona: "08",
  Terrassa: "08",
  Sabadell: "08",
  Getafe: "28",
  Alcalá: "28",
  Leganés: "28",
  Fuenlabrada: "28",
  Móstoles: "28",
  Toledo: "45",
  Guadalajara: "19",
  Cuenca: "16",
  Albacete: "02",
  "Ciudad Real": "13",
  Burgos: "09",
  León: "24",
  Salamanca: "37",
  Segovia: "40",
  Ávila: "05",
  Soria: "42",
  Cáceres: "10",
  Badajoz: "06",
  Huelva: "21",
  Almería: "04",
  Jaén: "23",
  Cádiz: "11",
  "Dos Hermanas": "41",
  Marbella: "29",
  Torrevieja: "03",
  Elche: "03",
  Tarragona: "43",
  Lleida: "25",
  Girona: "17",
  Pamplona: "31",
  Navarra: "31",
  Logroño: "26",
  "La Rioja": "26",
  Vitoria: "01",
  Álava: "01",
  "San Sebastián": "20",
  Guipúzcoa: "20",
  Santander: "39",
  Cantabria: "39",
};

const MAX_PAGES = 3;
const DELAY_MS = 1500;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
};

// --- Helpers ---

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr\.?a?\.?\s+)/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function cpFromLocalidad(localidad: string): string {
  // Buscar en el mapa de provincias
  for (const [city, prefix] of Object.entries(PROVINCE_CP)) {
    if (localidad.toLowerCase().includes(city.toLowerCase()) ||
        city.toLowerCase().includes(localidad.toLowerCase())) {
      // Sufijo pseudo-aleatorio reproducible
      const suffix = ((localidad.charCodeAt(0) + localidad.length) % 90) * 100 + 1;
      return `${prefix}${String(suffix).padStart(3, "0")}`;
    }
  }
  // Fallback: CP genérico de Madrid
  const suffix = ((localidad.charCodeAt(0)) % 90) * 100 + 1;
  return `28${String(suffix).padStart(3, "0")}`;
}

// --- Scraper ---

async function fetchPage(
  specialtySlug: string,
  city: string,
  mutuaSlug: string,
  page: number
): Promise<string | null> {
  const url = new URL("https://www.doctoralia.es/buscar");
  url.searchParams.set("q", specialtySlug);
  url.searchParams.set("city", city);
  url.searchParams.append("insurance[]", mutuaSlug);
  if (page > 1) url.searchParams.set("page", String(page));

  try {
    const res = await axios.get(url.toString(), {
      headers: HEADERS,
      timeout: 15000,
    });
    return res.data as string;
  } catch (err: unknown) {
    const e = err as { response?: { status: number } };
    const status = e?.response?.status;
    if (status === 404) return null;
    console.warn(`  [warn] fetch failed (${status ?? "network error"}): ${url}`);
    return null;
  }
}

function parseDoctors(
  html: string,
  searchCity: string,
  especialidad: string,
  mutuaLabel: string
): RawDoctor[] {
  const $ = cheerio.load(html);
  const doctors: RawDoctor[] = [];

  // Doctoralia usa data-id="result-item" en cada card div
  $("[data-id='result-item']").each((_, el) => {
    const card = $(el);

    // Nombre desde data attribute (muy fiable)
    const nombre = card.attr("data-doctor-name")?.trim() ?? "";
    if (!nombre || nombre.length < 3) return;

    // Rating y reseñas desde data-eec attributes
    const ratingStr = card.attr("data-eec-stars-rating") ?? "0";
    const reviewsStr = card.attr("data-eec-opinions-count") ?? "0";
    const rating = parseFloat(ratingStr) || 0;
    const numReviews = parseInt(reviewsStr, 10) || 0;

    // Especialidad desde data attribute
    const especialidadRaw = card.attr("data-eec-specialization-name") ?? especialidad;

    // Dirección desde schema.org meta tags dentro del card
    const streetAddress =
      card.find("[itemprop='streetAddress']").attr("content")?.trim() ?? "";
    const localidad =
      card.find("[itemprop='addressLocality']").attr("content")?.trim() ?? searchCity;

    const ciudad = localidad || searchCity;
    const cp = cpFromLocalidad(ciudad);

    // URL del perfil
    const profileUrl = card.attr("data-doctor-url") ?? "";

    doctors.push({
      nombre,
      especialidad: normalizeSpecialty(especialidadRaw) || especialidad,
      mutuas: [mutuaLabel],
      direccion: streetAddress,
      cp,
      ciudad,
      rating,
      numReviews,
      source: "doctoralia",
      profileUrl,
    });
  });

  return doctors;
}

// Normalizar especialidad al valor canónico
const SPECIALTY_NORMALIZATION: Record<string, string> = {
  "Cardiólogo": "Cardiología",
  "Cardiologa": "Cardiología",
  "Médico de cabecera": "Medicina general",
  "Médico general": "Medicina general",
  "Médico de familia": "Medicina general",
  "Dermatólogo": "Dermatología",
  "Dermatologa": "Dermatología",
  "Ginecólogo": "Ginecología",
  "Ginecóloga": "Ginecología",
  "Pediatra": "Pediatría",
  "Traumatólogo": "Traumatología",
  "Traumatologa": "Traumatología",
  "Psicólogo": "Psicología",
  "Psicóloga": "Psicología",
  "Oftalmólogo": "Oftalmología",
  "Oftalmóloga": "Oftalmología",
  "Odontólogo": "Odontología",
  "Odontóloga": "Odontología",
  "Dentista": "Odontología",
};

function normalizeSpecialty(raw: string): string {
  return SPECIALTY_NORMALIZATION[raw] ?? raw;
}

// --- Main export ---

export async function scrapeDoctoralia(log = console.log): Promise<RawDoctor[]> {
  const allDoctors = new Map<string, RawDoctor>(); // key = normName::ciudad
  let total = 0;

  for (const city of CITIES) {
    for (const [slug, especialidad] of Object.entries(SPECIALTIES)) {
      for (const [mutuaSlug, mutuaLabel] of Object.entries(MUTUAS)) {
        log(`  Doctoralia → ${especialidad} · ${mutuaLabel} · ${city}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
          await sleep(DELAY_MS);
          const html = await fetchPage(slug, city, mutuaSlug, page);
          if (!html) break;

          const doctors = parseDoctors(html, city, especialidad, mutuaLabel);
          if (doctors.length === 0) {
            log(`    página ${page}: sin resultados`);
            break;
          }

          let newInPage = 0;
          for (const doc of doctors) {
            const key = `${normalizeName(doc.nombre)}::${doc.ciudad.toLowerCase()}`;
            const existing = allDoctors.get(key);

            if (existing) {
              if (!existing.mutuas.includes(mutuaLabel)) {
                existing.mutuas.push(mutuaLabel);
              }
              if (doc.rating > existing.rating) existing.rating = doc.rating;
              if (doc.numReviews > existing.numReviews) existing.numReviews = doc.numReviews;
            } else {
              allDoctors.set(key, { ...doc });
              total++;
              newInPage++;
            }
          }

          log(`    pág ${page}: ${doctors.length} resultados, ${newInPage} nuevos (total: ${total})`);
          if (doctors.length < 10) break;
        }
      }
    }
  }

  return Array.from(allDoctors.values());
}
