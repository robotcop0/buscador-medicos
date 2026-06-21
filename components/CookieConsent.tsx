"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredConsent, setStoredConsent } from "@/lib/consent";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/**
 * Banner de consentimiento de cookies de analítica (Google Analytics 4).
 *
 * Solo se monta si hay GA configurado (NEXT_PUBLIC_GA_ID): si no, no hay
 * cookies que consentir y el banner sobra. Aparece únicamente cuando el
 * usuario todavía no ha elegido; la decisión se persiste en localStorage y se
 * propaga a Google Consent Mode (ver lib/consent.ts).
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!GA_ID) return;
    if (getStoredConsent() === null) setVisible(true);
  }, []);

  if (!GA_ID || !visible) return null;

  const decide = (value: "granted" | "denied") => {
    setStoredConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consentimiento de cookies"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-relaxed text-gray-600">
            Usamos cookies de <strong className="text-gray-800">Google
            Analytics</strong> para medir de forma anónima el uso del sitio y
            mejorarlo. No se instalan hasta que las aceptas. Consulta la{" "}
            <Link href="/cookies" className="text-blue-600 hover:underline">
              política de cookies
            </Link>
            .
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => decide("denied")}
              className="rounded-full border border-gray-300 px-4 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => decide("granted")}
              className="rounded-full bg-gray-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-gray-700"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
