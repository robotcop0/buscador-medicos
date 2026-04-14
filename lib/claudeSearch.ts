import Anthropic from "@anthropic-ai/sdk";
import { coordsFromCP, haversineKm } from "@/lib/coordinates";

export type SearchResult = {
  id: number;
  nombre: string;
  especialidad: string;
  mutuas: string[];
  direccion: string;
  cp: string;
  ciudad: string;
  telefono: string;
  rating: number;
  numReviews: number;
  distanceKm: number | null;
};

// Caché en memoria con TTL de 1 hora
const searchCache = new Map<string, { results: SearchResult[]; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

// URLs conocidas de cuadros médicos para ayudar a Claude
const CUADROS_MEDICOS: Record<string, string> = {
  Adeslas:          "adeslas.es/buscador-de-medicos",
  Sanitas:          "sanitas.es/sanitas/seguros/es/particulares/buscador-profesionales",
  DKV:              "dkvseguros.com/cuadro-medico",
  Mapfre:           "mapfre.es/seguros/particulares/salud/cuadro-medico",
  Asisa:            "asisa.es/cuadro-medico",
  Cigna:            "cigna.es/cuadro-medico",
  "AXA Salud":      "axasalud.es/cuadro-medico",
  Generali:         "generali.es/seguros-salud/cuadro-medico",
  "Caser Salud":    "caserseguros.es/seguros-salud/cuadro-medico",
  Allianz:          "allianz.es/salud/cuadro-medico",
  Fiatc:            "fiatc.es/seguros/salud/cuadro-medico",
  Muface:           "muface.es/web/guest/medicos-y-farmacias",
  IMQ:              "imq.es/cuadro-medico",
  "Divina Pastora": "divinapastora.es/seguros-salud/cuadro-medico",
  Occidente:        "segurosoccidente.es/salud/cuadro-medico",
};

const SYSTEM_PROMPT = `Eres un asistente especializado en encontrar médicos en España.
Debes seguir este proceso en DOS PASOS obligatorios:

═══ PASO 1: CUADRO MÉDICO OFICIAL ═══
Busca los médicos directamente en el cuadro médico oficial de la mutua indicada.
Usa web_search con queries como:
- "[mutua] cuadro médico [especialidad] [ciudad o CP]"
- "site:[dominio de la mutua] [especialidad] [ciudad]"
Extrae el máximo de nombres reales de médicos que aparezcan en el cuadro médico.
Si no encuentras resultados directos en la web de la mutua, busca también en:
- doctoralia.es filtrando por la mutua y especialidad
- topdoctors.es

═══ PASO 2: VALORACIONES Y DATOS DE CONTACTO ═══
Para cada médico encontrado en el Paso 1, haz una búsqueda web para obtener:
- Valoración (rating 0-5) y número de reseñas
- Dirección exacta de la consulta
- Teléfono de contacto
Usa SOLO web_search, NO hagas fetch de páginas completas.
Query recomendada: "[nombre médico] doctoralia [ciudad]"

═══ RESULTADO FINAL ═══
Responde ÚNICAMENTE con JSON válido, sin texto antes ni después:

{"medicos":[{"nombre":"Dr. Nombre Apellido","especialidad":"Cardiología","mutuas":["Adeslas"],"direccion":"Calle Mayor 10, 1º","cp":"28001","ciudad":"Madrid","telefono":"912345678","rating":4.8,"numReviews":150}]}

Reglas del JSON:
- Solo médicos confirmados en el cuadro médico de la mutua (Paso 1)
- "rating" entre 0 y 5 (0 si no se encontró)
- "numReviews" entero (0 si no se encontró)
- "cp" de 5 dígitos (inferir de la ciudad si no aparece)
- "telefono" string solo con dígitos, vacío "" si no se encontró
- "direccion" lo más completa posible (calle, número, piso si aparece)
- "mutuas" incluye la mutua buscada más otras que acepte si aparecen
- Ordena por rating descendente
- Entre 5 y 10 médicos`;

type RawDoctor = {
  nombre?: unknown;
  especialidad?: unknown;
  mutuas?: unknown;
  direccion?: unknown;
  cp?: unknown;
  ciudad?: unknown;
  telefono?: unknown;
  rating?: unknown;
  numReviews?: unknown;
};

export async function searchDoctors(
  mutua: string,
  especialidad: string,
  cp: string,
  radio?: number
): Promise<SearchResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  // Comprobar caché
  const cacheKey = `${mutua}|${especialidad}|${cp}|${radio ?? ""}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.results;
  }

  const client = new Anthropic({ apiKey });

  const hasMutua = mutua && mutua !== "Sin mutua";
  const cuadroUrl = hasMutua ? CUADROS_MEDICOS[mutua] : null;

  let query: string;

  if (hasMutua) {
    query = `PASO 1 — Cuadro médico:
Busca médicos de "${especialidad || "cualquier especialidad"}" en el cuadro médico oficial de ${mutua}.
${cuadroUrl ? `La web oficial del cuadro médico de ${mutua} es: ${cuadroUrl}` : ""}
Zona: ${cp ? `código postal ${cp}${radio ? `, radio ${radio} km` : ""}` : "España"}.
Extrae todos los nombres de médicos que aparezcan.

PASO 2 — Valoraciones y contacto:
Para cada médico del Paso 1, busca su perfil en Doctoralia para obtener su puntuación, reseñas, dirección exacta y teléfono.`;
  } else {
    query = `PASO 1 — Directorio médico:
Busca médicos de "${especialidad || "cualquier especialidad"}" en doctoralia.es y topdoctors.es.
Zona: ${cp ? `código postal ${cp}${radio ? `, radio ${radio} km` : ""}` : "España"}.

PASO 2 — Valoraciones y contacto:
Para cada médico encontrado, extrae o confirma su valoración, reseñas, dirección exacta y teléfono en Doctoralia.`;
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: query },
  ];

  let lastText = "";

  // Bucle para manejar pause_turn (límite del sampling loop interno de web_search)
  for (let iter = 0; iter < 3; iter++) {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages,
      tools: [
        { type: "web_search_20260209", name: "web_search" },
      ],
    });

    const message = await stream.finalMessage();
    messages.push({ role: "assistant", content: message.content });

    for (const block of message.content) {
      if (block.type === "text") lastText = block.text;
    }

    if (message.stop_reason !== "pause_turn") break;
  }

  const results = parseResponse(lastText, cp);

  // Guardar en caché
  searchCache.set(cacheKey, { results, ts: Date.now() });

  return results;
}

function parseResponse(text: string, userCp: string): SearchResult[] {
  const jsonMatch = text.match(/\{[\s\S]*"medicos"[\s\S]*\}/);
  if (!jsonMatch) return [];

  let parsed: { medicos: RawDoctor[] };
  try {
    parsed = JSON.parse(jsonMatch[0]) as { medicos: RawDoctor[] };
  } catch {
    return [];
  }

  if (!Array.isArray(parsed?.medicos)) return [];

  const userCoords = userCp ? coordsFromCP(userCp) : null;

  return parsed.medicos
    .filter((d) => d.nombre && typeof d.nombre === "string")
    .map((doc) => {
      const cp = String(doc.cp ?? "").replace(/\D/g, "").slice(0, 5);
      const doctorCoords = cp ? coordsFromCP(cp) : null;
      const distanceKm =
        userCoords && doctorCoords
          ? Math.round(haversineKm(userCoords, doctorCoords))
          : null;

      return {
        id: 0,
        nombre: String(doc.nombre ?? ""),
        especialidad: String(doc.especialidad ?? ""),
        mutuas: Array.isArray(doc.mutuas)
          ? (doc.mutuas as unknown[]).map(String)
          : typeof doc.mutuas === "string"
          ? [doc.mutuas]
          : [],
        direccion: String(doc.direccion ?? ""),
        cp,
        ciudad: String(doc.ciudad ?? ""),
        telefono: String(doc.telefono ?? "").replace(/\D/g, ""),
        rating: Math.min(5, Math.max(0, Number(doc.rating) || 0)),
        numReviews: Math.max(0, Math.round(Number(doc.numReviews) || 0)),
        distanceKm,
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .map((doc, i) => ({ ...doc, id: i + 1 }));
}
