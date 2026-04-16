/**
 * Cliente *live* de Caser Salud (`www.caser.es/cuadro-medico-salud`).
 *
 * Caser es un Liferay Portlet que responde HTML tras un POST form-urlencoded.
 * A diferencia de AXA NO usa `p_auth`, solo JSESSIONID (más estable).
 *
 * Flujo por búsqueda:
 *   1. GET `/cuadro-medico-salud` → establece JSESSIONID (sesión Liferay).
 *   2. POST al action `busquedaCMAction` con los params del form.
 *   3. 302 → GET `/cuadro-medico-salud/resultados` con TODOS los resultados en
 *      DOM (paginación client-side vía List.js: todos los `<li>` del contenedor
 *      `#centrosPagination` contienen spans `.lat .lng .telefono .link .nombre
 *      .direccion .cp .poblacion`).
 *
 * Taxonomía de especialidades (~140) cacheada en memoria. Acepta CP+especialidad
 * o solo provincia+especialidad; si no hay especialidad devolvemos [] porque
 * Caser obliga a indicar una.
 */
import type { Doctor } from "@/lib/types";

const BASE = "https://www.caser.es";
const PATH = "/cuadro-medico-salud";
const SEARCH_URL =
  `${BASE}${PATH}?p_p_id=BusquedaCuadroMedico_WAR_CuadroMedicoportlet` +
  `&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view` +
  `&_BusquedaCuadroMedico_WAR_CuadroMedicoportlet_action=busquedaCMAction`;
const RESULTS_URL = `${BASE}${PATH}/resultados`;
const ESPECIALIDADES_URL =
  `${BASE}${PATH}?p_p_id=BusquedaCuadroMedico_WAR_CuadroMedicoportlet` +
  `&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage` +
  `&_BusquedaCuadroMedico_WAR_CuadroMedicoportlet_action=cargarEspecialidadesByProvinciaCM`;

const SESSION_TTL_MS = 20 * 60 * 1000;
let sessionCache: { cookies: string; at: number } | null = null;
let especialidadesCache: Array<{ key: string; value: string }> | null = null;

