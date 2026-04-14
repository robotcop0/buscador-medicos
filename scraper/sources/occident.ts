/**
 * Scraper del cuadro médico de Occident (ex-Catalana Occidente).
 *
 * Fuente: proxy público `/pxysvc/...` reverseado desde `occident.com/medicos`.
 * Autenticación: JWT que se publica en texto plano en `/token.txt` (expira 1h).
 * No requiere cookies ni login.
 *
 * Estrategia: iterar sobre todas las combinaciones especialidad × provincia
 * (61 × 53 ≈ 3.2k peticiones, ~13 min con throttle de 250ms).
 */
import axios from "axios";
import type { RawDoctor } from "../types";

const BASE = "https://www.occident.com";
const CONCURRENCY = 8;

type OccidentEspecialidad = {
  Id: string;
  Descripcion: string;
  SubEspecialidades?: { Id: string; Descripcion: string }[];
};

type OccidentProvincia = {
  Id: string;
  Descripcion: string;
};

type OccidentMedico = {
  Nombre: string;
  Especialidad: string;
  SubEspecialidad: string;
  Direccion: string;
  CPostal: string;
  Localidad: string;
  Poblacion: string;
  Telefono: string;
  PosicionX: string;
  PosicionY: string;
  CitaOnLine?: string;
};

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const res = await axios.get<{ access_token: string; expires_in: number }>(
    `${BASE}/token.txt?v=${Date.now()}`,
    { timeout: 15_000 }
  );
  tokenCache = {
    token: res.data.access_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
  return tokenCache.token;
}

async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = await getToken();
  const url = `${BASE}${path}`;
  const res = await axios.get<T>(url, {
    params,
    headers: {
      authorization: `Bearer ${token}`,
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json, text/javascript, */*; q=0.01",
    },
    timeout: 30_000,
  });
  return res.data;
}

async function fetchEspecialidades(): Promise<OccidentEspecialidad[]> {
  const data = await apiGet<{ Salida: { Especialidades: OccidentEspecialidad[] } }>(
    "/pxysvc/proxy/integration/WEB_OBTENER_ESPECIALIDES/1.0/ObtenerEspecialidades",
    { tipo: "Centro", idioma: "esp" }
  );
  return data.Salida.Especialidades;
}

async function fetchProvincias(): Promise<OccidentProvincia[]> {
  const data = await apiGet<{ Salida: { Provincias: OccidentProvincia[] } }>(
    "/pxysvc/proxy/integration/WEB_OBTENER_PROVINCIAS/1.0/ObtenerProvincias",
    {}
  );
  return data.Salida.Provincias;
}

async function fetchMedicos(codEspecialidad: string, codProvincia: string): Promise<OccidentMedico[]> {
  const data = await apiGet<{ Salida: { Medicos: OccidentMedico[] } }>(
    "/pxysvc/proxy/integration/WEB_OBTENER_MEDICOS/1.0/ObtenerMedicos",
    {
      ampliarRadio: "false",
      cia: "OCC",
      codigoCentroMedico: "",
      codigoEspecialidad: codEspecialidad,
      codigoProvincia: codProvincia,
      codigoSubEspecialidad: "",
      codigoTermino: "0",
      idioma: "esp",
      nombreMedico: "",
      posicionX: "0",
      posicionY: "0",
      tipo: "Centro",
    }
  );
  return data.Salida?.Medicos ?? [];
}

function normalizeName(raw: string): string {
  // "ALVAREZ CUESTA,JOSE LUIS" → "Alvarez Cuesta, Jose Luis"
  return raw
    .trim()
    .replace(/,(\S)/g, ", $1")
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase();
      if (w.length <= 2) return w;
      return lower
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("-");
    })
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bY\b/g, "y");
}

function normalizeEspecialidad(raw: string): string {
  if (!raw) return "";
  const lower = raw.toLocaleLowerCase("es-ES");
  return lower.charAt(0).toLocaleUpperCase("es-ES") + lower.slice(1);
}

function normalizeAddress(raw: string): string {
  // "CALLE DOCTOR ESQUERDO, Nº 10, 05, D" → "Calle Doctor Esquerdo, Nº 10, 05, D"
  return raw
    .replace(/\s*,\s*,\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length <= 2 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bN[ºo]\b/gi, "Nº")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bY\b/g, "y");
}

function toRawDoctor(m: OccidentMedico): RawDoctor | null {
  if (!m.Nombre || !m.Localidad) return null;
  return {
    nombre: normalizeName(m.Nombre),
    especialidad: normalizeEspecialidad(m.Especialidad),
    mutuas: ["Occidente"],
    direccion: normalizeAddress(m.Direccion || ""),
    cp: (m.CPostal || "").trim(),
    ciudad: normalizeEspecialidad(m.Localidad),
    telefono: (m.Telefono || "").replace(/\D/g, "") || undefined,
    rating: 0,
    numReviews: 0,
    source: "occident",
  };
}

export type ScrapeOptions = {
  especialidades?: string[];     // códigos específicos (p.ej. ["009"]); undefined = todas
  provincias?: string[];         // códigos específicos; undefined = todas
  limit?: number;
  logger?: (msg: string) => void;
};

export async function scrapeOccident(opts: ScrapeOptions = {}): Promise<RawDoctor[]> {
  const log = opts.logger ?? (() => {});

  log("[occident] obteniendo especialidades y provincias…");
  const [allEsp, allProv] = await Promise.all([fetchEspecialidades(), fetchProvincias()]);
  log(`[occident] ${allEsp.length} especialidades × ${allProv.length} provincias`);

  const espList = opts.especialidades
    ? allEsp.filter((e) => opts.especialidades!.includes(e.Id))
    : allEsp;
  const provList = opts.provincias
    ? allProv.filter((p) => opts.provincias!.includes(p.Id))
    : allProv;

  const total = espList.length * provList.length;
  log(`[occident] lanzando ${total} peticiones (${espList.length} × ${provList.length})`);

  const collected: RawDoctor[] = [];
  const seen = new Set<string>();
  let done = 0;
  let hits = 0;
  let aborted = false;

  // Cola de combinaciones
  const jobs: { esp: OccidentEspecialidad; prov: OccidentProvincia }[] = [];
  for (const esp of espList) {
    for (const prov of provList) jobs.push({ esp, prov });
  }

  let cursor = 0;
  async function worker() {
    while (!aborted) {
      const i = cursor++;
      if (i >= jobs.length) return;
      const { esp, prov } = jobs[i];
      try {
        const medicos = await fetchMedicos(esp.Id, prov.Id);
        hits += medicos.length;
        for (const m of medicos) {
          const doc = toRawDoctor(m);
          if (!doc) continue;
          const key = `${doc.nombre}::${doc.cp}::${doc.especialidad}`;
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push(doc);
          if (opts.limit && collected.length >= opts.limit) {
            aborted = true;
            return;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`[occident]   error ${esp.Descripcion} × ${prov.Descripcion}: ${msg}`);
      }
      done++;
      if (done % 100 === 0) {
        log(`[occident]   ${done}/${total} (${hits} raw, ${collected.length} únicos)`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  if (opts.limit && collected.length >= opts.limit) {
    log(`[occident] límite ${opts.limit} alcanzado`);
    return collected.slice(0, opts.limit);
  }
  log(`[occident] completado: ${hits} raw, ${collected.length} únicos`);
  return collected;
}
