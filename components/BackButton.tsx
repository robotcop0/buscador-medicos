"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Enlace de "Volver" inline en la parte superior de cada página (alineado con el
 * contenedor del contenido, `max-w-4xl`). Oculto en la home (`/`).
 *
 * Si hay historial dentro de la pestaña usa `router.back()`; si el usuario llegó
 * directo a la página (sin historial previo), cae a `/`. En ambos casos, al llegar
 * al destino, fuerza scroll arriba del todo (el navegador por defecto restauraría
 * la posición de scroll que tuviera esa página antes — no es lo que queremos aquí).
 */
export default function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const justClicked = useRef(false);

  // Cuando cambia la ruta tras pulsar "Volver", llevamos la página al inicio.
  useEffect(() => {
    if (justClicked.current) {
      window.scrollTo({ top: 0, left: 0 });
      justClicked.current = false;
    }
  }, [pathname]);

  if (pathname === "/") return null;

  function handleClick() {
    justClicked.current = true;
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6">
      <button
        type="button"
        onClick={handleClick}
        aria-label="Volver"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span>Volver</span>
      </button>
    </div>
  );
}
