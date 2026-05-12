"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatApiResponse, ChatMessage, PendingSelection } from "@/lib/chatbot/types";

const STORAGE_KEY = "buscador-chatbot-v1";

const WELCOME_TEXT =
  "¡Hola! 👋 Soy el asistente del Buscador de Médicos. Dime qué especialista necesitas, de qué mutua y dónde estás (código postal o ciudad) y te busco los **mejor valorados** cerca de ti. Si te falta algún dato te lo iré preguntando.";

const SUGGESTIONS = [
  "El mejor cardiólogo de Adeslas en el 28001",
  "Dermatólogo de Sanitas en Valencia",
  "Pediatra de DKV cerca de Sevilla",
  "Traumatólogo de Adeslas en Barcelona",
];

const PLACEHOLDER_FALLBACK = "Escribe lo que necesitas";

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

function Avatar() {
  return (
    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-black/[0.05] flex items-center justify-center text-sm" aria-hidden>
      🩺
    </div>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
      />
    </svg>
  );
}

const CHIP_CLASS =
  "px-3.5 py-1.5 text-xs rounded-full border border-gray-300 text-gray-600 bg-transparent hover:bg-black/[0.04] hover:text-gray-900 transition-colors disabled:opacity-50";

export default function ChatWidget() {
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>([]);
  const [display, setDisplay] = useState<DisplayItem[]>(initialDisplay);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [customForId, setCustomForId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_FALLBACK);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  // Placeholder "máquina de escribir": cicla por SUGGESTIONS escribiéndolas y borrándolas,
  // mientras el input no esté enfocado y la conversación esté vacía. Al enfocar para, al
  // desenfocar vuelve a arrancar.
  const typewriterActive = !inputFocused && display.length <= 1;
  useEffect(() => {
    if (!typewriterActive) {
      setPlaceholder(PLACEHOLDER_FALLBACK);
      return;
    }
    let phraseIdx = 0;
    let charIdx = 0;
    let phase: "typing" | "pausing" | "deleting" = "typing";
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const phrase = SUGGESTIONS[phraseIdx % SUGGESTIONS.length];
      if (phase === "typing") {
        charIdx += 1;
        setPlaceholder(phrase.slice(0, charIdx));
        if (charIdx >= phrase.length) {
          phase = "pausing";
          timer = setTimeout(tick, 1700);
          return;
        }
        timer = setTimeout(tick, 45);
      } else if (phase === "pausing") {
        phase = "deleting";
        timer = setTimeout(tick, 30);
      } else {
        charIdx -= 1;
        setPlaceholder(phrase.slice(0, Math.max(0, charIdx)));
        if (charIdx <= 0) {
          phraseIdx += 1;
          phase = "typing";
          timer = setTimeout(tick, 450);
          return;
        }
        timer = setTimeout(tick, 22);
      }
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [typewriterActive]);

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

  // Auto-scroll al fondo cuando hay novedades.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [display, loading]);

  const send = useCallback(async (nextApiMessages: ChatMessage[]) => {
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
  }, []);

  function sendUserText(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    setInput("");
    setDisplay((d) => [...d, { kind: "user", text }]);
    const next: ChatMessage[] = [...apiMessages, { role: "user", content: text }];
    setApiMessages(next);
    void send(next);
  }

  function submitText(e: React.FormEvent) {
    e.preventDefault();
    sendUserText(input);
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

  return (
    <div>
      {/* Mensajes — sin caja: fluyen sobre el fondo de la página */}
      <div ref={scrollRef} className="min-h-[34rem] max-h-[82vh] sm:max-h-[54rem] overflow-y-auto pr-1 space-y-5">
        {display.map((it, idx) => {
          if (it.kind === "user") {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gray-900 px-4 py-2.5 text-sm text-white">
                  {it.text}
                </div>
              </div>
            );
          }
          if (it.kind === "assistant") {
            return (
              <div key={idx} className="flex justify-start gap-3">
                <Avatar />
                <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-black/[0.03] px-4 py-3 text-sm text-gray-700">
                  <div className="chatbot-md space-y-2 leading-relaxed [&_a]:underline [&_a]:text-gray-900 [&_a]:font-medium [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-gray-900">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.markdown}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          }
          if (it.kind === "error") {
            return (
              <div key={idx} className="flex justify-start gap-3">
                <Avatar />
                <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-amber-50/70 px-4 py-2.5 text-xs text-amber-800">
                  {it.text}
                </div>
              </div>
            );
          }
          // selection
          return (
            <div key={idx} className="flex justify-start gap-3">
              <Avatar />
              <div className="max-w-[88%] w-full">
                <p className="text-sm text-gray-700 mb-2.5">{it.pending.pregunta}</p>
                {!it.answered && (
                  <div className="flex flex-wrap gap-1.5">
                    {it.pending.opciones.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        disabled={loading}
                        onClick={() => chooseOption(it.pending, o)}
                        className={CHIP_CLASS}
                      >
                        {o.label}
                      </button>
                    ))}
                    {it.pending.permitePersonalizado &&
                      (customForId === it.pending.toolUseId ? (
                        <form onSubmit={(e) => submitCustom(e, it.pending)} className="flex items-center gap-1.5 rounded-full border border-gray-300 pl-3.5 pr-1 py-1">
                          <input
                            autoFocus
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="Escribe…"
                            className="text-xs bg-transparent focus:outline-none w-32"
                          />
                          <button
                            type="submit"
                            disabled={loading || !customText.trim()}
                            aria-label="Enviar"
                            className="flex-shrink-0 h-6 w-6 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-700 transition-colors disabled:bg-gray-300"
                          >
                            <SendIcon className="h-3 w-3" />
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
                          className="px-3.5 py-1.5 text-xs rounded-full border border-dashed border-gray-300 text-gray-500 bg-transparent hover:bg-black/[0.04] transition-colors disabled:opacity-50"
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
          <div className="flex justify-start gap-3">
            <Avatar />
            <span className="flex gap-1 items-center pt-3" aria-label="Pensando">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
            </span>
          </div>
        )}
      </div>

      {/* Input — píldora flotante sobre el fondo de la página */}
      <form
        onSubmit={submitText}
        className="mt-5 flex items-center gap-2 rounded-full border border-gray-300 bg-transparent pl-5 pr-1.5 py-1.5 transition-colors focus-within:border-gray-500"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder={placeholder}
          className="flex-1 min-w-0 py-2 text-sm bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none"
          aria-label="Escribe tu mensaje"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          className="flex-shrink-0 h-9 w-9 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-700 transition-colors disabled:bg-gray-300"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
