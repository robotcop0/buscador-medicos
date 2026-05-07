import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
            Última actualización: 5 de mayo de 2026
          </p>

          <div className="prose prose-sm mt-10 space-y-8 text-gray-700">
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Resumen rápido
              </h2>
              <p className="text-sm leading-relaxed">
                <strong>Este sitio no utiliza cookies.</strong> No almacenamos
                identificadores en el navegador del usuario, no rastreamos
                sesiones entre sitios y no utilizamos servicios publicitarios.
                Por este motivo, no se muestra el banner de consentimiento
                habitual: no hay nada que aceptar o rechazar.
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
                2. Por qué este sitio no necesita cookies
              </h2>
              <p className="text-sm leading-relaxed">
                Hemos diseñado deliberadamente el sitio para minimizar la
                recogida de datos. No requerimos registro de usuario, no
                personalizamos contenido en función de visitas previas y la
                analítica que utilizamos (
                <a
                  href="https://plausible.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Plausible Analytics
                </a>
                ) registra únicamente eventos agregados y anónimos sin emplear
                cookies, identificadores persistentes ni huellas digitales del
                navegador.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                En consecuencia, el uso de este sitio no implica el almacenamiento
                de información en el equipo del usuario distinta de la
                estrictamente necesaria para que el navegador renderice la
                página, exenta de consentimiento conforme al artículo 22.2 de
                la Ley 34/2002 (LSSI-CE).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                3. Servicios externos invocados desde el sitio
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
                4. Cambios futuros
              </h2>
              <p className="text-sm leading-relaxed">
                Si en el futuro incorporáramos servicios que sí requieran
                cookies o tecnologías de seguimiento, esta política se
                actualizaría con detalle de cada cookie, su finalidad, duración
                y la posibilidad de aceptar o rechazar su uso mediante un panel
                de consentimiento previo.
              </p>
            </section>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