// Mapa INE (prefijo CP) → ISO 3166-2 que usa Caser en `provincia.id`
// Derivado de la lista oficial del combobox de provincias del form.
const CP_PREFIX_TO_ISO: Record<string, { iso: string; nombre: string }> = {
  "01": { iso: "ES-VI", nombre: "Alava" },
  "02": { iso: "ES-AB", nombre: "Albacete" },
  "03": { iso: "ES-A", nombre: "Alicante" },
  "04": { iso: "ES-AL", nombre: "Almeria" },
  "05": { iso: "ES-AV", nombre: "Avila" },
  "06": { iso: "ES-BA", nombre: "Badajoz" },
  "07": { iso: "ES-PM", nombre: "Baleares" },
  "08": { iso: "ES-B", nombre: "Barcelona" },
  "09": { iso: "ES-BU", nombre: "Burgos" },
  "10": { iso: "ES-CC", nombre: "Caceres" },
  "11": { iso: "ES-CA", nombre: "Cadiz" },
  "12": { iso: "ES-CS", nombre: "Castellon" },
  "13": { iso: "ES-CR", nombre: "Ciudad Real" },
  "14": { iso: "ES-CO", nombre: "Cordoba" },
  "15": { iso: "ES-C", nombre: "A coruña" },
  "16": { iso: "ES-CU", nombre: "Cuenca" },
  "17": { iso: "ES-GI", nombre: "Girona" },
  "18": { iso: "ES-GR", nombre: "Granada" },
  "19": { iso: "ES-GU", nombre: "Guadalajara" },
  "20": { iso: "ES-SS", nombre: "Guipuzcoa" },
  "21": { iso: "ES-H", nombre: "Huelva" },
  "22": { iso: "ES-HU", nombre: "Huesca" },
  "23": { iso: "ES-J", nombre: "Jaen" },
  "24": { iso: "ES-LE", nombre: "Leon" },
  "25": { iso: "ES-L", nombre: "Lleida" },
  "26": { iso: "ES-LO", nombre: "La Rioja" },
  "27": { iso: "ES-LU", nombre: "Lugo" },
  "28": { iso: "ES-M", nombre: "Madrid" },
  "29": { iso: "ES-MA", nombre: "Malaga" },
  "30": { iso: "ES-MU", nombre: "Murcia" },
  "31": { iso: "ES-NA", nombre: "Navarra" },
  "32": { iso: "ES-OR", nombre: "Ourense" },
  "33": { iso: "ES-O", nombre: "Asturias" },
  "34": { iso: "ES-P", nombre: "Palencia" },
  "35": { iso: "ES-GC", nombre: "Las Palmas" },
  "36": { iso: "ES-PO", nombre: "Pontevedra" },
  "37": { iso: "ES-SA", nombre: "Salamanca" },
  "38": { iso: "ES-TF", nombre: "Santa Cruz de Tenerife" },
  "39": { iso: "ES-S", nombre: "Cantabria" },
  "40": { iso: "ES-SG", nombre: "Segovia" },
  "41": { iso: "ES-SE", nombre: "Sevilla" },
  "42": { iso: "ES-SO", nombre: "Soria" },
  "43": { iso: "ES-T", nombre: "Tarragona" },
  "44": { iso: "ES-TE", nombre: "Teruel" },
  "45": { iso: "ES-TO", nombre: "Toledo" },
  "46": { iso: "ES-V", nombre: "Valencia" },
  "47": { iso: "ES-VA", nombre: "Valladolid" },
  "48": { iso: "ES-BI", nombre: "Vizcaya" },
  "49": { iso: "ES-ZA", nombre: "Zamora" },
  "50": { iso: "ES-Z", nombre: "Zaragoza" },
  "51": { iso: "ES-CE", nombre: "Ceuta" },
  "52": { iso: "ES-ML", nombre: "Melilla" },
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getSession(): Promise<{ cookies: string } | null> {
  if (sessionCache && Date.now() - sessionCache.at < SESSION_TTL_MS) {
    return { cookies: sessionCache.cookies };
  }
  try {
    const r = await fetch(`${BASE}${PATH}`, { cache: "no-store" });
    const rawSetCookie = r.headers.get("set-cookie") || "";
    const cookies = rawSetCookie
      .split(/,(?=[^;]+=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
    if (!cookies) return null;
    sessionCache = { cookies, at: Date.now() };
    return { cookies };
  } catch {
    return null;
  }
}

async function getEspecialidades(
  isoProvincia: string,
  cookies: string
): Promise<Array<{ key: string; value: string }>> {
  if (especialidadesCache) return especialidadesCache;
  try {
    const body = new URLSearchParams({
      idProvincia: isoProvincia,
      idCuadroMedico: "1",
      urgencias: "false",
    });
    const r = await fetch(ESPECIALIDADES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        accept: "*/*",
        cookie: cookies,
      },
      body: body.toString(),
      cache: "no-store",
    });
    if (!r.ok) return [];
    const list = (await r.json()) as Array<{ key: string; value: string }>;
    especialidadesCache = list.filter((e) => e.key !== "00");
    return especialidadesCache;
  } catch {
    return [];
  }
}

async function resolveEspecialidad(
  especialidad: string,
  isoProvincia: string,
  cookies: string
): Promise<{ id: string; nombre: string } | null> {
  const list = await getEspecialidades(isoProvincia, cookies);
  if (!list.length) return null;
  const target = normalize(especialidad);
  const exact = list.find((e) => normalize(e.value) === target);
  if (exact) return { id: exact.key, nombre: exact.value };
  const prefix = list.find((e) => normalize(e.value).startsWith(target));
  if (prefix) return { id: prefix.key, nombre: prefix.value };
  const reverse = list.find((e) => target.startsWith(normalize(e.value)));
  if (reverse) return { id: reverse.key, nombre: reverse.value };
  const includes = list.find((e) => normalize(e.value).includes(target));
  if (includes) return { id: includes.key, nombre: includes.value };
  return null;
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

function extractSpan(block: string, cls: string): string {
  const re = new RegExp(
    `<span[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</span>`,
    "i"
  );
  return stripTags(block.match(re)?.[1] ?? "");
}

function extractCentros(html: string): Array<{
  nombre: string;
  direccion: string;
  cp: string;
  ciudad: string;
  telefono?: string;
}> {
  const out: ReturnType<typeof extractCentros> = [];
  // Cada resultado es un <li ...> dentro de <ul id="centrosPagination">
  const listMatch = html.match(
    /<ul[^>]*id="centrosPagination"[^>]*>([\s\S]*?)<\/ul>/i
  );
  if (!listMatch) return out;
  const inner = listMatch[1];
  const liRegex = /<li[^>]*class="[^"]*ca-list__item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = liRegex.exec(inner))) {
    const block = m[1];
    // Saltamos el "placeholder" de telemedicina que aparece como primer <li>
    // (no tiene lat/lng ni CP reales).
    const lat = extractSpan(block, "lat");
    if (!lat) continue;
    const nombreMatch = block.match(
      /<a[^>]*class="[^"]*\bnombre\b[^"]*"[^>]*title="([^"]*)"/i
    );
    const nombre = decodeHtmlEntities(nombreMatch?.[1] ?? extractSpan(block, "nombre"));
    if (!nombre) continue;
    const direccion = extractSpan(block, "direccion");
    const cp = extractSpan(block, "cp");
    const ciudad = extractSpan(block, "poblacion");
    const telefonoFixed = extractSpan(block, "telefonoFixed");
    const telefono = (telefonoFixed || extractSpan(block, "telefono")).replace(/\D/g, "") || undefined;
    out.push({ nombre, direccion, cp, ciudad, telefono });
  }
  return out;
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

