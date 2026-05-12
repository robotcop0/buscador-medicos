# Chatbot asistente de búsqueda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una "ventanita" de chat en la home (debajo del buscador) conectada a Claude Haiku 4.5 con tools que envuelven `findDoctors`, que pide los datos que falten con botones (chips) y devuelve los mejores médicos en Markdown + enlace a `/resultados`.

**Architecture:** Bucle agéntico manual en un route handler `app/api/chat/route.ts` (la API key vive solo en el servidor). Dos tools: `buscar_medicos` (envuelve `findDoctors`) y `solicitar_seleccion` (pausa el bucle y devuelve al cliente una "pregunta con opciones"; el cliente la pinta como chips y reenvía la elección como `tool_result`). El cliente `components/ChatWidget.tsx` mantiene dos arrays — `apiMessages` (lo exacto que va/viene de la API) y `display` (lo que se renderiza) — persistidos en `localStorage`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, `@anthropic-ai/sdk` (ya instalado), `react-markdown` + `remark-gfm` (nuevas).

**Spec:** `docs/superpowers/specs/2026-05-12-chatbot-asistente-design.md`

**Nota sobre tests:** El repo no tiene runner de tests. La "verificación" de cada tarea es `npm run lint`, `npm run build` cuando aplique, y comprobaciones manuales con `npm run dev`. No inventes un framework de tests.

---

## File Structure

| Fichero | Responsabilidad |
|---|---|
| `lib/chatbot/types.ts` (crear) | Tipos compartidos: `ChatMessage` (alias de `Anthropic.MessageParam`), `SelectionOption`, `PendingSelection`, `ChatApiResponse`. |
| `lib/chatbot/catalog.ts` (crear) | Constantes `MUTUAS` (15) y `ESPECIALIDADES` (33), copiadas de `components/SearchForm.tsx`. Reutilizadas por tools y system prompt. |
| `lib/chatbot/city-lookup.ts` (crear) | `cityToCp(ciudad)` — mapa ciudad→CP más frecuente, construido una vez desde `data/doctors`. |
| `lib/chatbot/tools.ts` (crear) | Definición JSON-schema de las 2 tools (`CHATBOT_TOOLS`) + ejecutor `buscarMedicos(input)`. |
| `lib/chatbot/system-prompt.ts` (crear) | `SYSTEM_PROMPT` (string en español con catálogos y reglas). |
| `app/api/chat/route.ts` (crear) | `POST` — valida payload, rate-limit por IP, bucle agéntico, devuelve `ChatApiResponse`. |
| `components/ChatWidget.tsx` (crear) | Client component: panel plegable, mensajes, chips, input. |
| `app/page.tsx` (modificar) | Montar `<ChatWidget />` debajo de `<SearchForm />` en el hero. |
| `.env.example` (crear) | Plantilla con `ANTHROPIC_API_KEY=`. |
| `package.json` (modificar) | Añadir `react-markdown` + `remark-gfm` a `dependencies`. |
| `CLAUDE.md` (modificar) | Documentar el chatbot. |

---

## Task 1: Dependencias y plantilla de entorno

**Files:**
- Modify: `package.json` (vía `npm install`)
- Create: `.env.example`

- [ ] **Step 1: Instalar las librerías de Markdown**

Run:
```bash
npm install react-markdown remark-gfm
```
Expected: instala `react-markdown` (^9) y `remark-gfm` (^4), aparecen en `dependencies` de `package.json`. (`@anthropic-ai/sdk` ya está en `dependencies` — no tocar.)

- [ ] **Step 2: Crear `.env.example`**

Crear `.env.example` con este contenido exacto:
```
# API key de Anthropic para el chatbot de /api/chat. Obtenla en https://console.anthropic.com
# Cópiala a .env.local (que está en .gitignore). El chatbot es opcional: si no está,
# el route /api/chat responde con un error controlado y el buscador clásico sigue funcionando.
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: Verificar que `.env.local` está ignorado**

Run:
```bash
git check-ignore -v .env.local
```
Expected: imprime una línea de `.gitignore` que matchea `.env.local` (o `.env*.local`). Si NO está ignorado, añadir `.env*.local` a `.gitignore` antes de continuar.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "$(cat <<'EOF'
Anade react-markdown y plantilla .env para el chatbot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tipos del chatbot

**Files:**
- Create: `lib/chatbot/types.ts`

- [ ] **Step 1: Escribir `lib/chatbot/types.ts`**

```ts
import type Anthropic from "@anthropic-ai/sdk";

/** Un turno de la conversación, tal cual lo acepta la API de mensajes de Anthropic. */
export type ChatMessage = Anthropic.MessageParam;

export type SelectionOption = { label: string; value: string };

