import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SearchForm from "@/components/SearchForm";
import { ESPECIALIDADES, MUTUAS, findEspecialidadBySlug } from "@/lib/slugs";
import { getEspecialidadStats } from "@/lib/programmatic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Params = { especialidad: string };

export function generateStaticParams(): Params[] {
  return ESPECIALIDADES.map((e) => ({ especialidad: e.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const e = findEspecialidadBySlug(params.especialidad);
  if (!e) return {};
  const title = `${e.nombre} por mutua — encuentra tu especialista`;
  const description = `Directorio de especialistas en ${e.nombre} cubiertos por las grandes mutuas privadas españolas. Búsqueda por código postal con valoraciones reales y teléfono directo.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/medicos/${e.slug}` },
    openGraph: { title, description, type: "website", locale: "es_ES" },
  };
}

export default async function EspecialidadPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { especialidad: slug } = await params;
  const esp = findEspecialidadBySlug(slug);
  if (!esp) notFound();

  const stats = getEspecialidadStats(esp.nombre);

  const faq = [
    {
      q: `¿Mi mutua cubre ${esp.nombre.toLowerCase()}?`,
      a: `${esp.nombre} es una especialidad incluida en el cuadro médico de las grandes aseguradoras privadas en España. Selecciona tu mutua arriba y verás los profesionales y centros concretos que la cubren cerca de ti.`,
    },
    {
      q: `¿Cómo encuentro un buen especialista en ${esp.nombre.toLowerCase()}?`,
      a: `Aquí ordenamos a los profesionales por valoración real (Doctoralia para médicos individuales, Google Maps para clínicas y hospitales) y por cercanía a tu código postal. La mejor referencia suele ser la combinación de número de reseñas alto y rating consistente.`,
    },
    {
      q: `¿Las valoraciones de los médicos son reales?`,
      a: "Sí. Vienen de Doctoralia (profesionales individuales) y Google Maps (clínicas, hospitales y policlínicos). Cuando un centro tiene rating en ambas fuentes calculamos la media ponderada por número de reseñas.",
    },
    {
      q: `¿Necesito volante o derivación para ir al ${esp.nombre.toLowerCase()}?`,
      a: "Depende de cada mutua. Algunas requieren autorización previa o derivación de medicina general; otras permiten acceso directo. Consulta tu póliza o llama al centro antes de pedir cita.",
    },
    {
      q: `¿Puedo reservar cita desde aquí?`,
      a: "No. Te facilitamos los datos de contacto (especialidad, dirección, rating y teléfono directo) y la cita la concretas tú llamando al centro.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: esp.nombre,
            item: `${SITE_URL}/medicos/${esp.slug}`,
          },
        ],
      },
      {
        "@type": "MedicalSpecialty",
        name: esp.nombre,
        url: `${SITE_URL}/medicos/${esp.slug}`,
        description: esp.intro,
      },
      {
        "@type": "WebPage",
        url: `${SITE_URL}/medicos/${esp.slug}`,
        name: `${esp.nombre} por mutua`,
        description: esp.intro,
        inLanguage: "es-ES",
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Header ── */}
      <section className="px-4 sm:px-6 pt-12 sm:pt-16 pb-10">
        <div className="w-full max-w-2xl mx-auto">
          <nav aria-label="Breadcrumb" className="mb-8 text-[11px] text-gray-400">
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            · <span className="text-gray-500">{esp.nombre}</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Especialidad
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
            <span className="font-light">Especialistas en </span>
            <span className="font-bold">{esp.nombre}</span>
            <span className="font-light"> por mutua.</span>
          </h1>
          <p className="mt-4 text-sm text-gray-600 leading-relaxed">{esp.intro}</p>

          {stats.total > 0 && (
            <dl className="mt-8 grid grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <dt className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                  {stats.total.toLocaleString("es-ES")}
                </dt>
                <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                  profesionales y centros indexados
                </dd>
              </div>
              <div>
                <dt className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                  {stats.provinciasCubiertas}
                </dt>
                <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                  provincias con cobertura
                </dd>
              </div>
              <div>
                <dt className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                  15
                </dt>
                <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                  mutuas que la cubren
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {/* ── Buscador embebido ── */}
      <section className="px-4 sm:px-6 py-10 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Buscar {esp.nombre.toLowerCase()}
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-6">
            Encuentra tu especialista en{" "}
            <span className="font-bold">{esp.nombre}</span>.
          </h2>
          <SearchForm initialEspecialidad={esp.nombre} />
        </div>
      </section>

      {/* ── Top ciudades (solo si hay datos) ── */}
      {stats.topCiudades.length > 0 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              Ciudades con mayor presencia
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              Top <span className="font-bold">10 ciudades</span> con más
              especialistas en {esp.nombre.toLowerCase()}.
            </h2>

            <ol className="divide-y divide-gray-200 border-y border-gray-200">
              {stats.topCiudades.map(({ name, count }) => (
                <li
                  key={name}
                  className="py-3 flex items-center justify-between gap-4 text-sm"
                >
                  <span className="text-gray-900">{name}</span>
                  <span className="tabular-nums text-xs text-gray-400">
                    {count.toLocaleString("es-ES")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ── Mutuas (cross-link) ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Mutuas cubiertas
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Explora <span className="font-bold">{esp.nombre.toLowerCase()}</span>{" "}
            por aseguradora.
          </h2>

          <ul className="flex flex-wrap gap-2">
            {MUTUAS.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/cuadro-medico/${m.slug}`}
                  className="inline-block text-xs text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1 hover:border-gray-400 hover:text-gray-900 transition-colors"
                >
                  {m.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Preguntas frecuentes
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Sobre <span className="font-bold">{esp.nombre.toLowerCase()}</span>{" "}
            por mutua.
          </h2>

          <ul className="divide-y divide-gray-200 border-y border-gray-200">
            {faq.map(({ q, a }) => (
              <li key={q}>
                <details className="group">
                  <summary className="list-none cursor-pointer py-5 flex items-start justify-between gap-4 text-sm font-medium text-gray-900">
                    <span>{q}</span>
                    <span
                      aria-hidden="true"
                      className="flex-shrink-0 mt-0.5 text-gray-400 transition-transform group-open:rotate-45 text-lg leading-none"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 -mt-1 text-sm text-gray-600 leading-relaxed pr-8">
                    {a}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Otras especialidades ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Otras especialidades
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Explora más <span className="font-bold">especialidades</span>.
          </h2>

          <ul className="flex flex-wrap gap-2">
            {ESPECIALIDADES.filter((e) => e.slug !== esp.slug).map((e) => (
              <li key={e.slug}>
                <Link
                  href={`/medicos/${e.slug}`}
                  className="inline-block text-xs text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1 hover:border-gray-400 hover:text-gray-900 transition-colors"
                >
                  {e.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-4 sm:px-6 py-10 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400">
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            · datos de los cuadros médicos públicos de cada mutua.
          </p>
          <p className="text-[11px] text-gray-400">Hecho en España.</p>
        </div>
      </footer>
    </main>
  );
}
