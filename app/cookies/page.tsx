import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Política de cookies — Buscador de Médicos",
  description:
    "Información sobre el uso de cookies y tecnologías similares en este sitio.",
  alternates: { canonical: `${SITE_URL}/cookies` },
};

export default function CookiesPage() {
  return (
    <main>
      <section className="px-4 sm:px-6 pt-12 sm:pt-16 pb-16">
        <div className="w-full max-w-2xl mx-auto">
          <nav aria-label="Breadcrumb" className="mb-8 text-[11px] text-gray-400">
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            · <span className="text-gray-500">Política de cookies</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Información legal
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">
            Política de cookies
          </h1>
          <p className="text-xs text-gray-400">
            Última actualización: 21 de junio de 2026
          </p>

          <div className="prose prose-sm mt-10 space-y-8 text-gray-700">
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Resumen rápido
              </h2>
              <p className="text-sm leading-relaxed">
                Este sitio utiliza únicamente cookies de{" "}
                <strong>analítica de Google Analytics</strong> para medir de
                forma agregada cómo se usa la web. Estas cookies{" "}
                <strong>
                  no se instalan hasta que las aceptas expresamente
                </strong>{" "}
                en el banner que aparece en tu primera visita. Puedes rechazarlas
                y el sitio seguirá funcionando con normalidad. No utilizamos
                cookies de publicidad ni compartimos datos con fines
                publicitarios.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                1. Qué es una cookie
              </h2>
              <p className="text-sm leading-relaxed">
                Una cookie es un pequeño archivo de texto que un sitio web
                deposita en el navegador del usuario para almacenar
                información, normalmente con fines de identificación,
                personalización o seguimiento.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                2. Cookies que utilizamos
              </h2>
              <p className="text-sm leading-relaxed">
                Solo se instalan tras tu consentimiento. Son cookies de
                analítica de <strong>Google Analytics 4</strong>, propiedad de
                Google Ireland Ltd., que nos ayudan a entender de forma agregada
                qué páginas se visitan y cómo se navega por el sitio:
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="py-2 pr-4 font-medium">Cookie</th>
                      <th className="py-2 pr-4 font-medium">Finalidad</th>
                      <th className="py-2 font-medium">Duración</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-mono">_ga</td>
                      <td className="py-2 pr-4">
                        Distingue usuarios únicos asignando un identificador
                        aleatorio.
                      </td>
                      <td className="py-2">2 años</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-mono">_ga_&lt;id&gt;</td>
                      <td className="py-2 pr-4">
                        Mantiene el estado de la sesión de Google Analytics 4.
                      </td>
                      <td className="py-2">2 años</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm leading-relaxed mt-4">
                Hemos activado la <strong>anonimización de IP</strong> y el modo
                de consentimiento de Google (<em>Consent Mode</em>): mientras no
                aceptas, Google Analytics no escribe ninguna cookie ni almacena
                identificadores en tu navegador.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                3. Base legal y gestión del consentimiento
              </h2>
              <p className="text-sm leading-relaxed">
                Conforme al artículo 22.2 de la Ley 34/2002 (LSSI-CE) y al RGPD,
                las cookies de analítica requieren tu consentimiento previo. Por
                eso se muestra un banner en tu primera visita con las opciones{" "}
                <strong>Aceptar</strong> y <strong>Rechazar</strong>. Tu
                elección se guarda localmente en el navegador para no volver a
                preguntarte.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                Puedes cambiar tu decisión en cualquier momento borrando los
                datos del sitio en tu navegador (lo que volverá a mostrar el
                banner) o configurando el bloqueo de cookies en los ajustes de
                tu navegador.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                4. Servicios externos invocados desde el sitio
              </h2>
              <p className="text-sm leading-relaxed">
                Algunos enlaces y elementos del sitio remiten a servicios
                externos que sí pueden establecer sus propias cookies cuando el
                usuario los visita: páginas de profesionales en Doctoralia,
                fichas en Google Maps y los buscadores oficiales de las
                aseguradoras. Esos servicios se rigen por sus propias políticas
                de cookies y privacidad, sobre las que el operador de este sitio
                no tiene control.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                5. Cambios futuros
              </h2>
              <p className="text-sm leading-relaxed">
                Si en el futuro incorporáramos nuevas cookies o tecnologías de
                seguimiento, esta política se actualizaría con detalle de cada
                cookie, su finalidad, duración y la posibilidad de aceptar o
                rechazar su uso mediante el panel de consentimiento previo.
              </p>
            </section>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
