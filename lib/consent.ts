// Consentimiento de cookies de analítica (RGPD / LSSI).
//
// Google Analytics 4 escribe cookies de primera parte (_ga, _ga_*) para medir
// visitantes. Bajo el RGPD/AEPD no se pueden instalar cookies de analítica
// hasta que el usuario las acepta. Implementamos Consent Mode v2 de Google:
// el estado por defecto es "denied" (GA carga pero NO escribe cookies, solo
// envía pings sin identificador) y el banner lo cambia a "granted" al aceptar.
//
// La elección se persiste en localStorage para no volver a preguntar.

export const CONSENT_KEY = "cookie-consent-v1";

export type ConsentValue = "granted" | "denied";

/** Lee la elección guardada, o null si el usuario aún no ha decidido. */
export function getStoredConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Guarda la elección y la propaga a Google Consent Mode en caliente, de modo
 * que GA empiece (o deje) de usar cookies sin recargar la página.
 */
export function setStoredConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage puede no estar disponible (modo privado, etc.). El banner
    // seguirá apareciendo en la siguiente visita, lo cual es aceptable.
  }
  window.gtag?.("consent", "update", {
    analytics_storage: value,
  });
}
