/**
 * Cliente *live* de Occident usado desde `lib/search.ts` en tiempo de búsqueda.
 *
 * Pensado para cuando el usuario filtra por CP + especialidad — resolvemos el
 * código provincia del CP (2 primeros dígitos = código INE), mapeamos la
 * especialidad de la UI al código de Occident, y hacemos 1 sola petición GET.
 *
 * Token y listado de especialidades se cachean en memoria del módulo.
 */
import type { Doctor } from "@/lib/types";

const BASE = "https://www.occident.com";

type Especialidad = { Id: string; Descripcion: string };
type Medico = {
  Nombre: string;
  Especialidad: string;
  SubEspecialidad: string;
  Direccion: string;
  CPostal: string;
  Localidad: string;
  Telefono: string;
};

let tokenCache: { token: string; expiresAt: number } | null = null;
let especialidadesCache: Especialidad[] | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const r = await fetch(`${BASE}/token.txt?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Occident token: ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return tokenCache.token;
}

async function apiGet<T>(
  path: string,
  params: Record<string, string>,
  retried = false
): Promise<T> {
  const token = await getToken();
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${BASE}${path}?${qs}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json, text/javascript, */*; q=0.01",
    },
    cache: "no-store",
  });
  if ((r.status === 401 || r.status === 403) && !retried) {
    tokenCache = null;
    return apiGet<T>(path, params, true);
  }
  if (!r.ok) throw new Error(`Occident ${path}: ${r.status}`);
  return (await r.json()) as T;
}

async function getEspecialidades(): Promise<Especialidad[]> {
  if (especialidadesCache) return especialidadesCache;
  const j = await apiGet<{ Salida: { Especialidades: Especialidad[] } }>(
    "/pxysvc/proxy/integration/WEB_OBTENER_ESPECIALIDES/1.0/ObtenerEspecialidades",
    { tipo: "Centro", idioma: "esp" }
  );
  especialidadesCache = j.Salida.Especialidades;
  return especialidadesCache;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Sinónimos UI → Occident. La lista oficial de Occident usa nomenclatura propia
// (p.ej. ESTOMATOLOGÍA en lugar de ODONTOLOGÍA). Si el usuario escoge una
// especialidad del dropdown que no coincide literalmente, la redirigimos aquí.
const SYNONYMS: Record<string, string> = {
  odontologia: "estomatologia",
  logopedia: "logofoniatria",
  "medicina de urgencias": "urgencias",
};

async function resolveEspecialidadId(especialidad: string): Promise<string | null> {
  const list = await getEspecialidades();
  const raw = norm(especialidad);
  const target = SYNONYMS[raw] ?? raw;
  // Cuando varios candidatos encajan por prefijo (p.ej. "traumatologia" →
  // "TRAUMATOLOGÍA PEDIÁTRICA" e "TRAUMATOLOGÍA Y CIRUGIA ORTOPÉDICA"), nos
  // quedamos con el que NO parece ser una subespecialidad (pediátrica, etc.).
  // Un proxy simple: preferir el de descripción más larga que coincida solo si
  // no hay exacto; para prefijos preferimos el de Id numérico más bajo, que en
  // la convención de Occident suele ser la especialidad "adulto/general".
  const byIdAsc = (a: Especialidad, b: Especialidad) =>
    parseInt(a.Id, 10) - parseInt(b.Id, 10);

  const exact = list.find((e) => norm(e.Descripcion) === target);
  if (exact) return exact.Id;

  const prefix = list
    .filter((e) => norm(e.Descripcion).startsWith(target))
    .sort(byIdAsc);
  if (prefix.length) return prefix[0].Id;

  const reversePrefix = list.find((e) => target.startsWith(norm(e.Descripcion)));
  if (reversePrefix) return reversePrefix.Id;

  const includes = list
    .filter((e) => norm(e.Descripcion).includes(target))
    .sort(byIdAsc);
  if (includes.length) return includes[0].Id;

  return null;
}

function normalizeText(raw: string): string {
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

function toDoctor(m: Medico, offsetId: number): Doctor | null {
  if (!m.Nombre) return null;
  return {
    id: offsetId,
    nombre: normalizeText(m.Nombre.replace(/,(\S)/g, ", $1")),
    especialidad: normalizeText(m.Especialidad),
    mutuas: ["Occidente"],
    direccion: normalizeText((m.Direccion || "").replace(/\s*,\s*,\s*$/, "")),
    cp: (m.CPostal || "").trim(),
    ciudad: normalizeText(m.Localidad),
    telefono: (m.Telefono || "").replace(/\D/g, "") || undefined,
    rating: 0,
    numReviews: 0,
  };
}

export async function searchOccident(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!especialidad) return []; // El endpoint exige un código de especialidad.
  let espId: string | null = null;
  try {
    espId = await resolveEspecialidadId(especialidad);
  } catch {
    return [];
  }
  if (!espId) return [];

  const codProv = cp && /^\d{5}$/.test(cp) ? cp.slice(0, 2) : "0";

  try {
    const j = await apiGet<{ Salida: { Medicos: Medico[] } }>(
      "/pxysvc/proxy/integration/WEB_OBTENER_MEDICOS/1.0/ObtenerMedicos",
      {
        ampliarRadio: "false",
        cia: "OCC",
        codigoCentroMedico: "",
        codigoEspecialidad: espId,
        codigoProvincia: codProv,
        codigoSubEspecialidad: "",
        codigoTermino: "0",
        idioma: "esp",
        nombreMedico: "",
        posicionX: "0",
        posicionY: "0",
        tipo: "Centro",
      }
    );
    const medicos = j.Salida?.Medicos ?? [];
    // IDs > 1e8 para no chocar con los offline de Adeslas.
    return medicos
      .map((m, i) => toDoctor(m, 100_000_000 + i))
      .filter((d): d is Doctor => d !== null);
  } catch {
    return [];
  }
}
