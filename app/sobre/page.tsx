import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Sobre el Buscador de Médicos — metodología y fuentes de datos",
  description:
    "Cómo funciona el Buscador de Médicos: de dónde salen los datos, cómo se cruzan las fuentes, cómo calculamos las valoraciones y por qué el directorio es gratuito.",
  alternates: { canonical: `${SITE_URL}/sobre` },
};

export default function SobrePage() {
  return (
    <main>
      <section className="px-4 sm:px-6 pt-12 sm:pt-16 pb-12">
        <div className="w-full max-w-2xl mx-auto">
          <nav aria-label="Breadcrumb" className="mb-8 text-[11px] text-gray-400">
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            · <span className="text-gray-500">Sobre</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Sobre el proyecto
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
            <span className="font-light">Cómo funciona el </span>
            <span className="font-bold">Buscador de Médicos</span>
            <span className="font-light">.</span>
          </h1>
          <p className="mt-5 text-sm text-gray-600 leading-relaxed">
            El Buscador de Médicos es un proyecto independiente que cruza los
            cuadros médicos públicos de las grandes aseguradoras privadas
            españolas y los enriquece con valoraciones reales de Doctoralia y
            Google Maps. Esta página explica de dónde salen los datos, cómo se
            tratan y por qué el servicio es gratuito y sin registro.
          </p>
        </div>
      </section>

      {/* ── Misión ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Misión
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            Ahorrar tiempo a quien busca un médico de su mutua.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Los buscadores oficiales de las mutuas son lentos, no muestran
            valoraciones y obligan a cambiar de web según la aseguradora.
            Doctoralia tiene profesionales pero no permite filtrar por mutua.
            Resultado: el asegurado pasa media tarde abriendo cinco pestañas y
            haciendo búsquedas en Google sobre cada nombre. Aquí lo resolvemos
            en una sola caja.
          </p>
        </div>
      </section>

      {/* ── Fuentes de datos ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Fuentes de datos
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            Solo información <span className="font-bold">públicamente accesible</span>.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            Todos los datos provienen de fuentes que cualquiera puede consultar
            libremente. No se recopilan datos privados ni se comparten
            contenidos protegidos.
          </p>

          <ol className="space-y-5">
            {[
              {
                t: "Cuadros médicos oficiales de las mutuas",
                d: "Cada aseguradora publica en su web oficial un buscador del cuadro médico. Recogemos esos listados (nombre, especialidad, dirección, teléfono y código postal) bien indexándolos periódicamente, bien consultándolos en directo cada vez que el usuario busca.",
              },
              {
                t: "Doctoralia (profesionales individuales)",
                d: "Las valoraciones medias y reseñas verificadas de cada profesional vienen de Doctoralia, que es la base más completa de opiniones reales sobre médicos en España.",
              },
              {
                t: "Google Maps (clínicas, hospitales y centros)",
                d: "Para los centros médicos (clínicas, policlínicos, hospitales y ambulatorios) usamos las valoraciones públicas de Google Maps, donde reseñan tanto pacientes como visitantes.",
              },
              {
                t: "Códigos postales y geolocalización",
                d: "El radio en kilómetros se calcula con la fórmula de Haversine sobre los centroides oficiales de los códigos postales españoles, recopilados de fuente abierta.",
              },
            ].map(({ t, d }, i) => (
              <li key={t} className="flex gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-medium tabular-nums flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t}</h3>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Cómo se calcula el rating ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Cálculo del rating
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            Una <span className="font-bold">media ponderada</span>, no inventada.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Cuando un mismo profesional o centro tiene puntuación en Doctoralia
            y en Google Maps, calculamos la media ponderada por número de
            reseñas. Es decir, una valoración respaldada por mil reseñas pesa
            mucho más que una con dos.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Si solo hay rating en una de las dos fuentes, mostramos esa.
            Cuando no hay valoraciones, lo indicamos claramente con la etiqueta
            “Sin valoraciones”. El número de reseñas siempre es visible para
            que el usuario juzgue por sí mismo la representatividad.
          </p>
        </div>
      </section>

      {/* ── Modelo de negocio ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Modelo
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            Gratis y sin <span className="font-bold">cobrar a los listados</span>.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            El uso del buscador es gratuito. No cobramos a profesionales ni a
            centros por aparecer mejor posicionados: el orden de los resultados
            se determina exclusivamente por la valoración real (rating
            ponderado y número de reseñas) y por la cercanía al código postal
            del usuario.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            En el futuro podríamos ofrecer perfiles destacados de pago para
            profesionales y clínicas, pero estarían claramente etiquetados como
            tales y no alterarían el orden orgánico de los resultados.
          </p>
        </div>
      </section>

      {/* ── Limitaciones ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Limitaciones
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            Lo que <span className="font-bold">no hacemos</span>.
          </h2>
          <ul className="text-sm text-gray-600 leading-relaxed space-y-2 list-disc pl-5">
            <li>
              No reservamos cita: te facilitamos el teléfono directo y la cita
              la concretas tú llamando al centro.
            </li>
            <li>
              No prestamos asesoramiento médico ni sanitario. La elección de un
              profesional concreto es decisión exclusiva del usuario.
            </li>
            <li>
              No mantenemos relación contractual con las aseguradoras,
              profesionales o centros listados. La información se obtiene de
              fuentes públicas.
            </li>
            <li>
              Los datos pueden quedar parcialmente desactualizados entre
              actualizaciones de las fuentes; verifica siempre con la
              aseguradora antes de pedir cita.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Contacto ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Contacto
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            Erratas, sugerencias o solicitudes de retirada.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Si eres profesional o centro y deseas corregir o retirar tu
            información, o si detectas un error en los datos, escríbenos al
            correo indicado en el{" "}
            <Link href="/aviso-legal" className="text-blue-600 hover:underline">
              aviso legal
            </Link>
            .
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
