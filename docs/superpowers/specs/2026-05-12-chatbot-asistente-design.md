# Chatbot asistente de búsqueda de médicos — diseño

Fecha: 2026-05-12
Estado: aprobado (pendiente de plan de implementación)

## Objetivo

Una "ventanita" de chat en la página principal, debajo del buscador, conectada a Claude
(modelo Haiku 4.5) con un sistema de *tools* que envuelve la búsqueda existente
(`findDoctors`). El usuario puede preguntar en lenguaje natural ("¿cuál es el mejor
cardiólogo de Adeslas cerca de mí?"). El bot:

- Filtra por **mutua** (cuadro médico), **especialidad** (ámbito del médico), **código
  postal** y/o **ciudad**, y **radio de desplazamiento** en km.
- Si al usuario le falta algún dato, lo **pide de uno en uno** con **chips clicables**
  (botones rápidos) dentro del chat; para el radio siempre ofrece opciones predefinidas
  más la posibilidad de escribir un valor a medida.
- Devuelve la respuesta en **Markdown bonito**: un top 3–5 de médicos/centros con su
  valoración real y distancia, una breve justificación, y un enlace
  **"Ver los N resultados completos →"** a `/resultados` con los filtros ya aplicados.
- Nunca inventa médicos ni valoraciones: solo usa lo que devuelven las tools.
- Deja claro que no reserva citas (hay que llamar al teléfono mostrado).

## Decisiones de diseño

### Enfoque elegido

Loop agéntico **en el servidor**, **sin streaming token a token**. `/api/chat` ejecuta
el bucle completo de tool-use de Claude y devuelve el turno final (texto Markdown +
opcionalmente una "pregunta con opciones" pendiente). El widget cliente es fino.

Descartados: streaming SSE (mucho más código, beneficio marginal con Haiku — YAGNI v1),
y Vercel AI SDK (dependencia gorda nueva, mal encaje con los "chips que reanudan una
tool"; el proyecto ya trae `@anthropic-ai/sdk`).

### Modelo

`claude-haiku-4-5`, en una constante `CHATBOT_MODEL` (subir a Sonnet en una línea si hace
falta).

### Preferencias resueltas

- El widget arranca **plegado** en la home (encabezado clicable que lo despliega).
- La conversación se persiste en **`localStorage`** para no perderla al refrescar.

## Componentes y ficheros

### Nuevos

- `lib/chatbot/types.ts` — tipos compartidos: `ChatMessage` (rol + bloques de
  contenido compatibles con la API de mensajes de Anthropic), `PendingSelection`
  (`{ toolUseId, pregunta, campo, opciones: {label,value}[], permitePersonalizado }`),
  `ChatApiResponse` (`{ assistantText, pendingSelection? }`).
- `lib/chatbot/system-prompt.ts` — el system prompt en español + catálogos embebidos
  (las 15 mutuas y las 33 especialidades, copiadas de `lib/slugs.ts` / `SearchForm`).
  Exporta también las listas para reutilizarlas en las tools.
- `lib/chatbot/tools.ts` — definición JSON-schema de las 2 tools y sus ejecutores
  (`buscarMedicos`, `solicitarSeleccion`).
- `lib/chatbot/city-lookup.ts` — mapa `ciudad → CP` construido una vez desde
  `data/doctors.json` (para cada ciudad, el CP más frecuente). Usado cuando el usuario
  da ciudad pero no CP.
- `app/api/chat/route.ts` — route handler `POST`.
- `components/ChatWidget.tsx` — client component.
- `.env.example` — `ANTHROPIC_API_KEY=`.

### Modificados

- `app/page.tsx` — montar `<ChatWidget />` debajo de `<SearchForm />` en el hero.
- `package.json` — añadir `react-markdown` y `remark-gfm`.
- `CLAUDE.md` — documentar el chatbot (sección nueva + comando/env).

## Tools expuestas a Claude

### `buscar_medicos`

Parámetros:

- `mutua` — string, enum con las 15 mutuas disponibles. Requerido.
- `especialidad` — string. Requerido. Se hace match parcial sin acentos (como ya hace
  `filterDoctors`), así "Cardiología" casa con "Cardiología Infantil".
- `cp` — string de 5 dígitos. Opcional.
- `ciudad` — string. Opcional.
- `radio_km` — number. Opcional.

Comportamiento del ejecutor:

1. Si llega `cp`: `findDoctors(mutua, especialidad, cp, radio_km)`.
2. Si llega `ciudad` sin `cp`: `cityLookup(ciudad)` → CP representativo →
   `findDoctors(mutua, especialidad, cpResuelto)` sin radio (match a nivel provincia).
   Si la ciudad no se encuentra, devuelve un resultado que indica el problema para que
   Claude pida un CP.
3. Si no hay ni `cp` ni `ciudad`: devuelve un resultado vacío con una nota; Claude debe
   pedir ubicación antes de llamar a esta tool (regla en el system prompt).

Devuelve (como `tool_result`, JSON serializado):

```
{
  totalFound: number,
  top: Array<{
    nombre, especialidad, direccion, ciudad, cp,
    rating: number, numReviews: number,
    distanceKm: number | null, telefono?: string,
    mutuas: string[]
  }>,            // máx 5, ya ordenados por el ranking bayesiano existente
  resultadosUrl: string   // "/resultados?mutua=…&especialidad=…&cp=…&radio=…"
}
```

### `solicitar_seleccion`

Parámetros: `{ pregunta: string, campo: string, opciones: Array<{label: string, value: string}>, permite_personalizado: boolean }`.

Mecánica: es una tool cuyo "resultado" es la elección del usuario.

1. Claude la invoca cuando le falta un dato.
2. El route, al detectar este `tool_use`, **pausa el bucle** y devuelve al cliente
   `pendingSelection` (con el `toolUseId`).
3. El widget pinta `pregunta` + los chips de `opciones`; si `permite_personalizado`,
   añade un chip "Otro…" que abre un input libre.
4. Cuando el usuario elige (chip o texto), el cliente reenvía la conversación completa,
   añadiendo el bloque `tool_result` correspondiente a ese `toolUseId` con el valor
   elegido como texto.
5. El route reanuda el bucle; Claude continúa (puede volver a preguntar otra cosa o ya
   llamar a `buscar_medicos`).

El mismo mecanismo cubre mutua, especialidad, CP/ciudad y radio.

## System prompt (resumen del contenido)

- Persona: asistente del *Buscador de Médicos*. Tono cercano, conciso, en español.
- Catálogos embebidos: las 15 mutuas (Adeslas, Allianz, Asisa, AXA Salud, Caser Salud,
  Cigna, DKV, Divina Pastora, Fiatc, Generali, IMQ, Mapfre, MUFACE, Occidente, Sanitas)
  y las 33 especialidades.
- **Regla dura**: no llamar a `buscar_medicos` hasta tener `mutua` + `especialidad` +
  (`cp` **o** `ciudad`). Si falta algo, pedirlo **de uno en uno** con
  `solicitar_seleccion`.
- Para mutua/especialidad: ofrecer las opciones del catálogo como chips (si el usuario
  ha escrito algo aproximado, ofrecer las coincidencias más probables + "Otro…").
- Para ubicación: pedir CP o ciudad.
- Para el radio: **siempre** ofrecer chips `[2 km, 10 km, 25 km, 50 km, 100 km, "Toda la
  provincia"]` con `permite_personalizado: true`. Pregunta tipo *"¿Cuánto estarías
  dispuesto a desplazarte por un buen médico?"*. "Toda la provincia" → no pasar
  `radio_km`.
- Nunca inventar médicos ni ratings; usar solo lo que devuelva `buscar_medicos`.
- Respuesta final en Markdown: top 3–5 con **nombre en negrita**, línea
  `especialidad · centro · ciudad`, `⭐ rating (n reseñas)`, distancia si la hay,
  teléfono si lo hay; un párrafo breve de "por qué te recomiendo estos"; y al final
  `**[Ver los N resultados completos →](resultadosUrl)**`.
- Si `buscar_medicos` vuelve vacío: decirlo y sugerir ampliar radio o cambiar
  especialidad/mutua.
- Disclaimer: no reserva citas; concretar llamando al teléfono mostrado.

## Route handler `/api/chat`

- `POST` con `{ messages: ChatMessage[] }` (el historial lo mantiene el cliente).
- Cliente Anthropic con `process.env.ANTHROPIC_API_KEY` (en `.env.local`; **nunca** en
  cliente).
- Bloque `system` con `cache_control: { type: "ephemeral" }` (catálogos estáticos →
  prompt caching).
- Bucle agéntico: mientras la respuesta tenga `stop_reason === "tool_use"`, ejecutar las
  tools, añadir `tool_result`, volver a llamar. Máximo ~5 iteraciones de tool por turno
  (si se excede, cortar con un mensaje de error amable).
- Si aparece un `tool_use` de `solicitar_seleccion`: parar y devolver `pendingSelection`.
- **Control de abuso** (sitio público):
  - Rate-limit en memoria por IP: ~20 mensajes / 10 min.
  - Tope de longitud de conversación: ~12 turnos (si se supera, pedir reiniciar).
  - `max_tokens` acotado (p.ej. 1500).
- Respuesta: `{ assistantText, pendingSelection? }` (o `{ error }` con status apropiado).

## Cliente `ChatWidget.tsx`

- Estado: `messages` (array de `ChatMessage`), `input`, `loading`, `pendingSelection`.
- Persistencia en `localStorage` (clave dedicada); botón "Reiniciar conversación".
- Plegado por defecto: encabezado clicable *"¿Prefieres preguntar? Cuéntame qué necesitas
  y te busco el mejor médico"* → despliega el panel.
- Render del Markdown del asistente con `react-markdown` + `remark-gfm`, estilado con
  clases Tailwind coherentes con el sitio (grises, sin colorines fuertes; enlaces
  subrayados).
- `pendingSelection` → pinta la `pregunta` + chips (`rounded-full`, estilo igual a los
  del `SearchForm`); "Otro…" abre un input inline.
- Al enviar (texto o chip): POST a `/api/chat`; mientras tanto, indicador "pensando…".
- Errores de red / rate-limit: mensaje en una burbuja de sistema, no romper el widget.
- Mensaje de bienvenida inicial fijo del asistente (no consume API): explica qué puede
  hacer.

## Seguridad / operativa

- **La API key compartida en texto plano en el chat de desarrollo debe revocarse y
  regenerarse.** La nueva va en `.env.local` (ya en `.gitignore`); se añade `.env.example`
  como plantilla. La key nunca llega al bundle de cliente (solo se usa en el route
  handler del servidor).
- El chatbot es opcional para el funcionamiento del sitio: si `ANTHROPIC_API_KEY` no está
  definida, el route devuelve un error controlado y el widget muestra "asistente no
  disponible" (el buscador clásico sigue funcionando).

## Fuera de alcance (v1)

Streaming token a token; persistencia server-side de conversaciones; autenticación;
reservas de cita; tarjetas de médico interactivas dentro del chat; entrada por voz;
herramientas extra (`listar_mutuas`, etc. — los catálogos van en el system prompt).