/**
 * Pregunta con opciones que el asistente quiere hacerle al usuario.
 * Nace de un `tool_use` de `solicitar_seleccion`; el cliente la pinta como
 * chips y, cuando el usuario elige, reenvía la elección como `tool_result`
 * con este `toolUseId`.
 */
export type PendingSelection = {
  toolUseId: string;
  pregunta: string;
  campo: string; // "mutua" | "especialidad" | "ubicacion" | "radio_km" | otro
  opciones: SelectionOption[];
  permitePersonalizado: boolean;
};

/** Respuesta de `POST /api/chat`. */
export type ChatApiResponse =
  | {
      ok: true;
      /** Texto Markdown del asistente para esta respuesta (puede ir vacío si solo pregunta). */
      assistantText: string;
      /**
       * Bloques de contenido crudos del turno del asistente, SOLO cuando hay
       * `pendingSelection` (el cliente debe añadirlos a `apiMessages` para que
       * el `tool_result` posterior referencie el `tool_use` correcto). `null`
       * en el resto de casos: el cliente añade `{ role: "assistant", content: assistantText }`.
       */
      assistantContent: Anthropic.ContentBlockParam[] | null;
      pendingSelection: PendingSelection | null;
    }
  | { ok: false; error: string };
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos en `lib/chatbot/types.ts`. (Si `tsc` tarda mucho o el proyecto tiene errores preexistentes ajenos, basta con que no haya errores en el fichero nuevo.)

- [ ] **Step 3: Commit**

```bash
git add lib/chatbot/types.ts
git commit -m "$(cat <<'EOF'
Anade tipos del chatbot (ChatMessage, PendingSelection, ChatApiResponse)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Catálogos (mutuas + especialidades)

**Files:**
- Create: `lib/chatbot/catalog.ts`

- [ ] **Step 1: Escribir `lib/chatbot/catalog.ts`**

Copiar las listas de `components/SearchForm.tsx` (`AVAILABLE_MUTUAS` y `ESPECIALIDADES`):

```ts
/** Mutuas con cuadro médico disponible (espejo de AVAILABLE_MUTUAS en SearchForm). */
export const MUTUAS = [
  "Adeslas",
  "Allianz",
  "Asisa",
  "AXA Salud",
  "Caser Salud",
  "Cigna",
  "DKV",
  "Divina Pastora",
  "Fiatc",
  "Generali",
  "IMQ",
  "Mapfre",
  "MUFACE",
  "Occidente",
  "Sanitas",
] as const;

/** Especialidades del desplegable (espejo de ESPECIALIDADES en SearchForm). */
export const ESPECIALIDADES = [
  "Alergología",
  "Andrología",
  "Aparato digestivo",
  "Cardiología",
  "Cirugía general",
  "Cirugía plástica",
  "Dermatología",
  "Endocrinología",
  "Fisioterapia",
  "Ginecología",
  "Hematología",
  "Logopedia",
  "Medicina de urgencias",
  "Medicina estética",
  "Medicina general",
  "Medicina interna",
  "Nefrología",
  "Neumología",
  "Neurocirugía",
  "Neurología",
  "Nutrición y dietética",
  "Odontología",
  "Oftalmología",
  "Oncología",
  "Otorrinolaringología",
  "Pediatría",
  "Podología",
  "Psicología",
  "Psiquiatría",
  "Rehabilitación",
  "Reumatología",
  "Traumatología",
  "Urología",
] as const;
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add lib/chatbot/catalog.ts
git commit -m "$(cat <<'EOF'
Anade catalogo de mutuas y especialidades del chatbot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Resolución ciudad → código postal

**Files:**
- Create: `lib/chatbot/city-lookup.ts`

- [ ] **Step 1: Escribir `lib/chatbot/city-lookup.ts`**

