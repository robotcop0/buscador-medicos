/**
 * Scraper del cuadro médico de Sanitas.
 *
 * Fuente: `api.sanitas.es/is-cuadro-medico-publico/api/v2` con Apikey fija
 * hardcodeada en el cliente web (MSWeb). Se expone en el bundle JS de
 * `sanitas.es/buscador-cuadro-medico` — cualquier visitante la ve.
 *
 * Estrategia: fan-out por (provincia × especialidad). Paginamos cada combo
 * hasta agotar `paginacion.total`. Sanitas devuelve un registro por
 * "especialista" con un array de centros anidados: lo desenrollamos en un
 * registro `RawDoctor` por especialidad × centro.
 *
 * Dedup: nombre(normalizado) + cp + especialidad(normalizada). Hay mucha
 * redundancia porque un médico aparece en los resultados de cada provincia en
 * la que ejerce y cada especialidad que trabaja.
 *
 * Extra: Sanitas es la única fuente que trae valoración real (0-10, con votos).
 * Normalizamos a escala 0-5.
 */
import axios from "axios";
import type { RawDoctor } from "../types";

const API = "https://api.sanitas.es/is-cuadro-medico-publico/api/v2";
const HEADERS: Record<string, string> = {
  authorization: "Apikey 9LMMEbW6IPcD3gbUV8ulaZpcBed9iGjK",
  "snt-caller-id": "MSWeb",
  "snt-caller-version": "2.62.2",
  "snt-caller-language": "es_ES",
  accept: "application/json, text/plain, */*",
};

const PAGE_SIZE = 50;
const CONCURRENCY = 6;
const THROTTLE_MS = 120; // entre pages dentro de un worker
const MAX_RETRIES = 2;

// Códigos INE de provincia (2 dígitos del CP).
const PROVINCIAS: number[] = Array.from({ length: 52 }, (_, i) => i + 1);

type Especialidad = { id: number; nombre: string };
type Centro = {
  id: string | null;
  nombre: string;
  poblacion?: { nombre: string };
  provincia?: { id: number; nombre: string };
  codigoPostal?: string;
  domicilio?: string;
  valoracion?: { puntuacion?: number; votos?: number };
  telefono?: string;
};
type Especialista = {
  id: number;
  nombre: string;
  titulo?: string;
  especialidades?: { nombre: string; centros?: Centro[] }[];
};

type PagedResponse = {
  paginacion?: { total?: number };
  resultados?: Especialista[];
};

async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await axios.get<T>(`${API}${path}`, {
        params,
        headers: HEADERS,
        timeout: 20000,
      });
      return r.data;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

let especialidadesCache: Especialidad[] | null = null;

async function getEspecialidades(): Promise<Especialidad[]> {
  if (especialidadesCache) return especialidadesCache;
  const j = await apiGet<{ resultados: Especialidad[] }>("/especialidades", {});
  especialidadesCache = j.resultados ?? [];
  return especialidadesCache;
}

function capitalize(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bY\b/g, "y");
}

function stripPrefix(name: string): string {
  return name.replace(/^(DR\.|DRA\.|SR\.|SRA\.)\s+/i, "").trim();
}

function buildName(e: Especialista): string {
  const n = stripPrefix((e.nombre || "").replace(/,(\S)/g, ", $1"));
  return capitalize(n);
}

function ratingFromSanitas(valoracion?: { puntuacion?: number; votos?: number }): {
  rating: number;
  numReviews: number;
} {
  if (!valoracion) return { rating: 0, numReviews: 0 };
  // Sanitas usa escala 0-10; normalizamos a 0-5.
  const rating =
    valoracion.puntuacion != null ? Math.min(5, Math.max(0, valoracion.puntuacion / 2)) : 0;
  return { rating, numReviews: valoracion.votos ?? 0 };
}

