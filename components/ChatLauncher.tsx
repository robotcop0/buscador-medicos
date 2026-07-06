"use client";

import { useEffect, useRef, useState } from "react";
import ChatWidget from "./ChatWidget";

export default function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar con Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // El foco vuelve al FAB tras el re-render (botón vuelve a ser visible)
        requestAnimationFrame(() => fabRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Al abrir, mover foco al input del chat
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const input = panelRef.current?.querySelector<HTMLInputElement>(
        'input[aria-label="Escribe tu mensaje"]'
      );
      input?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  }

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente"
        aria-expanded={open}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gray-900 text-white shadow-lg flex items-center justify-center transition-all hover:bg-gray-800 hover:-translate-y-0.5 ${
          open ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.84L3 20l1.05-3.5A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Asistente"
          className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col
                     bottom-20 right-4 w-[calc(100vw-2rem)] h-[calc(100vh-6rem)]
                     sm:bottom-24 sm:right-6 sm:w-[400px] sm:h-[600px]
                     sm:max-w-[calc(100vw-3rem)] sm:max-h-[calc(100vh-8rem)]"
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Asistente</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar asistente"
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-hidden p-3">
            <ChatWidget variant="panel" />
          </div>
        </div>
      )}
    </>
  );
}