```ts
import { doctors } from "@/data/doctors";

/** Normaliza para comparar ciudades: minúsculas, sin acentos, espacios colapsados. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let cache: Map<string, string> | null = null;

function build(): Map<string, string> {
  // ciudadNorm -> (cp -> nº de médicos con ese cp en esa ciudad)
  const counts = new Map<string, Map<string, number>>();
  for (const d of doctors) {
    if (!d.ciudad || !d.cp || !/^\d{5}$/.test(d.cp)) continue;
    const key = norm(d.ciudad);
    if (!key) continue;
    let m = counts.get(key);
    if (!m) {
      m = new Map();
      counts.set(key, m);
    }
    m.set(d.cp, (m.get(d.cp) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const [city, m] of counts) {
    let bestCp = "";
    let bestN = -1;
    for (const [cp, n] of m) {
      if (n > bestN) {
        bestN = n;
        bestCp = cp;
      }
    }
    if (bestCp) out.set(city, bestCp);
  }
  return out;
}

/** Devuelve un CP representativo (el más frecuente) para una ciudad, o `null`. */
export function cityToCp(ciudad: string | undefined | null): string | null {
  if (!ciudad) return null;
  if (!cache) cache = build();
  return cache.get(norm(ciudad)) ?? null;
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 3: Smoke test manual del lookup**

Run:
```bash
npx tsx -e "import('./lib/chatbot/city-lookup.ts').then(m => console.log('Madrid ->', m.cityToCp('Madrid'), '| Barcelona ->', m.cityToCp('barcelona'), '| inventada ->', m.cityToCp('Ciudad Inventada')))"
```
Expected: imprime un CP de 5 dígitos para Madrid (empieza por `28`) y Barcelona (empieza por `08`), y `null` para la ciudad inventada. Si `tsx -e` falla por el alias `@/`, omite este step (lo verás en la verificación end-to-end de la Task 9).

- [ ] **Step 4: Commit**

```bash
git add lib/chatbot/city-lookup.ts
git commit -m "$(cat <<'EOF'
Anade resolucion ciudad->codigo postal para el chatbot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Tools (definiciones + ejecutor `buscarMedicos`)

**Files:**
- Create: `lib/chatbot/tools.ts`

- [ ] **Step 1: Escribir `lib/chatbot/tools.ts`**

```ts
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
          enum: [...MUTUAS],
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

  // Si hemos resuelto el CP a partir de la ciudad, no aplicamos radio (buscamos a nivel provincia).
  const radioKm =
    !ciudadResuelta && typeof input.radio_km === "number" && input.radio_km > 0
      ? input.radio_km
      : undefined;

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
  if (!ciudadResuelta && radioKm) params.set("radio", String(radioKm));

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
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos. (Si TS se queja de `enum: [...MUTUAS]` por el `readonly`, está cubierto con el spread `[...MUTUAS]`.)

- [ ] **Step 3: Commit**

```bash
git add lib/chatbot/tools.ts
git commit -m "$(cat <<'EOF'
Anade tools del chatbot: buscar_medicos y solicitar_seleccion

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: System prompt

**Files:**
- Create: `lib/chatbot/system-prompt.ts`

- [ ] **Step 1: Escribir `lib/chatbot/system-prompt.ts`**

```ts
import { MUTUAS, ESPECIALIDADES } from "@/lib/chatbot/catalog";

export const SYSTEM_PROMPT = `Eres el asistente del "Buscador de Médicos", una web española que unifica los cuadros médicos públicos de varias aseguradoras privadas. Tu trabajo: ayudar a la persona a encontrar el mejor médico o centro para su caso, filtrando por mutua, especialidad y ubicación, y mostrarle un top de resultados ya ordenados por valoración real y cercanía.

# Tono
Cercano, claro y breve. En español. Sin tecnicismos. No te enrolles.

# Catálogos
Mutuas disponibles (usa estos nombres EXACTOS al llamar a las herramientas): ${MUTUAS.join(", ")}.
Especialidades habituales: ${ESPECIALIDADES.join(", ")}. (Si el usuario pide algo parecido a una de estas, úsala; la búsqueda hace coincidencia parcial sin acentos, así que "Cardiología" también encuentra "Cardiología Infantil".)

