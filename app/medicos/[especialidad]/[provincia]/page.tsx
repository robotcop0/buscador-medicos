import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SearchForm from "@/components/SearchForm";
import { findEspecialidadBySlug, ESPECIALIDADES, MUTUAS } from "@/lib/slugs";
import { findProvinciaBySlug, PROVINCIAS } from "@/lib/provincias";
import {
  getEspecialidadProvinciaStats,
  provinciasConEspecialidad,
} from "@/lib/programmatic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const MIN_N = 5;

type Params = { especialidad: string; provincia: string };

export function generateStaticParams(): Params[] {
  const params: Params[] = [];
  for (const esp of ESPECIALIDADES) {
    const provCodes = provinciasConEspecialidad(esp.nombre, MIN_N);
    for (const code of provCodes) {
      const p = PROVINCIAS.find((x) => x.codigo === code);
      if (p) params.push({ especialidad: esp.slug, provincia: p.slug });
    }
  }
  return params;
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const e = findEspecialidadBySlug(params.especialidad);
  const p = findProvinciaBySlug(params.provincia);
  if (!e || !p) return {};
  const title = `${e.nombre} en ${p.nombre} por mutua — encuentra tu especialista`;
  const description = `Especialistas en ${e.nombre.toLowerCase()} en ${p.nombre} cubiertos por las grandes mutuas privadas. Búsqueda por código postal con valoraciones reales y teléfono directo.`;
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/medicos/${e.slug}/${p.slug}`,
    },
    openGraph: { title, description, type: "website", locale: "es_ES" },
  };
}

export default async function EspProvPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { especialidad: eSlug, provincia: pSlug } = await params;
  const esp = findEspecialidadBySlug(eSlug);
  const provincia = findProvinciaBySlug(pSlug);
  if (!esp || !provincia) notFound();

  const stats = getEspecialidadProvinciaStats(esp.nombre, provincia.codigo);
  if (!stats || stats.total < MIN_N) notFound();

  const otrasProvincias = PROVINCIAS.filter(
    (p) => p.slug !== provincia.slug,
  ).filter((p) => provinciasConEspecialidad(esp.nombre, MIN_N).includes(p.codigo));

  const faq = [
    {
      q: `¿Cuántos especialistas en ${esp.nombre.toLowerCase()} hay en ${provincia.nombre}?`,
      a: `Hemos indexado ${stats.total.toLocaleString("es-ES")} profesionales y centros de ${esp.nombre.toLowerCase()} en ${provincia.nombre}, distribuidos en ${stats.topCiudades.length} ciudades principales.`,
    },
    {
      q: `¿Mi mutua cubre ${esp.nombre.toLowerCase()} en ${provincia.nombre}?`,
      a: `Las grandes aseguradoras privadas cubren ${esp.nombre.toLowerCase()} en ${provincia.nombre}. Selecciona tu mutua arriba para ver el listado concreto cubierto por tu póliza.`,
    },
    {
      q: `¿Las valoraciones de los profesionales son reales?`,
      a: "Sí. Las puntuaciones de profesionales individuales vienen de Doctoralia y las de clínicas, hospitales y policlínicos vienen de Google Maps.",
    },
    {
      q: `¿Necesito volante o derivación?`,
      a: "Depende de cada mutua. Algunas requieren autorización previa o derivación de medicina general; otras permiten acceso directo. Consulta tu póliza o llama al centro antes de pedir cita.",
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
            name: esp.nombre,
            item: `${SITE_URL}/medicos/${esp.slug}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: provincia.nombre,
            item: `${SITE_URL}/medicos/${esp.slug}/${provincia.slug}`,
          },
        ],
      },
      {
        "@type": "MedicalSpecialty",
        name: esp.nombre,
        url: `${SITE_URL}/medicos/${esp.slug}/${provincia.slug}`,
        description: esp.intro,
      },
      {
        "@type": "WebPage",
        url: `${SITE_URL}/medicos/${esp.slug}/${provincia.slug}`,
        name: `${esp.nombre} en ${provincia.nombre} por mutua`,
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
            <Link href={`/medicos/${esp.slug}`} className="hover:text-gray-700">
              {esp.nombre}
            </Link>{" "}
            · <span className="text-gray-500">{provincia.nombre}</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            {esp.nombre}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
            <span className="font-light">Especialistas en </span>
            <span className="font-bold">{esp.nombre}</span>
            <span className="font-light"> en {provincia.nombre}.</span>
          </h1>
          <p className="mt-4 text-sm text-gray-600 leading-relaxed">{esp.intro}</p>

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
                {stats.topCiudades.length}
              </dt>
              <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                ciudades de la provincia
              </dd>
            </div>
            <div>
              <dt className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                {stats.topMutuas.length}
              </dt>
              <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                mutuas con cobertura
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Buscador embebido ── */}
      <section className="px-4 sm:px-6 py-10 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Buscar {esp.nombre.toLowerCase()} en {provincia.nombre}
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-6">
            Encuentra tu especialista en{" "}
            <span className="font-bold">{esp.nombre}</span>.
          </h2>
          <SearchForm initialEspecialidad={esp.nombre} />
        </div>
      </section>

      {/* ── Top ciudades ── */}
      {stats.topCiudades.length > 0 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              Ciudades con mayor cobertura
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              Top ciudades de {provincia.nombre} con{" "}
              <span className="font-bold">
                especialistas en {esp.nombre.toLowerCase()}
              </span>
              .
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
      )}

      {/* ── Cross-link a mutuas ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Por mutua
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            <span className="font-bold">{esp.nombre}</span> por aseguradora.
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

      {/* ── Otras provincias ── */}
      {otrasProvincias.length > 0 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              {esp.nombre} en otras provincias
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              <span className="font-bold">{esp.nombre}</span> en otras zonas.
            </h2>
            <ul className="flex flex-wrap gap-2">
              {otrasProvincias.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/medicos/${esp.slug}/${p.slug}`}
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
            Sobre <span className="font-bold">{esp.nombre.toLowerCase()}</span> en{" "}
            {provincia.nombre}.
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

      {/* ── Footer ── */}
      <footer className="px-4 sm:px-6 py-10 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400">
            <Link href="/" className="hover:text-gray-700">Buscador de Médicos</Link>
            {" · "}
            <Link href={`/medicos/${esp.slug}`} className="hover:text-gray-700">
              {esp.nombre}
            </Link>
            {" · "}
            {provincia.nombre}
          </p>
          <p className="text-[11px] text-gray-400">Hecho en España.</p>
        </div>
      </footer>
    </main>
  );
}
