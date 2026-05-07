import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SearchForm from "@/components/SearchForm";
import SiteFooter from "@/components/SiteFooter";
import { findMutuaBySlug, MUTUAS, ESPECIALIDADES } from "@/lib/slugs";
import { findProvinciaBySlug, PROVINCIAS } from "@/lib/provincias";
import {
  getMutuaProvinciaStats,
  provinciasConMutua,
  combinacionesProvinciaEsp,
} from "@/lib/programmatic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const MIN_N = 10;

type Params = { mutua: string; provincia: string };

export function generateStaticParams(): Params[] {
  const params: Params[] = [];
  for (const mutua of MUTUAS) {
    if (!mutua.hasOfflineData) continue;
    const provCodes = provinciasConMutua(mutua.nombre, MIN_N);
    for (const code of provCodes) {
      const p = PROVINCIAS.find((x) => x.codigo === code);
      if (p) params.push({ mutua: mutua.slug, provincia: p.slug });
    }
  }
  return params;
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const m = findMutuaBySlug(params.mutua);
  const p = findProvinciaBySlug(params.provincia);
  if (!m || !p) return {};
  const title = `Cuadro médico de ${m.nombre} en ${p.nombre} — directorio de profesionales`;
  const description = `Profesionales y centros del cuadro médico de ${m.nombre} en ${p.nombre}, con teléfono y valoraciones reales. Filtra por especialidad y código postal.`;
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/cuadro-medico/${m.slug}/${p.slug}`,
    },
    openGraph: { title, description, type: "website", locale: "es_ES" },
  };
}

export default async function MutuaProvinciaPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { mutua: mSlug, provincia: pSlug } = await params;
  const mutua = findMutuaBySlug(mSlug);
  const provincia = findProvinciaBySlug(pSlug);
  if (!mutua || !provincia || !mutua.hasOfflineData) notFound();

  const stats = getMutuaProvinciaStats(mutua.nombre, provincia.codigo);
  if (!stats || stats.total < MIN_N) notFound();

  const otrasProvincias = PROVINCIAS.filter(
    (p) => p.slug !== provincia.slug,
  ).filter((p) => provinciasConMutua(mutua.nombre, MIN_N).includes(p.codigo));

  // Especialidades viables en esta mutua×provincia (con nivel 3 disponible)
  const especialidadesEnProvincia = combinacionesProvinciaEsp(
    mutua.nombre,
    ESPECIALIDADES.map((e) => e.nombre),
    5,
  )
    .filter((c) => c.provCodigo === provincia.codigo)
    .map((c) => ESPECIALIDADES.find((x) => x.nombre === c.especialidadNombre))
    .filter((x): x is NonNullable<typeof x> => !!x);

  const faq = [
    {
      q: `¿Cuántos profesionales tiene el cuadro médico de ${mutua.nombre} en ${provincia.nombre}?`,
      a: `Hemos indexado ${stats.total.toLocaleString("es-ES")} profesionales y centros del cuadro médico de ${mutua.nombre} en ${provincia.nombre}, distribuidos en ${stats.topCiudades.length} ciudades principales.`,
    },
    {
      q: `¿Qué especialidades cubre ${mutua.nombre} en ${provincia.nombre}?`,
      a: `Las especialidades con mayor cobertura en ${provincia.nombre} dentro del cuadro de ${mutua.nombre} son ${stats.topEspecialidades.slice(0, 5).map((e) => e.name.toLowerCase()).join(", ")}, entre otras.`,
    },
    {
      q: `¿Las valoraciones de los médicos son reales?`,
      a: "Sí. Las puntuaciones de profesionales individuales vienen de Doctoralia y las de clínicas, hospitales y policlínicos vienen de Google Maps.",
    },
    {
      q: `¿Puedo reservar cita desde aquí?`,
      a: "No. Mostramos el teléfono directo del centro o profesional para que llames y concretes la cita tú directamente.",
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
          {
            "@type": "ListItem",
            position: 3,
            name: provincia.nombre,
            item: `${SITE_URL}/cuadro-medico/${mutua.slug}/${provincia.slug}`,
          },
        ],
      },
      {
        "@type": "WebPage",
        url: `${SITE_URL}/cuadro-medico/${mutua.slug}/${provincia.slug}`,
        name: `Cuadro médico de ${mutua.nombre} en ${provincia.nombre}`,
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
            <Link href="/" className="hover:text-gray-700">Buscador de Médicos</Link>{" "}
            ·{" "}
            <Link href={`/cuadro-medico/${mutua.slug}`} className="hover:text-gray-700">
              {mutua.nombre}
            </Link>{" "}
            · <span className="text-gray-500">{provincia.nombre}</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Cuadro médico
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
            <span className="font-light">Cuadro médico de </span>
            <span className="font-bold">{mutua.nombre}</span>
            <span className="font-light"> en {provincia.nombre}.</span>
          </h1>
          <p className="mt-4 text-sm text-gray-600 leading-relaxed">
            Directorio de los profesionales y centros del cuadro médico de{" "}
            {mutua.nombre} con presencia en {provincia.nombre}, ordenados por
            valoración real y cercanía. Filtra por especialidad para acotar y
            llama directamente al teléfono del centro.
          </p>

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
                {stats.topEspecialidades.length}
              </dt>
              <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                especialidades top
              </dd>
            </div>
            <div>
              <dt className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                {stats.topCiudades.length}
              </dt>
              <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                ciudades principales
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Buscador embebido ── */}
      <section className="px-4 sm:px-6 py-10 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Buscar en {provincia.nombre}
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-6">
            Encuentra tu especialista de{" "}
            <span className="font-bold">
              {mutua.nombre} en {provincia.nombre}
            </span>
            .
          </h2>
          <SearchForm initialMutua={mutua.nombre} />
        </div>
      </section>

      {/* ── Top centros con rating ── */}
      {stats.topCentros.length > 0 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              Mejor valorados
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              Centros y profesionales <span className="font-bold">mejor valorados</span>{" "}
              de {mutua.nombre} en {provincia.nombre}.
            </h2>
            <ol className="divide-y divide-gray-200 border-y border-gray-200">
              {stats.topCentros.map((c, i) => (
                <li key={i} className="py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900 truncate">{c.nombre}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {c.especialidad} · {c.ciudad}
                    </p>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-xs font-semibold tabular-nums bg-green-50 text-green-700 border-green-200">
                    {c.rating.toFixed(1)} ★
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ── Top especialidades ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Especialidades más cubiertas
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Especialidades de <span className="font-bold">{mutua.nombre}</span> en{" "}
            {provincia.nombre}.
          </h2>
          <ol className="divide-y divide-gray-200 border-y border-gray-200">
            {stats.topEspecialidades.map(({ name, count }) => (
              <li key={name} className="py-3 flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-900">{name}</span>
                <span className="tabular-nums text-xs text-gray-400">
                  {count.toLocaleString("es-ES")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Top ciudades ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Ciudades de la provincia
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Ciudades de {provincia.nombre} con más{" "}
            <span className="font-bold">presencia de {mutua.nombre}</span>.
          </h2>
          <ol className="divide-y divide-gray-200 border-y border-gray-200">
            {stats.topCiudades.map(({ name, count }) => (
              <li key={name} className="py-3 flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-900">{name}</span>
                <span className="tabular-nums text-xs text-gray-400">
                  {count.toLocaleString("es-ES")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Cross-link a especialidades en esta provincia ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Por especialidad
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Filtra por <span className="font-bold">especialidad</span> en{" "}
            {provincia.nombre}.
          </h2>
          <ul className="flex flex-wrap gap-2">
            {especialidadesEnProvincia.map((e) => (
              <li key={e.slug}>
                <Link
                  href={`/cuadro-medico/${mutua.slug}/${provincia.slug}/${e.slug}`}
                  className="inline-block text-xs text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1 hover:border-gray-400 hover:text-gray-900 transition-colors"
                >
                  {e.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Otras provincias ── */}
      {otrasProvincias.length > 0 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              {mutua.nombre} en otras provincias
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              Cuadro médico de <span className="font-bold">{mutua.nombre}</span> en
              otras zonas.
            </h2>
            <ul className="flex flex-wrap gap-2">
              {otrasProvincias.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/cuadro-medico/${mutua.slug}/${p.slug}`}
                    className="inline-block text-xs text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1 hover:border-gray-400 hover:text-gray-900 transition-colors"
                  >
                    {p.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Preguntas frecuentes
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            Sobre el cuadro médico de{" "}
            <span className="font-bold">
              {mutua.nombre} en {provincia.nombre}
            </span>
            .
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

      <SiteFooter
        breadcrumb={
          <>
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>
            {" · "}
            <Link
              href={`/cuadro-medico/${mutua.slug}`}
              className="hover:text-gray-700"
            >
              {mutua.nombre}
            </Link>
            {" · "}
            {provincia.nombre}
          </>
        }
      />
    </main>
  );
}
