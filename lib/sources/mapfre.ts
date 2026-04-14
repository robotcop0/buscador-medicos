/**
 * Cliente *live* de Mapfre Salud (`buscadores.mapfre.es`).
 *
 * API REST abierta bajo `/buscadores_fe-web/api/1.0/salud/cuadroMedico/...`
 * usando solo la cookie `JSESSIONID` que se obtiene con una GET simple al
 * propio dominio.
 *
 * Flujo por búsqueda: resolver código especialidad (si aplica) + coords del
 * CP y llamar en paralelo `/facultativos` y `/centrosMedicos` con un radio
 * configurable.
 */
import { coordsFromCP } from "@/lib/coordinates";
import type { Doctor } from "@/lib/types";

const BASE = "https://buscadores.mapfre.es";
const API = `${BASE}/buscadores_fe-web/api/1.0/salud/cuadroMedico`;
const GUIA = "01"; // ASISTENCIA (catálogo más amplio)
const RADIUS_KM = 20;
const PAGE_SIZE = 100;

type Especialidad = {
  codigoEspecialidad: string;
  descripcionEspecialidad: string;
};

type Facultativo = {
  codigoProfesionalSanitario: string;
  nombreProfesionalSanitario: string;
  nombreCentroMedico: string;
  codigoPostal: string;
  descripcionPoblacion: string;
  descripcionProvincia: string;
  descripcionTipoVia: string;
  nombreVia: string;
  numeroVia: string;
  piso: string;
  puerta: string;
  latitud: string;
  longitud: string;
  telefonoFijoPrincipal: string | number;
  telefonoFijoSecundario: string | number;
  telefonoMovil: string | number;
  serviciosConcertados?: { nombreEspecialidad?: string }[];
};

type CentroMedico = Omit<Facultativo, "codigoProfesionalSanitario" | "nombreProfesionalSanitario"> & {
  codigoCentroMedicoMapfre: string;
};

let sessionCookie: string | null = null;
let sessionFetchedAt = 0;
const SESSION_TTL_MS = 30 * 60 * 1000;

async function getSessionCookie(): Promise<string | null> {
  if (sessionCookie && Date.now() - sessionFetchedAt < SESSION_TTL_MS) return sessionCookie;
  try {
    const r = await fetch(`${BASE}/buscadores_fe-web/`, { cache: "no-store" });
    const setCookie = r.headers.get("set-cookie");
    if (setCookie) {
      const m = setCookie.match(/JSESSIONID[_\w.]*=[^;]+/);
      if (m) {
        sessionCookie = m[0];
        sessionFetchedAt = Date.now();
      }
    }
  } catch {
    // fallback mudo
  }
  return sessionCookie;
}

