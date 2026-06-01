/**
 * Cliente *live* de AXA Salud (`www.axa.es/cuadro-medico-salud`).
 *
 * AXA es un Liferay Portlet que responde HTML (no JSON). Flujo por búsqueda:
 *   1. GET `/cuadro-medico-salud` → extrae `p_auth` (CSRF) + cookies
 *   2. POST al action `sendSearchHealth` con los params del form
 *   3. Parsea el HTML de respuesta extrayendo `.c-result-card__block`
 *
 * Pensado para CP + especialidad concretos (una sola petición basta, 106
 * resultados en el smoke test). Sin especialidad devuelve todo lo del CP.
 */
import { coordsFromCP } from "@/lib/coordinates";
import type { Doctor } from "@/lib/types";

const BASE = "https://www.axa.es";
const PATH = "/cuadro-medico-salud";
// Portlet id público del Liferay de axa.es. Se renueva poco pero puede cambiar.
const PORTLET_ID = process.env.AXA_PORTLET_ID ?? "";
const NS = PORTLET_ID ? `_${PORTLET_ID}_` : "";

const SESSION_TTL_MS = 20 * 60 * 1000;
let sessionCache: { pAuth: string; cookies: string; at: number } | null = null;

// Códigos de especialidad AXA obtenidos del endpoint /sub con group=Tipo+de+especialidad
const ESPECIALIDADES: Record<number, string> = {
  2: "Alergología",
  3: "Análisis Clínicos",
  4: "Anatomía Patológica",
  5: "Angiología y Cirugía Vascular",
  6: "Aparato Digestivo",
  11: "Cardiología",
  14: "Cirugía Cardiovascular",
  15: "Cirugía General y Digestiva",
  16: "Cirugía Maxilofacial",
  17: "Cirugía Pediátrica",
  18: "Cirugía Plástica y Reparadora",
  22: "Dermatología",
  23: "Endocrinología",
  25: "Fisioterapia",
  26: "Ginecología y Obstetricia",
  27: "Hematología y Hemoterapia",
  33: "Medicina General",
  35: "Medicina Interna",
  37: "Nefrología",
  39: "Neumología",
  40: "Neurocirugía",
  42: "Neurología",
  43: "Oftalmología",
  44: "Oncología Médica",
  46: "Otorrinolaringología",
  47: "Pediatría",
  48: "Podología",
  50: "Psicología",
  51: "Psiquiatría",
  57: "Rehabilitación",
  60: "Reumatología",
  63: "Traumatología y Cir. Ortopédica",
  73: "Urología",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveEspecialidadId(especialidad: string): string {
  if (!especialidad) return "";
  const target = normalize(especialidad);
  const entries = Object.entries(ESPECIALIDADES);
  const match =
    entries.find(([, n]) => normalize(n) === target) ??
    entries.find(([, n]) => normalize(n).startsWith(target)) ??
    entries.find(([, n]) => target.startsWith(normalize(n))) ??
    entries.find(([, n]) => normalize(n).includes(target)) ??
    entries.find(([, n]) => target.includes(normalize(n)));
  return match?.[0] ?? "";
}

async function getSession(forceRefresh = false): Promise<{ pAuth: string; cookies: string } | null> {
  if (!forceRefresh && sessionCache && Date.now() - sessionCache.at < SESSION_TTL_MS) {
    return { pAuth: sessionCache.pAuth, cookies: sessionCache.cookies };
  }
  try {
    const r = await fetch(`${BASE}${PATH}`, { cache: "no-store" });
    const html = await r.text();
    const pAuth =
      html.match(/name="p_auth"\s+value="([^"]+)"/)?.[1] ??
      html.match(/[?&]p_auth=([\w-]+)/)?.[1];
    if (!pAuth) return null;
    const rawSetCookie = r.headers.get("set-cookie") || "";
    // Compactamos a "k=v; k=v" extrayendo solo las cookies relevantes.
    const cookies = rawSetCookie
      .split(/,(?=[^;]+=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
    sessionCache = { pAuth, cookies, at: Date.now() };
    return { pAuth, cookies };
  } catch {
    return null;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripTags(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function extractCards(html: string): Array<{
  centro: string;
  medico: string;
  direccion: string;
  cp: string;
  ciudad: string;
  telefono?: string;
}> {
  const cards: ReturnType<typeof extractCards> = [];
  const cardRegex = /<div[^>]*class="[^"]*c-result-card__block[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = cardRegex.exec(html))) {
    const block = m[1];
    const centro = stripTags(
      block.match(/class="[^"]*c-result-card__title[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ""
    );
    const medico = stripTags(
      block.match(/class="[^"]*c-result-card__specialist[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ""
    );
    const location = stripTags(
      block.match(/class="[^"]*c-result-card__location[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ""
    );
    const telMatch = block.match(/href="tel:([^"]+)"/);
    const telefono = telMatch ? telMatch[1].replace(/\D/g, "") : undefined;

    // Location viene como "CL Núñez de Balboa, 48 28001 Madrid"
    const cpMatch = location.match(/\b(\d{5})\b/);
    const cp = cpMatch?.[1] ?? "";
    let direccion = location;
    let ciudad = "";
    if (cpMatch) {
      const parts = location.split(cpMatch[0]);
      direccion = parts[0].trim().replace(/,\s*$/, "");
      ciudad = parts[1]?.trim() ?? "";
    }
    if (!centro && !medico) continue;
    cards.push({ centro, medico, direccion, cp, ciudad, telefono });
  }
  return cards;
}

function capitalize(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bY\b/g, "y");
}

export async function searchAxa(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!cp || !/^\d{5}$/.test(cp)) return [];
  if (!PORTLET_ID) return [];
  const coords = coordsFromCP(cp);
  if (!coords) return [];
  const espId = resolveEspecialidadId(especialidad);
  // AXA tolera especialidad vacía: devuelve todo lo del CP.

  const body = new URLSearchParams({
    [`${NS}populationField`]: "",
    [`${NS}provField`]: "",
    [`${NS}latitud`]: String(coords.lat),
    [`${NS}longitud`]: String(coords.lng),
    [`${NS}postalCodeField`]: cp,
    [`${NS}poblacion`]: `${cp}`,
    [`${NS}medicalNameField`]: "",
    [`${NS}keyWord`]: "",
    [`${NS}speciality`]: espId,
    [`${NS}medicalChartField`]: "Cuadro médico global",
    [`${NS}modalidadVal`]: "1",
    [`${NS}caso`]: "1",
    [`${NS}modalidadKey`]: "Óptima",
    [`${NS}productField`]: "Óptima",
    [`${NS}clienteGacme`]: "false",
    [`${NS}isGacme`]: "false",
    [`${NS}viaNameField`]: "",
    [`${NS}viaNumberField`]: "",
    [`${NS}clinicField`]: "",
    [`${NS}locationSearch`]: "true",
    [`${NS}clienteType`]: "AXA",
  }).toString();

  // Una pasada: obtiene sesión (cacheada o fresca), hace el POST y parsea.
  // Devuelve null para señalar "fallo recuperable" (POST !ok / 0 tarjetas), que
  // probablemente es un p_auth+cookie de sesión caducados pero aún en caché.
  async function attempt(forceRefresh: boolean): Promise<ReturnType<typeof extractCards> | null> {
    const session = await getSession(forceRefresh);
    if (!session) return null;
    const url = `${BASE}${PATH}?p_p_id=${PORTLET_ID}&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&${NS}javax.portlet.action=sendSearchHealth&p_auth=${session.pAuth}`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...(session.cookies ? { cookie: session.cookies } : {}),
        },
        body,
        cache: "no-store",
      });
      if (!r.ok) return null;
      const cards = extractCards(await r.text());
      return cards.length > 0 ? cards : null;
    } catch {
      return null;
    }
  }

  // El p_auth+cookies se cachean 20 min, pero la sesión puede morir server-side
  // antes: con el original, un token cacheado muerto devolvía [] en TODAS las
  // búsquedas de AXA hasta que expiraba el TTL. Reintentamos UNA vez con sesión
  // fresca si la cacheada falla. NB: AXA limita por IP y responde con HTML vacío
  // (no error) cuando te pasas — por eso NO insistimos más de un reintento: más
  // tiros solo aceleran el rate-limit sin recuperar resultados.
  const cards = (await attempt(false)) ?? (await attempt(true));
  if (!cards) return [];

  // IDs > 5e8 para no chocar con Adeslas/Occident/Allianz/Mapfre/Sanitas.
  return cards.map((c, i) => ({
    id: 500_000_000 + i,
    nombre: capitalize(c.medico.replace(/^(Dr\.|Dra\.|Sr\.|Sra\.)\s+/i, "")) || capitalize(c.centro),
    especialidad: especialidad || "",
    mutuas: ["AXA Salud"],
    direccion: capitalize(c.direccion),
    cp: c.cp,
    ciudad: capitalize(c.ciudad),
    telefono: c.telefono,
    rating: 0,
    numReviews: 0,
  }));
}
