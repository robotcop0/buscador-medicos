import axios from "axios";
import * as cheerio from "cheerio";

export type DoctoraliaProfile = {
  entityId: string;
  url: string;
  name: string;
  especialidadDoctoralia: string;
  especialidadCanonical: string;
  provincia: string;
  cities: string[];
  streets: string[];
  rating: number;
  numReviews: number;
};

// Combo UI → slug Doctoralia (singular masculino, sin acentos, guiones).
// Provisional: verificar HTTP 200 + cards > 0 en Step 2.4.
export const ESPECIALIDAD_SLUGS: Record<string, string> = {
  "Alergología": "alergologo",
  "Andrología": "andrologo",
  "Aparato digestivo": "gastroenterologo",
  "Cardiología": "cardiologo",
  "Cirugía general": "cirujano-general",
  "Cirugía plástica": "cirujano-plastico",
  "Dermatología": "dermatologo",
  "Endocrinología": "endocrinologo",
  "Fisioterapia": "fisioterapeuta",
  "Ginecología": "ginecologo",
  "Hematología": "hematologo",
  "Logopedia": "logopeda",
  "Medicina de urgencias": "medico-de-urgencias",
  "Medicina estética": "medico-estetico",
  "Medicina general": "medico-de-cabecera",
  "Medicina interna": "internista",
  "Nefrología": "nefrologo",
  "Neumología": "neumologo",
  "Neurocirugía": "neurocirujano",
  "Neurología": "neurologo",
  "Nutrición y dietética": "nutricionista",
  "Odontología": "dentista",
  "Oftalmología": "oftalmologo",
  "Oncología": "oncologo",
  "Otorrinolaringología": "otorrinolaringologo",
  "Pediatría": "pediatra",
  "Podología": "podologo",
  "Psicología": "psicologo",
  "Psiquiatría": "psiquiatra",
  "Rehabilitación": "medico-rehabilitador",
  "Reumatología": "reumatologo",
  "Traumatología": "traumatologo",
  "Urología": "urologo",
};

// 52 provincias españolas. Usamos el nombre como `loc=` param.
export const PROVINCIAS: string[] = [
  "A Coruña", "Álava", "Albacete", "Alicante", "Almería", "Asturias",
  "Ávila", "Badajoz", "Baleares", "Barcelona", "Burgos", "Cáceres",
  "Cádiz", "Cantabria", "Castellón", "Ceuta", "Ciudad Real", "Córdoba",
  "Cuenca", "Girona", "Granada", "Guadalajara", "Guipúzcoa", "Huelva",
  "Huesca", "Jaén", "La Rioja", "Las Palmas", "León", "Lleida", "Lugo",
  "Madrid", "Málaga", "Melilla", "Murcia", "Navarra", "Ourense",
  "Palencia", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife",
  "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo",
  "Valencia", "Valladolid", "Vizcaya", "Zamora", "Zaragoza",
];

const BASE = "https://www.doctoralia.es";
const DELAY_MS = 250;
const MAX_PAGES = 20;
const TIMEOUT_MS = 15000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithBackoff(url: string): Promise<string | null> {
  const delays = [5000, 15000, 30000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT_MS });
      return res.data as string;
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; code?: string };
      const status = e?.response?.status;
      if (status === 404) return null;
      if ((status === 403 || status === 405 || status === 429) && attempt < delays.length) {
        console.warn(`    [${status}] backoff ${delays[attempt]}ms → ${url}`);
        await sleep(delays[attempt]);
        continue;
      }
      console.warn(`    [warn] fetch failed (${status ?? e?.code ?? "?"}): ${url}`);
      return null;
    }
  }
  return null;
}

function parsePage(
  html: string,
  especialidadCanonical: string,
  provincia: string
): DoctoraliaProfile[] {
  const $ = cheerio.load(html);
  const out: DoctoraliaProfile[] = [];
  $("[data-id='result-item']").each((_, el) => {
    const card = $(el);
    const entityId = card.attr("data-eec-entity-id");
    if (!entityId) return;
    const name = card.attr("data-doctor-name")?.trim() ?? "";
    if (!name) return;
    const url = card.attr("data-doctor-url") ?? "";
    const especialidadDoctoralia =
      card.attr("data-eec-specialization-name")?.trim() ?? "";
    const rating = parseFloat(card.attr("data-eec-stars-rating") ?? "0") || 0;
    const numReviews =
      parseInt(card.attr("data-eec-opinions-count") ?? "0", 10) || 0;

    const cities = new Set<string>();
    card.find("[itemprop='addressLocality']").each((_, e) => {
      const v = $(e).attr("content")?.trim();
      if (v) cities.add(v);
    });
    const streets = new Set<string>();
    card.find("[itemprop='streetAddress']").each((_, e) => {
      const v = $(e).attr("content")?.trim();
      if (v) streets.add(v);
    });

    out.push({
      entityId,
      url,
      name,
      especialidadDoctoralia,
      especialidadCanonical,
      provincia,
      cities: [...cities],
      streets: [...streets],
      rating,
      numReviews,
    });
  });
  return out;
}

export type ScrapeOptions = {
  limitEspecialidades?: number;
  limitProvincias?: number;
  log?: (s: string) => void;
};

export async function scrapeDoctoralia(
  opts: ScrapeOptions = {}
): Promise<DoctoraliaProfile[]> {
  const log = opts.log ?? console.log;
  const especialidades = Object.entries(ESPECIALIDAD_SLUGS).slice(
    0,
    opts.limitEspecialidades ?? Infinity
  );
  const provincias = PROVINCIAS.slice(0, opts.limitProvincias ?? Infinity);

  // Dedup global por entityId — un mismo doctor sale en varias provincias/páginas.
  const byEntity = new Map<string, DoctoraliaProfile>();
  let totalFetches = 0;

  for (const [especialidadCanonical, slug] of especialidades) {
    for (const provincia of provincias) {
      log(`  ${especialidadCanonical} · ${provincia}`);
      for (let page = 1; page <= MAX_PAGES; page++) {
        await sleep(DELAY_MS);
        const url = `${BASE}/buscar?spec=${slug}&loc=${encodeURIComponent(
          provincia
        )}${page > 1 ? `&page=${page}` : ""}`;
        const html = await fetchWithBackoff(url);
        totalFetches++;
        if (!html) break;
        const profiles = parsePage(html, especialidadCanonical, provincia);
        if (profiles.length === 0) break;
        let added = 0;
        for (const p of profiles) {
          const existing = byEntity.get(p.entityId);
          if (existing) {
            // fusionar cities/streets
            const ci = new Set([...existing.cities, ...p.cities]);
            const st = new Set([...existing.streets, ...p.streets]);
            existing.cities = [...ci];
            existing.streets = [...st];
          } else {
            byEntity.set(p.entityId, p);
            added++;
          }
        }
        log(
          `    pág ${page}: ${profiles.length} cards, ${added} nuevos (total únicos: ${byEntity.size})`
        );
        if (profiles.length < 10) break; // última página
      }
    }
  }
  log(`\nFetches totales: ${totalFetches}. Profesionales únicos: ${byEntity.size}`);
  return [...byEntity.values()];
}