async function apiGet<T>(path: string): Promise<T> {
  const cookie = await getSessionCookie();
  const r = await fetch(`${API}${path}`, {
    headers: {
      accept: "application/json, text/plain, */*",
      ...(cookie ? { cookie } : {}),
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Mapfre ${path}: ${r.status}`);
  return (await r.json()) as T;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let especialidadesCache: Especialidad[] | null = null;
let especialidadesFetchedAt = 0;
const ESP_TTL_MS = 60 * 60 * 1000;

async function getEspecialidades(): Promise<Especialidad[]> {
  if (especialidadesCache && Date.now() - especialidadesFetchedAt < ESP_TTL_MS) {
    return especialidadesCache;
  }
  try {
    const list = await apiGet<Especialidad[]>(
      `/guiaMedica/${GUIA}/especialidades?codigoCentro=&indCitaOnline=`
    );
    especialidadesCache = list;
    especialidadesFetchedAt = Date.now();
    return list;
  } catch {
    return [];
  }
}

async function resolveEspecialidadCodigo(especialidad: string): Promise<string | null> {
  const list = await getEspecialidades();
  if (list.length === 0) return null;
  const target = norm(especialidad);
  const match =
    list.find((e) => norm(e.descripcionEspecialidad) === target) ??
    list.find((e) => norm(e.descripcionEspecialidad).startsWith(target)) ??
    list.find((e) => target.startsWith(norm(e.descripcionEspecialidad))) ??
    list.find((e) => norm(e.descripcionEspecialidad).includes(target)) ??
    list.find((e) => target.includes(norm(e.descripcionEspecialidad)));
  return match?.codigoEspecialidad ?? null;
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

function buildAddress(f: { descripcionTipoVia: string; nombreVia: string; numeroVia: string; piso: string; puerta: string }): string {
  let s = `${f.descripcionTipoVia || ""} ${f.nombreVia || ""}`.trim();
  if (f.numeroVia) s += `, Nº ${f.numeroVia}`;
  if (f.piso && f.piso.trim()) s += `, ${f.piso}`;
  if (f.puerta && f.puerta.trim()) s += ` ${f.puerta}`;
  return capitalize(s);
}

function firstPhone(f: Facultativo | CentroMedico): string | undefined {
  for (const p of [f.telefonoFijoPrincipal, f.telefonoFijoSecundario, f.telefonoMovil]) {
    const s = String(p || "").replace(/\D/g, "");
    if (s && s !== "0") return s;
  }
  return undefined;
}

function facultativoEspecialidad(f: Facultativo): string {
  const first = f.serviciosConcertados?.[0]?.nombreEspecialidad ?? "";
  return capitalize(first);
}

function toDoctorFromFacultativo(f: Facultativo, offsetId: number): Doctor | null {
  if (!f.nombreProfesionalSanitario) return null;
  return {
    id: offsetId,
    nombre: capitalize(stripPrefix(f.nombreProfesionalSanitario.replace(/,(\S)/g, ", $1"))),
    especialidad: facultativoEspecialidad(f),
    mutuas: ["Mapfre"],
    direccion: buildAddress(f),
    cp: (f.codigoPostal || "").trim(),
    ciudad: capitalize(f.descripcionPoblacion || ""),
    telefono: firstPhone(f),
    rating: 0,
    numReviews: 0,
  };
}

function toDoctorFromCentro(c: CentroMedico, offsetId: number): Doctor | null {
  if (!c.nombreCentroMedico) return null;
  return {
    id: offsetId,
    nombre: capitalize(c.nombreCentroMedico),
    especialidad: capitalize(c.serviciosConcertados?.[0]?.nombreEspecialidad ?? ""),
    mutuas: ["Mapfre"],
    direccion: buildAddress(c),
    cp: (c.codigoPostal || "").trim(),
    ciudad: capitalize(c.descripcionPoblacion || ""),
    telefono: firstPhone(c),
    rating: 0,
    numReviews: 0,
  };
}

function buildSearchQS(params: {
  codigoEspecialidad: string;
  latitud: number;
  longitud: number;
  radio: number;
  pageSize: number;
}): string {
  const qs = new URLSearchParams({
    codigoEspecialidad: params.codigoEspecialidad,
    codigoSubespecialidad: "",
    nombreCentroMedico: "",
    nombreFacultativo: "",
    latitud: String(params.latitud),
    longitud: String(params.longitud),
    indUrgencias: "false",
    indMapfreSalud: "false",
    indCitaOnline: "false",
    pageNumber: "0",
    pageSize: String(params.pageSize),
    radio: String(params.radio),
  });
  return qs.toString();
}

export async function searchMapfre(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!cp || !/^\d{5}$/.test(cp)) return [];
  const coords = coordsFromCP(cp);
  if (!coords) return [];

  let codigoEsp = "";
  if (especialidad) {
    try {
      codigoEsp = (await resolveEspecialidadCodigo(especialidad)) ?? "";
    } catch {
      codigoEsp = "";
    }
    // Si se pidió una especialidad pero no matchea ninguna, devolvemos vacío
    // en vez de todas (mejor UX).
    if (!codigoEsp) return [];
  }

  const qs = buildSearchQS({
    codigoEspecialidad: codigoEsp,
    latitud: coords.lat,
    longitud: coords.lng,
    radio: RADIUS_KM,
    pageSize: PAGE_SIZE,
  });

  try {
    const [facs, centros] = await Promise.all([
      apiGet<{ facultativos: Facultativo[] }>(`/guiaMedica/${GUIA}/facultativos?${qs}`).catch(
        () => ({ facultativos: [] })
      ),
      apiGet<{ centrosMedicos: CentroMedico[] }>(`/guiaMedica/${GUIA}/centrosMedicos?${qs}`).catch(
        () => ({ centrosMedicos: [] })
      ),
    ]);

    // IDs > 3e8 para no chocar con Adeslas/Occident/Allianz.
    const facDocs = (facs.facultativos ?? [])
      .map((f, i) => toDoctorFromFacultativo(f, 300_000_000 + i))
      .filter((d): d is Doctor => d !== null);
    const centroDocs = (centros.centrosMedicos ?? [])
      .map((c, i) => toDoctorFromCentro(c, 350_000_000 + i))
      .filter((d): d is Doctor => d !== null);

    // Dedup por nombre+cp (un mismo centro aparece en ambas respuestas si
    // tiene facultativos y está listado como centro).
    const seen = new Set<string>();
    return [...facDocs, ...centroDocs].filter((d) => {
      const key = `${d.nombre}::${d.cp}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}