# Datos que necesitas antes de buscar
Para llamar a \`buscar_medicos\` necesitas SIEMPRE:
1. La mutua (cuadro médico) del usuario.
2. La especialidad / ámbito del médico.
3. La ubicación: un código postal español de 5 dígitos, o una ciudad.
El radio de desplazamiento (km) es opcional pero conviene preguntarlo.

# Cómo pedir lo que falta
- Si falta CUALQUIERA de esos datos, pídelo con la herramienta \`solicitar_seleccion\` (botones), NO en texto plano. Pide UNA cosa cada vez (primero lo más bloqueante).
- Para la mutua: ofrece como opciones las del catálogo (o, si el usuario ha escrito algo aproximado, las 4-5 más probables) con \`permite_personalizado: true\`.
- Para la especialidad: ofrece opciones del catálogo relevantes al motivo de consulta, con \`permite_personalizado: true\`.
- Para la ubicación: pregunta por código postal o ciudad (puedes ofrecer un par de ciudades grandes como ejemplo) con \`permite_personalizado: true\`.
- Para el radio: SIEMPRE ofrece exactamente estas opciones: 2 km, 10 km, 25 km, 50 km, 100 km, "Toda la provincia", con \`permite_personalizado: true\`. Una buena pregunta: "¿Cuánto estarías dispuesto/a a desplazarte por un buen médico?". Si el usuario elige "Toda la provincia" (value "provincia") o escribe algo equivalente, llama a \`buscar_medicos\` SIN \`radio_km\`.
- El resultado de \`solicitar_seleccion\` será el texto/valor que elija el usuario. Tras recibirlo, sigue: pide el siguiente dato que falte o, si ya tienes todo, busca.

# Al presentar resultados
- Usa SOLO lo que devuelva \`buscar_medicos\`. Nunca inventes médicos, centros, teléfonos ni valoraciones.
- Responde en Markdown bonito:
  - Una frase de intro ("He encontrado N opciones de [especialidad] de [mutua] cerca de [cp/ciudad]. Estas son las mejor valoradas:").
  - Una lista numerada con los 3-5 mejores. Por cada uno: **nombre en negrita**, y debajo una línea con \`especialidad · dirección, ciudad\`, otra con la valoración (⭐ N,N · M reseñas) si la tiene (si \`valoracion\` es null, di "sin valoraciones todavía"), la distancia ("a ~X km") si la hay, y el teléfono si lo hay.
  - Un párrafo corto de "por qué te recomiendo estos" (esencialmente: están mejor valorados y más cerca; el orden ya combina nota y nº de reseñas).
  - Al final, en su propia línea: \`**[Ver los N resultados completos →](URL)**\` usando el \`resultadosUrl\` que te devuelve la herramienta.
- Si \`totalFound\` es 0: dilo con tacto y sugiere ampliar el radio o cambiar especialidad/mutua (y ofrécelo con \`solicitar_seleccion\` si procede).
- Si la búsqueda se hizo a partir de una ciudad (campo \`ciudadResueltaDesde\` no nulo), avisa de que has buscado en toda esa zona/provincia y que con un código postal podrías afinar más por cercanía.

# Límites
- No reservas citas ni accedes a agendas. Recuérdalo cuando dé resultados: "para pedir cita, llama al teléfono del centro".
- No das consejo médico. Si te preguntan por síntomas/diagnósticos, redirige amablemente: tu función es encontrar al profesional adecuado, no diagnosticar.
- Si te preguntan algo totalmente fuera de tema, recondúcelo a tu función.`;
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add lib/chatbot/system-prompt.ts
git commit -m "$(cat <<'EOF'
Anade system prompt del chatbot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Route handler `/api/chat`

**Files:**
- Create: `app/api/chat/route.ts`

Notas de implementación:
- Modelo: `claude-haiku-4-5` (constante `CHATBOT_MODEL`). Haiku NO acepta el parámetro `effort` ni `thinking` de tipo "enabled" — no los pongas; tampoco hace falta `thinking`.
- `max_tokens: 2048` (respuesta de chat, no necesita más).
- `system` como bloque con `cache_control: { type: "ephemeral" }` (el catálogo es estático; si el prompt no llega al mínimo cacheable, simplemente no cachea — sin error).
- Bucle agéntico MANUAL (necesitamos detectar `solicitar_seleccion` para pausar). Máx 5 iteraciones de tool.
- Rate-limit en memoria por IP: máx 20 mensajes / 10 min. Tope de longitud de conversación: máx 24 turnos en `messages` (≈12 intercambios) → si se excede, pedir reiniciar.
- Errores de la API de Anthropic: usar las clases tipadas (`Anthropic.RateLimitError`, `Anthropic.APIError`). Nunca filtrar por substring del mensaje.