export async function searchCaser(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!especialidad) return [];
  if (!cp || !/^\d{5}$/.test(cp)) return [];
  const prov = CP_PREFIX_TO_ISO[cp.slice(0, 2)];
  if (!prov) return [];

  const session = await getSession();
  if (!session) return [];

  const esp = await resolveEspecialidad(especialidad, prov.iso, session.cookies);
  if (!esp) return [];

  const body = new URLSearchParams({
    "cuadroMedico.iden": "1",
    "cuadroMedico.nombre": "Asistencia sanitaria",
    "provincia.id": prov.iso,
    "provincia.descripcion": prov.nombre,
    "poblacion.id": "00",
    "poblacion.descripcion": "",
    "especialidad.descripcion": esp.nombre,
    "especialidad.id": esp.id,
    codp: "",
    centro: "",
    coor_y: "",
    coor_x: "",
  });

  let html: string;
  try {
    const post = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        cookie: session.cookies,
      },
      body: body.toString(),
      redirect: "manual",
      cache: "no-store",
    });
    // Caser responde 302 → /cuadro-medico-salud/resultados. Seguimos manualmente
    // reusando las cookies de sesión (donde queda guardada la query).
    if (post.status !== 302 && post.status !== 200) return [];
    const get = await fetch(RESULTS_URL, {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        cookie: session.cookies,
      },
      cache: "no-store",
    });
    if (!get.ok) return [];
    html = await get.text();
  } catch {
    return [];
  }

  const centros = extractCentros(html);
  // IDs > 6e8 para no chocar con el resto de fuentes live.
  return centros.map((c, i) => ({
    id: 600_000_000 + i,
    nombre: capitalize(c.nombre),
    especialidad: esp.nombre ? capitalize(esp.nombre) : especialidad,
    mutuas: ["Caser Salud"],
    direccion: capitalize(c.direccion),
    cp: c.cp,
    ciudad: capitalize(c.ciudad),
    telefono: c.telefono,
    rating: 0,
    numReviews: 0,
  }));
}
