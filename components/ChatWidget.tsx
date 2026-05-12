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
            { kind: "selection", pending: data.pendingSelection!, answered: false },
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
          <div ref={scrollRef} className="min-h-[22rem] max-h-[65vh] sm:max-h-[38rem] overflow-y-auto px-4 py-4 space-y-3">
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
