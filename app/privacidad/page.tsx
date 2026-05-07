import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Política de privacidad — Buscador de Médicos",
  description:
    "Política de privacidad del sitio en cumplimiento del RGPD y de la LOPDGDD.",
  alternates: { canonical: `${SITE_URL}/privacidad` },
};

export default function PrivacidadPage() {
  return (
    <main>
      <section className="px-4 sm:px-6 pt-12 sm:pt-16 pb-16">
        <div className="w-full max-w-2xl mx-auto">
          <nav aria-label="Breadcrumb" className="mb-8 text-[11px] text-gray-400">
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            · <span className="text-gray-500">Política de privacidad</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Información legal
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">
            Política de privacidad
          </h1>
          <p className="text-xs text-gray-400">
            Última actualización: 5 de mayo de 2026
          </p>

          <div className="prose prose-sm mt-10 space-y-8 text-gray-700">
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                1. Responsable del tratamiento
              </h2>
              <p className="text-sm leading-relaxed">
                Responsable: [CONFIRMAR — nombre completo o razón social]. NIF /
                CIF: [CONFIRMAR]. Domicilio: [CONFIRMAR]. Correo de contacto:
                [CONFIRMAR — email].
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                2. Principios y datos que tratamos
              </h2>
              <p className="text-sm leading-relaxed">
                Este sitio web está diseñado bajo el principio de minimización
                de datos del Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica
                3/2018 (LOPDGDD). No solicitamos al usuario registro, alta de
                cuenta, dirección de correo electrónico ni ningún otro dato
                identificativo para utilizar la búsqueda.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                El único dato que el usuario introduce voluntariamente es su{" "}
                <strong>código postal</strong>, que se utiliza exclusivamente
                para filtrar los resultados por cercanía geográfica durante la
                sesión y no se almacena de forma persistente, no se asocia a una
                identidad personal y no se cede a terceros.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                3. Analítica de uso (Plausible)
              </h2>
              <p className="text-sm leading-relaxed">
                Para entender el uso agregado del sitio empleamos la herramienta
                de analítica <strong>Plausible Analytics</strong>, diseñada
                específicamente para cumplir con el RGPD sin uso de cookies,
                identificadores persistentes ni datos personales. Plausible
                registra eventos anónimos y agregados (búsquedas iniciadas,
                clics en teléfono, despliegue de reseñas) sin generar perfiles
                de usuario ni rastreo entre sitios.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                Por su naturaleza completamente anónima, el uso de Plausible no
                requiere consentimiento previo del usuario. Más información en{" "}
                <a
                  href="https://plausible.io/data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  plausible.io/data-policy
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                4. Datos técnicos y registros del servidor
              </h2>
              <p className="text-sm leading-relaxed">
                Para proteger el servicio frente a usos abusivos (rate limiting,
                anti-scraping), procesamos de forma transitoria la dirección IP
                del visitante y el agente de usuario (User-Agent), conservados
                únicamente en memoria volátil y descartados automáticamente
                tras un periodo breve. Esta operación tiene como base legítima
                el interés legítimo del responsable en mantener la seguridad y
                disponibilidad del servicio (artículo 6.1.f RGPD).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                5. Datos de profesionales y centros mostrados
              </h2>
              <p className="text-sm leading-relaxed">
                Los datos de profesionales sanitarios y centros médicos
                mostrados en este sitio (nombre, especialidad, dirección,
                teléfono, ratings públicos) se obtienen de fuentes públicas
                accesibles: cuadros médicos oficiales publicados por las propias
                aseguradoras, perfiles públicos en Doctoralia y fichas públicas
                de Google Maps. El tratamiento se limita a la mera mediación
                informativa.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                Cualquier profesional o centro que figure en este sitio puede
                solicitar la rectificación o supresión de su información
                escribiendo al correo de contacto indicado en el aviso legal.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                6. Derechos del interesado
              </h2>
              <p className="text-sm leading-relaxed">
                El usuario puede ejercer en cualquier momento los derechos de
                acceso, rectificación, supresión, oposición, limitación del
                tratamiento y portabilidad reconocidos por el RGPD escribiendo
                al correo de contacto indicado en el aviso legal. Asimismo, le
                asiste el derecho a presentar reclamación ante la Agencia
                Española de Protección de Datos (
                <a
                  href="https://www.aepd.es"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  www.aepd.es
                </a>
                ).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                7. Cambios en esta política
              </h2>
              <p className="text-sm leading-relaxed">
                Esta política puede actualizarse para adaptarse a cambios
                normativos o de funcionamiento del sitio. La fecha de última
                actualización se indica al inicio del documento.
              </p>
            </section>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
