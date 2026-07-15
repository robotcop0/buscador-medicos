"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Scroll suave con inercia (Lenis) para toda la web.
 *
 * - Se monta una vez en el layout raíz.
 * - Respeta accesibilidad: si el usuario tiene activado "reducir movimiento"
 *   (prefers-reduced-motion), NO se activa y se usa el scroll nativo.
 * - Limpia el rAF loop y destruye la instancia al desmontar.
 *
 * Las clases que Lenis añade a <html> (lenis, lenis-smooth…) se estilan en
 * globals.css.
 */
export default function SmoothScroll() {
  useEffect(() => {
    // No hijackeamos el scroll si el usuario pidió menos movimiento.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.1, // suavidad del deslizamiento
      smoothWheel: true,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
