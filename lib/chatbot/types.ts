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