- [ ] **Step 1: Escribir `app/api/chat/route.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { ChatApiResponse, ChatMessage, PendingSelection } from "@/lib/chatbot/types";
import { SYSTEM_PROMPT } from "@/lib/chatbot/system-prompt";
import { CHATBOT_TOOLS, buscarMedicos } from "@/lib/chatbot/tools";

export const runtime = "nodejs";
// Importa data/doctors (grande); no es una ruta estática.
export const dynamic = "force-dynamic";

const CHATBOT_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 2048;
const MAX_TOOL_ITERATIONS = 5;
const MAX_CONVERSATION_TURNS = 24;

// Rate-limit best-effort en memoria (se reinicia con el proceso). 20 msgs / 10 min por IP.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const rateLog = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rateLog.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  rateLog.set(ip, arr);
  // Limpieza oportunista para no crecer sin límite.
  if (rateLog.size > 5000) {
    for (const [k, v] of rateLog) if (v.every((t) => now - t >= RATE_WINDOW_MS)) rateLog.delete(k);
  }
  return arr.length > RATE_MAX;
}

function json(body: ChatApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

/** Saca el texto plano de un turno de asistente (ignora tool_use). */
function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function parseSelection(toolUse: Anthropic.Messages.ToolUseBlock): PendingSelection {
  const inp = (toolUse.input ?? {}) as {
    pregunta?: string;
    campo?: string;
    opciones?: { label?: string; value?: string }[];
    permite_personalizado?: boolean;
  };
  const opciones = (inp.opciones ?? [])
    .filter((o) => o && typeof o.label === "string" && typeof o.value === "string")
    .map((o) => ({ label: o.label as string, value: o.value as string }));
  return {
    toolUseId: toolUse.id,
    pregunta: inp.pregunta ?? "¿Qué prefieres?",
    campo: inp.campo ?? "",
    opciones,
    permitePersonalizado: !!inp.permite_personalizado,
  };
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { ok: false, error: "El asistente no está disponible ahora mismo. Puedes usar el buscador de arriba." },
      503,
    );
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return json({ ok: false, error: "Has hecho muchas preguntas seguidas. Espera un momento y vuelve a intentarlo." }, 429);
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    if (!body || !Array.isArray(body.messages)) throw new Error("bad body");
    messages = body.messages as ChatMessage[];
  } catch {
    return json({ ok: false, error: "Petición inválida." }, 400);
  }
  if (messages.length === 0) return json({ ok: false, error: "Conversación vacía." }, 400);
  if (messages.length > MAX_CONVERSATION_TURNS) {
    return json(
      { ok: false, error: "Esta conversación se ha hecho muy larga. Pulsa «Reiniciar» y empieza de nuevo, por favor." },
      400,
    );
  }

  const client = new Anthropic({ apiKey });
  // Copia mutable de la conversación para el bucle agéntico.
  let convo: Anthropic.MessageParam[] = [...messages];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: CHATBOT_MODEL,
        max_tokens: MAX_TOKENS,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: CHATBOT_TOOLS,
        messages: convo,
      });

      const text = extractText(response.content);
      const toolUses = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );

      // ¿Pide una selección al usuario? -> pausa el bucle y delega en el cliente.
      const selectionUse = toolUses.find((b) => b.name === "solicitar_seleccion");
      if (selectionUse) {
        return json({
          ok: true,
          assistantText: text,
          assistantContent: response.content as Anthropic.ContentBlockParam[],
          pendingSelection: parseSelection(selectionUse),
        });
      }

      // ¿Terminó? (sin tool_use, o stop_reason != tool_use)
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        return json({
          ok: true,
          assistantText: text || "Perdona, no he sabido responder a eso. ¿Puedes reformularlo?",
          assistantContent: null,
          pendingSelection: null,
        });
      }

      // Ejecuta las tools de búsqueda y vuelve a llamar.
      convo = [...convo, { role: "assistant", content: response.content }];
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        let out: string;
        if (tu.name === "buscar_medicos") {
          out = await buscarMedicos(tu.input);
        } else {
          out = JSON.stringify({ error: `Herramienta desconocida: ${tu.name}` });
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      }
      convo = [...convo, { role: "user", content: results }];
    }

    // Demasiadas iteraciones de tool.
    return json({
      ok: true,
      assistantText: "Me ha costado demasiado completar la búsqueda. ¿Puedes darme la mutua, la especialidad y el código postal de nuevo?",
      assistantContent: null,
      pendingSelection: null,
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ ok: false, error: "El asistente está saturado ahora mismo. Prueba dentro de un minuto." }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      return json({ ok: false, error: "El asistente ha tenido un problema. Vuelve a intentarlo en un momento." }, 502);
    }
    return json({ ok: false, error: "Error inesperado en el asistente." }, 500);
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos. Si TS se queja del tipo de `response.content as Anthropic.ContentBlockParam[]` (Message content es `ContentBlock[]`, no `ContentBlockParam[]`), usa el cast como está — son estructuralmente compatibles para reenviarlos como `content` en el siguiente request. Si aun así protesta, cambia el cast a `as unknown as Anthropic.ContentBlockParam[]`.

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos atribuibles a `app/api/chat/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "$(cat <<'EOF'
Anade route /api/chat: bucle agentico con tools y rate-limit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Componente `ChatWidget`

**Files:**
- Create: `components/ChatWidget.tsx`

Notas:
- Client component. Estado: `open` (plegado por defecto), `apiMessages: ChatMessage[]`, `display: DisplayItem[]`, `input`, `loading`, `customFor` (id de la selección para la que el usuario abrió el campo "Otro…"), `customText`.
- Persistir `apiMessages` y `display` en `localStorage` (clave `"buscador-chatbot-v1"`). Hidratar en `useEffect` de montaje.
- Markdown del asistente con `react-markdown` + `remark-gfm`, con clases Tailwind (sin `prose` plugin; estilar a mano: enlaces subrayados azul-grisáceo, listas con margen, negritas).
- Chips: estilo igual al de los radios de `SearchForm` (`rounded-full border px-3 py-1 text-xs`).
- Mensaje de bienvenida fijo (no consume API).

