import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SearchForm from "@/components/SearchForm";
import SiteFooter from "@/components/SiteFooter";
import { MUTUAS, ESPECIALIDADES, findMutuaBySlug } from "@/lib/slugs";
import { getMutuaStats } from "@/lib/programmatic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Params = { mutua: string };

export function generateStaticParams(): Params[] {
  return MUTUAS.map((m) => ({ mutua: m.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const m = findMutuaBySlug(params.mutua);
  if (!m) return {};
  const title = `Cuadro médico de ${m.nombre} — directorio de profesionales y centros`;
  const description = `Directorio del cuadro médico de ${m.nombre}: especialidades, profesionales y centros con teléfono y valoraciones reales. Búsqueda por código postal en toda España.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/cuadro-medico/${m.slug}` },
    openGraph: { title, description, type: "website", locale: "es_ES" },
  };
}

export default async function CuadroMedicoPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { mutua: slug } = await params;
  const mutua = findMutuaBySlug(slug);
  if (!mutua) notFound();

  const stats = mutua.hasOfflineData ? getMutuaStats(mutua.nombre) : null;

  const faq = [
    {
      q: `¿Es gratis usar el directorio del cuadro médico de ${mutua.nombre}?`,
      a: "Sí, el listado y la búsqueda son completamente gratis y sin registro. Solo introduces tu código postal para filtrar por cercanía.",
    },
    {
      q: `¿De dónde salen los datos del cuadro médico de ${mutua.nombre}?`,
      a: `Del cuadro médico público que ${mutua.nombre} expone en su propia web oficial. Solo agregamos información ya pública.`,
    },
    {
      q: `¿Las valoraciones de los médicos de ${mutua.nombre} son reales?`,
      a: "Sí. Las puntuaciones de profesionales individuales vienen de Doctoralia y las de clínicas, hospitales y policlínicos vienen de Google Maps. Cuando un centro tiene rating en ambas fuentes, calculamos la media ponderada.",
    },
    ...(mutua.cobertura
      ? [
          {
            q: `¿En qué provincias opera ${mutua.nombre}?`,
            a: `${mutua.nombre} cubre ${mutua.cobertura}. Fuera de esas provincias no hay cuadro médico disponible.`,
          },
        ]
      : []),
    {
      q: `¿Puedo reservar cita con un médico de ${mutua.nombre} desde aquí?`,
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
            name: `Cuadro médico de ${mutua.nombre}`,
            item: `${SITE_URL}/cuadro-medico/${mutua.slug}`,
          },
        ],
      },
      {
        "@type": "WebPage",
        url: `${SITE_URL}/cuadro-medico/${mutua.slug}`,
        name: `Cuadro médico de ${mutua.nombre}`,
        description: `Directorio del cuadro médico de ${mutua.nombre}.`,
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

  const otherMutuas = MUTUAS.filter((m) => m.slug !== mutua.slug);

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
            · <span className="text-gray-500">Cuadro médico de {mutua.nombre}</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Cuadro médico
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
            <span className="font-light">Cuadro médico de </span>
            <span className="font-bold">{mutua.nombre}</span>
          </h1>
          <p className="mt-4 text-sm text-gray-600 leading-relaxed">{mutua.intro}</p>

          {stats && (
            <dl className="mt-8 grid grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <dt className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                  {stats.total.toLocaleString("es-ES")}
                </dt>
                <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                  profesionales y centros
                </dd>
              </div>
              <div>
                <dt className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                  {stats.topEspecialidades.length > 0 ? "146" : "0"}
                </dt>
                <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                  especialidades cubiertas
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
            </dl>
          )}
        </div>
      </section>

      {/* ── Buscador embebido ── */}
      <section className="px-4 sm:px-6 py-10 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Buscar en {mutua.nombre}
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-6">
            Encuentra tu especialista de{" "}
            <span className="font-bold">{mutua.nombre}</span>.
          </h2>
          <SearchForm initialMutua={mutua.nombre} />
        </div>
      </section>

      {/* ── Top especialidades (solo si hay datos reales) ── */}
      {stats && stats.topEspecialidades.length > 0 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              Especialidades con mayor cobertura
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              Las <span className="font-bold">10 especialidades</span> con más
              profesionales en el cuadro médico de {mutua.nombre}.
            </h2>

            <ol className="divide-y divide-gray-200 border-y border-gray-200">
              {stats.topEspecialidades.map(({ name, count }) => (
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

      {/* ── Top ciudades ── */}
      {stats && stats.topCiudades.length > 0 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              Ciudades con mayor presencia
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              Top <span className="font-bold">10 ciudades</span> del cuadro médico
              de {mutua.nombre}.
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

      {/* ── Especialidades populares (cross-link) ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Especialidades médicas
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Explora por <span className="font-bold">especialidad</span>.
          </h2>

          <ul className="flex flex-wrap gap-2">
            {ESPECIALIDADES.map((e) => (
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

      {/* ── FAQ ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Preguntas frecuentes
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Sobre el cuadro médico de{" "}
            <span className="font-bold">{mutua.nombre}</span>.
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

      {/* ── Otras mutuas ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Otras mutuas
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Compara con <span className="font-bold">otras aseguradoras</span>.
          </h2>

          <ul className="flex flex-wrap gap-2">
            {otherMutuas.map((m) => (
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

      <SiteFooter
        breadcrumb={
          <>
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            · datos del cuadro médico público de {mutua.nombre}.
          </>
        }
      />
    </main>
  );
}
