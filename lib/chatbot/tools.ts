import type Anthropic from "@anthropic-ai/sdk";
import { findDoctors } from "@/lib/doctorSearch";
import { cityToCp } from "@/lib/chatbot/city-lookup";
import { MUTUAS } from "@/lib/chatbot/catalog";

/** Las 2 tools que se le ofrecen a Claude. */
export const CHATBOT_TOOLS: Anthropic.Tool[] = [
  {
    name: "buscar_medicos",
    description:
      "Busca médicos y centros del cuadro médico de una mutua, ya ordenados por valoración real (Doctoralia/Google) y cercanía. Devuelve los 5 mejores y la URL del listado completo. REQUISITOS: mutua + especialidad + (código postal de 5 dígitos O ciudad). NO llames a esta herramienta si te falta la mutua, la especialidad o la ubicación: usa antes `solicitar_seleccion` para pedírselos al usuario, de uno en uno.",
    input_schema: {
      type: "object",
      properties: {
        mutua: {
          type: "string",
          enum: [...MUTUAS] as string[],
          description: "Aseguradora / cuadro médico del usuario.",
        },
        especialidad: {
          type: "string",
          description:
            "Especialidad médica, p.ej. 'Cardiología', 'Dermatología', 'Pediatría'. Se hace coincidencia parcial sin acentos.",
        },
        cp: {
          type: "string",
          description: "Código postal español de 5 dígitos. Opcional si proporcionas `ciudad`.",
        },
        ciudad: {
          type: "string",
          description: "Ciudad del usuario. Opcional si proporcionas `cp`. Si das ambos, se usa `cp`.",
        },
        radio_km: {
          type: "number",
          description:
            "Radio máximo de desplazamiento en km (2, 10, 25, 50, 100…). Omítelo para buscar en toda la provincia.",
        },
      },
      required: ["mutua", "especialidad"],
    },
  },
  {
    name: "solicitar_seleccion",
    description:
      "Pregunta al usuario por un dato que falta mostrándole botones para elegir (más, opcionalmente, una respuesta libre). Úsala SIEMPRE en vez de preguntar en texto plano cuando haya opciones claras: mutua, especialidad, ubicación o radio de desplazamiento. El RESULTADO de esta herramienta será exactamente la opción que elija el usuario; tras recibirlo, continúa la conversación.",
    input_schema: {
      type: "object",
      properties: {
        pregunta: {
          type: "string",
          description: "La pregunta para el usuario, en español, cercana y breve (una sola pregunta).",
        },
        campo: {
          type: "string",
          enum: ["mutua", "especialidad", "ubicacion", "radio_km"],
          description: "Qué dato estás pidiendo.",
        },
        opciones: {
          type: "array",
          description:
            "Entre 3 y 8 opciones. Para `radio_km` usa exactamente: [{label:'2 km',value:'2'},{label:'10 km',value:'10'},{label:'25 km',value:'25'},{label:'50 km',value:'50'},{label:'100 km',value:'100'},{label:'Toda la provincia',value:'provincia'}].",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Texto del botón." },
              value: { type: "string", description: "Valor que se te devolverá si el usuario lo pulsa." },
            },
            required: ["label", "value"],
          },
        },
        permite_personalizado: {
          type: "boolean",
          description:
            "Si true, el usuario también podrá escribir una respuesta libre ('Otro…'). Útil sobre todo para el radio (p.ej. '15 km').",
        },
      },
      required: ["pregunta", "campo", "opciones"],
    },
  },
];

type BuscarInput = {
  mutua?: string;
  especialidad?: string;
  cp?: string;
  ciudad?: string;
  radio_km?: number;
};

/**
 * Ejecuta `buscar_medicos`. Devuelve SIEMPRE un string JSON (lo que verá Claude
 * como `tool_result`). Nunca lanza.
 */
export async function buscarMedicos(rawInput: unknown): Promise<string> {
  const input = (rawInput ?? {}) as BuscarInput;
  const especialidad = (input.especialidad ?? "").trim();
  const mutua = (input.mutua ?? "").trim();

  if (!especialidad) {
    return JSON.stringify({
      error: "Falta la especialidad. Pídesela al usuario con solicitar_seleccion antes de buscar.",
    });
  }

  let cp = (input.cp ?? "").replace(/\D/g, "").slice(0, 5);
  let ciudadResuelta: string | null = null;
  if (cp.length !== 5 && input.ciudad) {
    const c = cityToCp(input.ciudad);
    if (c) {
      cp = c;
      ciudadResuelta = input.ciudad;
    }
  }
  if (cp.length !== 5) {
    return JSON.stringify({
      error:
        "Falta un código postal de 5 dígitos o una ciudad reconocible. Pídeselo al usuario con solicitar_seleccion antes de buscar.",
    });
  }

  // Radio en km si se ha indicado (>0). Funciona también con el CP resuelto desde una
  // ciudad: el filtro es Haversine desde ese CP. Si no hay radio, `findDoctors` cae a
  // match por provincia (cp.slice(0,2)).
  const radioKm = typeof input.radio_km === "number" && input.radio_km > 0 ? input.radio_km : undefined;

  let doctorList;
  try {
    const res = await findDoctors(mutua, especialidad, cp, radioKm);
    doctorList = res.doctors;
  } catch {
    return JSON.stringify({ error: "No he podido completar la búsqueda ahora mismo. Inténtalo de nuevo." });
  }

  const top = doctorList.slice(0, 5).map((d) => ({
    nombre: d.nombre,
    especialidad: d.especialidad,
    direccion: d.direccion,
    ciudad: d.ciudad,
    cp: d.cp,
    mutuas: d.mutuas,
    telefono: d.telefono ?? null,
    // `valoracion` = score con el que está ordenado el listado (lo que muestra la UI),
    // `notaCruda` = nota media real. null si no tiene reseñas.
    valoracion: d.numReviews > 0 ? Math.round((d.rankScore ?? d.rating) * 10) / 10 : null,
    notaCruda: d.numReviews > 0 ? d.rating : null,
    numResenas: d.numReviews,
    distanciaKm: d.distanceKm ?? null,
  }));

  const params = new URLSearchParams();
  if (mutua) params.set("mutua", mutua);
  params.set("especialidad", especialidad);
  params.set("cp", cp);
  if (radioKm) params.set("radio", String(radioKm));

  return JSON.stringify({
    totalFound: doctorList.length,
    mostrados: top.length,
    top,
    resultadosUrl: `/resultados?${params.toString()}`,
    ciudadResueltaDesde: ciudadResuelta,
    nota:
      doctorList.length === 0
        ? "Sin resultados. Sugiere al usuario ampliar el radio o cambiar de especialidad/mutua."
        : undefined,
  });
}
