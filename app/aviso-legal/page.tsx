import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Aviso legal — Buscador de Médicos",
  description:
    "Información legal del titular del sitio en cumplimiento de la LSSI 34/2002.",
  alternates: { canonical: `${SITE_URL}/aviso-legal` },
};

export default function AvisoLegalPage() {
  return (
    <main>
      <section className="px-4 sm:px-6 pt-12 sm:pt-16 pb-16">
        <div className="w-full max-w-2xl mx-auto">
          <nav aria-label="Breadcrumb" className="mb-8 text-[11px] text-gray-400">
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            · <span className="text-gray-500">Aviso legal</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Información legal
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">
            Aviso legal
          </h1>
          <p className="text-xs text-gray-400">
            Última actualización: 5 de mayo de 2026
          </p>

          <div className="prose prose-sm mt-10 space-y-8 text-gray-700">
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                1. Identificación del titular
              </h2>
              <p className="text-sm leading-relaxed">
                En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de
                julio, de Servicios de la Sociedad de la Información y Comercio
                Electrónico (LSSI-CE), se informa de los datos identificativos
                del titular del presente sitio web:
              </p>
              <ul className="mt-3 text-sm leading-relaxed space-y-1">
                <li>
                  <strong>Titular:</strong> [CONFIRMAR — nombre completo o razón
                  social]
                </li>
                <li>
                  <strong>NIF / CIF:</strong> [CONFIRMAR]
                </li>
                <li>
                  <strong>Domicilio:</strong> [CONFIRMAR — domicilio fiscal o
                  postal]
                </li>
                <li>
                  <strong>Correo electrónico de contacto:</strong>{" "}
                  [CONFIRMAR — email]
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                2. Objeto del sitio web
              </h2>
              <p className="text-sm leading-relaxed">
                Este sitio web es un buscador independiente que agrega
                información públicamente accesible procedente de los cuadros
                médicos oficiales de aseguradoras privadas españolas, así como
                valoraciones públicas de Doctoralia y Google Maps. La finalidad
                es facilitar al usuario la localización de profesionales y
                centros sanitarios cubiertos por su mutua, sin coste, sin
                registro y sin recogida de datos personales identificativos del
                visitante.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                Este sitio no presta servicios sanitarios, no gestiona citas
                médicas y no mantiene relación contractual ni comercial con las
                aseguradoras, profesionales o centros listados.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                3. Propiedad intelectual e industrial
              </h2>
              <p className="text-sm leading-relaxed">
                El diseño, código fuente, logotipos y textos originales del
                sitio son titularidad del operador del sitio o se utilizan con
                la correspondiente autorización. Queda prohibida su reproducción
                total o parcial sin autorización previa por escrito.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                Las marcas, denominaciones comerciales y logotipos de
                aseguradoras y centros médicos pertenecen a sus respectivos
                titulares y se mencionan exclusivamente con fines descriptivos e
                informativos al amparo del artículo 37 de la Ley 17/2001 de
                Marcas.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                4. Exención de responsabilidad
              </h2>
              <p className="text-sm leading-relaxed">
                La información disponible en este sitio se obtiene
                automáticamente de fuentes públicas y se actualiza
                periódicamente. El operador no garantiza la exactitud,
                actualidad ni completitud de los datos en todo momento, y
                recomienda al usuario verificar la información directamente con
                la aseguradora o el centro antes de adoptar cualquier decisión
                relacionada con su salud.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                Las valoraciones mostradas son medias agregadas de fuentes
                terceras (Doctoralia, Google Maps) y reflejan opiniones de
                terceros usuarios; no constituyen una recomendación del
                operador.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                5. Enlaces a sitios de terceros
              </h2>
              <p className="text-sm leading-relaxed">
                Este sitio puede incluir enlaces a sitios web de terceros
                (Doctoralia, Google Maps, sitios oficiales de aseguradoras). El
                operador no asume responsabilidad alguna sobre el contenido,
                políticas de privacidad o prácticas de dichos sitios.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                6. Legislación aplicable y jurisdicción
              </h2>
              <p className="text-sm leading-relaxed">
                Las presentes condiciones se rigen por la legislación española.
                Para cualquier controversia derivada del uso de este sitio web,
                las partes se someten a los Juzgados y Tribunales del domicilio
                del titular, salvo cuando la legislación aplicable disponga otra
                cosa.
              </p>
            </section>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