function toRawDoctors(e: Especialista, fallbackEspName: string): RawDoctor[] {
  const docs: RawDoctor[] = [];
  const nombre = buildName(e);
  for (const esp of e.especialidades ?? []) {
    const espNombre = capitalize(esp.nombre || fallbackEspName);
    for (const c of esp.centros ?? []) {
      if (!c.codigoPostal) continue;
      const { rating, numReviews } = ratingFromSanitas(c.valoracion);
      docs.push({
        nombre: nombre || capitalize(c.nombre || ""),
        especialidad: espNombre,
        mutuas: ["Sanitas"],
        direccion: capitalize(c.domicilio || ""),
        cp: c.codigoPostal,
        ciudad: capitalize(c.poblacion?.nombre || c.provincia?.nombre || ""),
        telefono: c.telefono ? c.telefono.replace(/\D/g, "") || undefined : undefined,
        rating,
        numReviews,
        source: "sanitas",
      });
    }
  }
  return docs;
}

async function fetchPage(params: {
  especialidadId: number;
  provinciaCod: number;
  pagina: number;
}): Promise<PagedResponse> {
  const query: Record<string, string> = {
    provincias: String(params.provinciaCod),
    especialidades: String(params.especialidadId),
    "paginacion.numItems": String(PAGE_SIZE),
    "paginacion.numPagina": String(params.pagina),
    "detalle.orden": "RELEVANCIA",
    "detalle.nivelDetalle": "RESUMIDO",
    "detalle.infoFiltros": "false",
  };
  return await apiGet<PagedResponse>("/especialistas", query);
}

type Job = { provincia: number; esp: Especialidad };

async function fanOut(
  jobs: Job[],
  concurrency: number,
  worker: (job: Job, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function run() {
    while (true) {
      const i = cursor++;
      if (i >= jobs.length) return;
      try {
        await worker(jobs[i], i);
      } catch {
        // se ignora — worker ya hizo sus reintentos
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
}

export type ScrapeOptions = {
  provincias?: number[];
  especialidadIds?: number[];
  limit?: number;
  logger?: (msg: string) => void;
};

export async function scrapeSanitas(opts: ScrapeOptions = {}): Promise<RawDoctor[]> {
  const log = opts.logger ?? (() => {});
  log("[sanitas] pidiendo catálogo de especialidades…");
  const esps = await getEspecialidades();
  log(`[sanitas] ${esps.length} especialidades, ${PROVINCIAS.length} provincias`);

  const provincias = opts.provincias ?? PROVINCIAS;
  const filteredEsps = opts.especialidadIds
    ? esps.filter((e) => opts.especialidadIds!.includes(e.id))
    : esps;

  const jobs: Job[] = [];
  for (const p of provincias) {
    for (const e of filteredEsps) {
      jobs.push({ provincia: p, esp: e });
    }
  }
  log(`[sanitas] ${jobs.length} combos (provincia×especialidad) a barrer`);

  const seen = new Set<string>();
  const collected: RawDoctor[] = [];
  let done = 0;
  const startedAt = Date.now();

  const pushEspecialistas = (list: Especialista[], fallbackEspName: string) => {
    for (const e of list) {
      const docs = toRawDoctors(e, fallbackEspName);
      for (const d of docs) {
        const key = `${d.nombre.toLowerCase()}::${d.cp}::${d.especialidad.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(d);
      }
    }
  };

  await fanOut(jobs, CONCURRENCY, async (job) => {
    // Pág 0 para saber total
    const first = await fetchPage({
      especialidadId: job.esp.id,
      provinciaCod: job.provincia,
      pagina: 0,
    });
    const total = first.paginacion?.total ?? first.resultados?.length ?? 0;
    const pages = Math.ceil(total / PAGE_SIZE);

    pushEspecialistas(first.resultados ?? [], job.esp.nombre);

    for (let p = 1; p < pages; p++) {
      if (opts.limit && collected.length >= opts.limit) break;
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
      const page = await fetchPage({
        especialidadId: job.esp.id,
        provinciaCod: job.provincia,
        pagina: p,
      });
      pushEspecialistas(page.resultados ?? [], job.esp.nombre);
    }

    done++;
    if (done % 50 === 0 || done === jobs.length) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
      const rate = (done / ((Date.now() - startedAt) / 1000)).toFixed(1);
      log(
        `[sanitas]   ${done}/${jobs.length} combos (${collected.length} únicos · ${rate}/s · ${elapsed}s)`
      );
    }
  });

  if (opts.limit && collected.length > opts.limit) {
    return collected.slice(0, opts.limit);
  }
  return collected;
}