- [ ] **Step 1: Escribir `components/ChatWidget.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatApiResponse, ChatMessage, PendingSelection } from "@/lib/chatbot/types";

const STORAGE_KEY = "buscador-chatbot-v1";

const WELCOME_TEXT =
  "¡Hola! 👋 Soy el asistente del Buscador de Médicos. Dime qué especialista necesitas, de qué mutua y dónde estás (código postal o ciudad) y te busco los **mejor valorados** cerca de ti. Si te falta algún dato te lo iré preguntando.";

type DisplayItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; markdown: string }
  | { kind: "selection"; pending: PendingSelection; answered: boolean }
  | { kind: "error"; text: string };

type Persisted = { apiMessages: ChatMessage[]; display: DisplayItem[] };

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    if (!Array.isArray(p.apiMessages) || !Array.isArray(p.display)) return null;
    return p;
  } catch {
    return null;
  }
}

function initialDisplay(): DisplayItem[] {
  return [{ kind: "assistant", markdown: WELCOME_TEXT }];
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>([]);
  const [display, setDisplay] = useState<DisplayItem[]>(initialDisplay);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [customForId, setCustomForId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  // Hidratar de localStorage al montar.
  useEffect(() => {
    const p = loadPersisted();
    if (p) {
      setApiMessages(p.apiMessages);
      setDisplay(p.display.length ? p.display : initialDisplay());
    }
    hydrated.current = true;
  }, []);

  // Persistir cuando cambie el estado (solo tras hidratar, para no pisar lo guardado).
  useEffect(() => {
    if (!hydrated.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiMessages, display }));
    } catch {
      /* localStorage lleno o no disponible: ignoramos */
    }
  }, [apiMessages, display]);

  // Auto-scroll al fondo cuando hay novedades o se abre.
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [display, loading, open]);

  const send = useCallback(
    async (nextApiMessages: ChatMessage[]) => {
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextApiMessages }),
        });
        const data = (await res.json()) as ChatApiResponse;
        if (!data.ok) {
          setDisplay((d) => [...d, { kind: "error", text: data.error }]);
          return;
        }
        if (data.pendingSelection) {
          // Añadimos el turno crudo del asistente (con el tool_use) a la conversación API.
          const withAssistant: ChatMessage[] = data.assistantContent
            ? [...nextApiMessages, { role: "assistant", content: data.assistantContent }]
            : nextApiMessages;
          setApiMessages(withAssistant);
          setDisplay((d) => [
            ...d,
            ...(data.assistantText ? [{ kind: "assistant", markdown: data.assistantText } as DisplayItem] : []),
            { kind: "selection", pending: data.pendingSelection, answered: false },
          ]);
        } else {
          setApiMessages([...nextApiMessages, { role: "assistant", content: data.assistantText }]);
          setDisplay((d) => [...d, { kind: "assistant", markdown: data.assistantText }]);
        }
      } catch {
        setDisplay((d) => [...d, { kind: "error", text: "No he podido conectar. Revisa tu conexión y prueba otra vez." }]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  function submitText(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setDisplay((d) => [...d, { kind: "user", text }]);
    const next: ChatMessage[] = [...apiMessages, { role: "user", content: text }];
    setApiMessages(next);
    void send(next);
  }

  function chooseOption(pending: PendingSelection, option: { label: string; value: string }) {
    if (loading) return;
    setCustomForId(null);
    setCustomText("");
    // Marca la selección como respondida (los botones desaparecen).
    setDisplay((d) =>
      d.map((it) =>
        it.kind === "selection" && it.pending.toolUseId === pending.toolUseId ? { ...it, answered: true } : it,
      ),
    );
    setDisplay((d) => [...d, { kind: "user", text: option.label }]);
    const next: ChatMessage[] = [
      ...apiMessages,
      { role: "user", content: [{ type: "tool_result", tool_use_id: pending.toolUseId, content: option.value }] },
    ];
    setApiMessages(next);
    void send(next);
  }

  function submitCustom(e: React.FormEvent, pending: PendingSelection) {
    e.preventDefault();
    const text = customText.trim();
    if (!text || loading) return;
    chooseOption(pending, { label: text, value: text });
  }

  function reset() {
    setApiMessages([]);
    setDisplay(initialDisplay());
    setInput("");
    setCustomForId(null);
    setCustomText("");
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
    }
  }

  return (
    <div className="mt-6">
      {/* Cabecera plegable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-left transition-colors hover:border-gray-300"
      >
        <span className="flex items-center gap-2 text-sm text-gray-700">
          <span aria-hidden>💬</span>
          <span>
            ¿Prefieres preguntar? <span className="text-gray-400">Cuéntame qué necesitas y te busco el mejor médico.</span>
          </span>
        </span>
        <svg
          className={`h-3 w-3 flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-gray-200 bg-white overflow-hidden animate-fade-up">
          {/* Mensajes */}
          <div ref={scrollRef} className="max-h-[26rem] overflow-y-auto px-4 py-4 space-y-3">
            {display.map((it, idx) => {
              if (it.kind === "user") {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gray-900 px-3.5 py-2 text-sm text-white">
                      {it.text}
                    </div>
                  </div>
                );
              }
              if (it.kind === "assistant") {
                return (
                  <div key={idx} className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-gray-50 border border-gray-100 px-3.5 py-2.5 text-sm text-gray-800">
                      <div className="chatbot-md space-y-2 leading-relaxed [&_a]:underline [&_a]:text-gray-900 [&_a]:font-medium [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.markdown}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                );
              }
              if (it.kind === "error") {
                return (
                  <div key={idx} className="flex justify-start">
                    <div className="max-w-[90%] rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2 text-xs text-amber-900">
                      {it.text}
                    </div>
                  </div>
                );
              }
              // selection
              return (
                <div key={idx} className="flex justify-start">
                  <div className="max-w-[92%] w-full">
                    <p className="text-sm text-gray-800 mb-2">{it.pending.pregunta}</p>
                    {!it.answered && (
                      <div className="flex flex-wrap gap-1.5">
                        {it.pending.opciones.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            disabled={loading}
                            onClick={() => chooseOption(it.pending, o)}
                            className="px-3 py-1 text-xs rounded-full border bg-white text-gray-600 border-gray-200 hover:border-gray-400 transition-colors disabled:opacity-50"
                          >
                            {o.label}
                          </button>
                        ))}
                        {it.pending.permitePersonalizado &&
                          (customForId === it.pending.toolUseId ? (
                            <form onSubmit={(e) => submitCustom(e, it.pending)} className="flex gap-1.5">
                              <input
                                autoFocus
                                value={customText}
                                onChange={(e) => setCustomText(e.target.value)}
                                placeholder="Escribe…"
                                className="px-3 py-1 text-xs rounded-full border border-gray-300 focus:outline-none focus:border-gray-500 w-32"
                              />
                              <button
                                type="submit"
                                disabled={loading || !customText.trim()}
                                className="px-3 py-1 text-xs rounded-full bg-gray-900 text-white disabled:opacity-50"
                              >
                                Enviar
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                setCustomForId(it.pending.toolUseId);
                                setCustomText("");
                              }}
                              className="px-3 py-1 text-xs rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 transition-colors disabled:opacity-50"
                            >
                              Otro…
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-gray-50 border border-gray-100 px-3.5 py-2 text-sm text-gray-400">
                  Pensando…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={submitText} className="flex items-stretch border-t border-gray-100">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej.: «el mejor dermatólogo de Adeslas en el 28013»"
              className="flex-1 px-4 py-3 text-sm bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none"
              aria-label="Escribe tu mensaje"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors disabled:bg-gray-300"
            >
              Enviar
            </button>
          </form>

          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">
              El asistente no reserva citas: llama al teléfono del centro para pedir cita.
            </p>
            <button type="button" onClick={reset} className="text-[10px] text-gray-400 hover:text-gray-600">
              Reiniciar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila y lint**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: sin errores nuevos. Si TS se queja del tipo del `content` en `{ role: "user", content: [{ type: "tool_result", ... }] }`, asegúrate de que el array literal tiene `type: "tool_result"` como literal (no `string`); si hace falta, importa `Anthropic` y tipa el array como `Anthropic.ToolResultBlockParam[]`.

- [ ] **Step 3: Commit**

```bash
git add components/ChatWidget.tsx
git commit -m "$(cat <<'EOF'
Anade ChatWidget: panel plegable de chat con chips y Markdown

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Montar el widget en la home

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Importar y montar `<ChatWidget />`**

En `app/page.tsx`:
1. Añadir el import junto a los otros, p.ej. tras `import SearchForm from "@/components/SearchForm";`:
```tsx
import ChatWidget from "@/components/ChatWidget";
```
2. Dentro del primer `<section>` (el hero), justo después de `<SearchForm />` y antes del cierre `</div>` que envuelve el hero, añadir:
```tsx
          <SearchForm />
          <ChatWidget />
```
(Es decir, `<ChatWidget />` queda como hermano de `<SearchForm />`, debajo, dentro del mismo `<div className="w-full max-w-2xl mx-auto">`.)

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK. La ruta `/api/chat` aparece como función dinámica. La home compila.

- [ ] **Step 3: Verificación manual end-to-end**

1. Crear `.env.local` con `ANTHROPIC_API_KEY=<una key válida del usuario>` (recordar al usuario que rote la que pegó en el chat).
2. `npm run dev`, abrir `http://localhost:3000`.
3. Comprobar que debajo del buscador aparece la barra "¿Prefieres preguntar?…"; al pulsarla se despliega el panel con el mensaje de bienvenida.
4. Escribir `quiero un cardiólogo` → el asistente debería preguntar por la mutua con botones (chips). Pulsar p.ej. `Adeslas`.
5. Debería preguntar por la ubicación → escribir `28013` (o usar "Otro…").
6. Debería preguntar `¿Cuánto estarías dispuesto a desplazarte…?` con chips `2 km / 10 km / 25 km / 50 km / 100 km / Toda la provincia` y opción "Otro…". Pulsar `10 km`.
7. Debería devolver una respuesta en Markdown con un top de cardiólogos y al final `**[Ver los N resultados completos →](/resultados?...)**`. Pulsar el enlace y comprobar que abre `/resultados` con esos filtros.
8. Recargar la página, abrir el panel: la conversación sigue ahí (localStorage). Pulsar `Reiniciar`: vuelve al mensaje de bienvenida.
9. Probar el camino "ciudad": nueva conversación, `dermatólogo de Sanitas en Valencia` → debería resolver Valencia a un CP y avisar de que ha buscado en la zona.
10. (Opcional) Parar el server, quitar `ANTHROPIC_API_KEY` de `.env.local`, `npm run dev`, mandar un mensaje: debe salir el aviso "El asistente no está disponible…" sin romper la página. Volver a poner la key.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
Monta el ChatWidget en la home, debajo del buscador

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Documentación (CLAUDE.md)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Añadir una sección sobre el chatbot**

En `CLAUDE.md`:
1. En la lista de **Commands**, añadir una línea:
```
- Variable de entorno `ANTHROPIC_API_KEY` (en `.env.local`) — habilita el chatbot de la home (`/api/chat`). Opcional: sin ella, el route responde con error controlado y la web sigue funcionando. Modelo usado: `claude-haiku-4-5`.
```
2. En **Architecture**, añadir una subsección nueva (al nivel de "### Google Maps (centros)") titulada `### Chatbot asistente (home)` con, en español, un resumen de:
   - Widget `components/ChatWidget.tsx` montado en `app/page.tsx` bajo `<SearchForm />`; plegable; conversación persistida en `localStorage`.
   - Route `app/api/chat/route.ts`: bucle agéntico manual sobre `@anthropic-ai/sdk` (Haiku 4.5), `system` cacheado, rate-limit en memoria por IP, tope de longitud de conversación.
   - Tools (`lib/chatbot/tools.ts`): `buscar_medicos` (envuelve `findDoctors`; resuelve ciudad→CP vía `lib/chatbot/city-lookup.ts`; devuelve top 5 + `resultadosUrl`) y `solicitar_seleccion` (pausa el bucle, el cliente pinta chips, la elección vuelve como `tool_result`).
   - `lib/chatbot/system-prompt.ts` + `lib/chatbot/catalog.ts` (espejo de las listas de `SearchForm`).
   - Despliegue: la key vive solo en el servidor; nunca en el bundle de cliente.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
Documenta el chatbot asistente en CLAUDE.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Cierre

- [ ] **Verificación final:** `npm run lint && npm run build` — ambos OK.
- [ ] Recordar al usuario: **revocar y regenerar** la API key que compartió en texto plano; poner la nueva en `.env.local`.
- [ ] (Opcional) Considerar abrir PR de `feat/chatbot-asistente` cuando el usuario lo pida.

## Self-review notes (rellenado por el autor del plan)

- **Cobertura del spec:** widget plegable bajo el buscador ✓ (Task 9); modelo Haiku 4.5 ✓ (Task 7); tools `buscar_medicos` + `solicitar_seleccion` ✓ (Task 5); chips para datos que faltan + "Otro…" ✓ (Task 8); radio con opciones fijas + custom ✓ (system prompt Task 6 + tools Task 5 + UI Task 8); resultado Markdown top 3-5 + enlace a `/resultados` ✓ (system prompt Task 6); ciudad→CP ✓ (Task 4); persistencia localStorage ✓ (Task 8); rate-limit + tope conversación ✓ (Task 7); `.env.example` + key solo server ✓ (Task 1, Task 7); prompt caching ✓ (Task 7); CLAUDE.md ✓ (Task 10).
- **Sin placeholders:** todo el código va literal en los steps.
- **Consistencia de tipos:** `ChatApiResponse`/`PendingSelection`/`ChatMessage` definidos en Task 2 y usados igual en Tasks 5/7/8. `buscarMedicos(input: unknown) -> Promise<string>` consistente entre Task 5 (def) y Task 7 (uso). `assistantContent` solo no-nulo cuando hay `pendingSelection` — coherente entre route (Task 7) y widget (Task 8).
