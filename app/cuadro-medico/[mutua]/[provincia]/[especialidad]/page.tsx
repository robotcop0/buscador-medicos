import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SearchForm from "@/components/SearchForm";
import SiteFooter from "@/components/SiteFooter";
import {
  findMutuaBySlug,
  findEspecialidadBySlug,
  ESPECIALIDADES,
  MUTUAS,
} from "@/lib/slugs";
import { findProvinciaBySlug, PROVINCIAS } from "@/lib/provincias";
import {
  getMutuaProvinciaEspStats,
  combinacionesProvinciaEsp,
} from "@/lib/programmatic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const MIN_N = 5;

type Params = { mutua: string; provincia: string; especialidad: string };

export function generateStaticParams(): Params[] {
  const params: Params[] = [];
  for (const mutua of MUTUAS) {
    if (!mutua.hasOfflineData) continue;
    const combos = combinacionesProvinciaEsp(
      mutua.nombre,
      ESPECIALIDADES.map((e) => e.nombre),
      MIN_N,
    );
    for (const c of combos) {
      const prov = PROVINCIAS.find((x) => x.codigo === c.provCodigo);
      const esp = ESPECIALIDADES.find((x) => x.nombre === c.especialidadNombre);
      if (prov && esp) {
        params.push({
          mutua: mutua.slug,
          provincia: prov.slug,
          especialidad: esp.slug,
        });
      }
    }
  }
  return params;
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const m = findMutuaBySlug(params.mutua);
  const p = findProvinciaBySlug(params.provincia);
  const e = findEspecialidadBySlug(params.especialidad);
  if (!m || !p || !e) return {};
  const title = `${e.nombre} de ${m.nombre} en ${p.nombre} — directorio con teléfono`;
  const description = `Especialistas en ${e.nombre.toLowerCase()} del cuadro médico de ${m.nombre} en ${p.nombre}, con teléfono y valoraciones reales. Filtra por código postal y radio en km.`;
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/cuadro-medico/${m.slug}/${p.slug}/${e.slug}`,
    },
    openGraph: { title, description, type: "website", locale: "es_ES" },
  };
}

export default async function MutProvEspPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { mutua: mSlug, provincia: pSlug, especialidad: eSlug } = await params;
  const mutua = findMutuaBySlug(mSlug);
  const provincia = findProvinciaBySlug(pSlug);
  const esp = findEspecialidadBySlug(eSlug);
  if (!mutua || !provincia || !esp || !mutua.hasOfflineData) notFound();

  const stats = getMutuaProvinciaEspStats(
    mutua.nombre,
    provincia.codigo,
    esp.nombre,
  );
  if (!stats || stats.total < MIN_N) notFound();

  // Otras especialidades en esta misma mutua×provincia
  const otrasCombos = combinacionesProvinciaEsp(
    mutua.nombre,
    ESPECIALIDADES.map((x) => x.nombre),
    MIN_N,
  ).filter(
    (c) =>
      c.provCodigo === provincia.codigo &&
      c.especialidadNombre !== esp.nombre,
  );
  const otrasEspecialidades = otrasCombos
    .map((c) => ESPECIALIDADES.find((x) => x.nombre === c.especialidadNombre))
    .filter((x): x is NonNullable<typeof x> => !!x);

  // Misma especialidad y mutua en otras provincias (con datos)
  const otrasProvincias = combinacionesProvinciaEsp(
    mutua.nombre,
    [esp.nombre],
    MIN_N,
  )
    .filter((c) => c.provCodigo !== provincia.codigo)
    .map((c) => PROVINCIAS.find((p) => p.codigo === c.provCodigo))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const faq = [
    {
      q: `¿Cuántos especialistas en ${esp.nombre.toLowerCase()} tiene ${mutua.nombre} en ${provincia.nombre}?`,
      a: `Hemos indexado ${stats.total.toLocaleString("es-ES")} profesionales y centros de ${esp.nombre.toLowerCase()} dentro del cuadro médico de ${mutua.nombre} en ${provincia.nombre}.`,
    },
    {
      q: `¿Cómo se ordena el listado?`,
      a: "Por valoración real (rating ponderado entre Doctoralia y Google Maps cuando hay datos en ambas fuentes) y, en caso de empate, por número de reseñas. Los profesionales sin valoraciones aparecen al final.",
    },
    {
      q: `¿Necesito volante o derivación para ir al ${esp.nombre.toLowerCase()}?`,
      a: `Depende de tu póliza de ${mutua.nombre}. Algunos productos exigen autorización previa de medicina general; otros permiten acceso directo. Confirma con tu mutua o llama al centro antes de pedir cita.`,
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
          {
            "@type": "ListItem",
            position: 4,
            name: esp.nombre,
            item: `${SITE_URL}/cuadro-medico/${mutua.slug}/${provincia.slug}/${esp.slug}`,
          },
        ],
      },
      {
        "@type": "MedicalSpecialty",
        name: esp.nombre,
        description: esp.intro,
      },
      {
        "@type": "WebPage",
        url: `${SITE_URL}/cuadro-medico/${mutua.slug}/${provincia.slug}/${esp.slug}`,
        name: `${esp.nombre} de ${mutua.nombre} en ${provincia.nombre}`,
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
            ·{" "}
            <Link
              href={`/cuadro-medico/${mutua.slug}`}
              className="hover:text-gray-700"
            >
              {mutua.nombre}
            </Link>{" "}
            ·{" "}
            <Link
              href={`/cuadro-medico/${mutua.slug}/${provincia.slug}`}
              className="hover:text-gray-700"
            >
              {provincia.nombre}
            </Link>{" "}
            · <span className="text-gray-500">{esp.nombre}</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            {esp.nombre} · {mutua.nombre} · {provincia.nombre}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
            <span className="font-bold">{esp.nombre}</span>
            <span className="font-light"> de {mutua.nombre} en {provincia.nombre}.</span>
          </h1>
          <p className="mt-4 text-sm text-gray-600 leading-relaxed">{esp.intro}</p>

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
                {stats.topCiudades.length}
              </dt>
              <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                ciudades con cobertura
              </dd>
            </div>
            <div>
              <dt className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                {stats.topCentros.filter((c) => c.rating > 0).length}
              </dt>
              <dd className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                con valoración
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Buscador embebido ── */}
      <section className="px-4 sm:px-6 py-10 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Filtrar por código postal
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-6">
            Acota por <span className="font-bold">tu código postal</span>.
          </h2>
          <SearchForm
            initialMutua={mutua.nombre}
            initialEspecialidad={esp.nombre}
          />
        </div>
      </section>

      {/* ── Top centros ── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Listado
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
            <span className="font-bold">{esp.nombre}</span> de {mutua.nombre} en{" "}
            {provincia.nombre}.
          </h2>
          <ol className="divide-y divide-gray-200 border-y border-gray-200">
            {stats.topCentros.map((c, i) => (
              <li
                key={i}
                className="py-3 flex items-start justify-between gap-4 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-gray-900 truncate">{c.nombre}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {[c.ciudad, c.direccion].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {c.rating > 0 ? (
                  <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-xs font-semibold tabular-nums bg-green-50 text-green-700 border-green-200">
                    {c.rating.toFixed(1)} ★
                  </span>
                ) : (
                  <span className="flex-shrink-0 text-[11px] text-gray-400 italic">
                    Sin valoraciones
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[11px] text-gray-400 leading-relaxed">
            Para ver teléfonos, dirección completa y filtrar por código postal,
            usa el buscador de arriba.
          </p>
        </div>
      </section>

      {/* ── Top ciudades ── */}
      {stats.topCiudades.length > 1 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              Distribución por ciudad
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              <span className="font-bold">{esp.nombre}</span> en {provincia.nombre}{" "}
              por ciudad.
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

      {/* ── Otras especialidades en la misma provincia ── */}
      {otrasEspecialidades.length > 0 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              Otras especialidades en {provincia.nombre}
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              Más especialidades de{" "}
              <span className="font-bold">{mutua.nombre}</span> en{" "}
              {provincia.nombre}.
            </h2>
            <ul className="flex flex-wrap gap-2">
              {otrasEspecialidades.map((e) => (
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
      )}

      {/* ── Misma especialidad en otras provincias ── */}
      {otrasProvincias.length > 0 && (
        <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              {esp.nombre} en otras provincias
            </p>
            <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-8">
              <span className="font-bold">{esp.nombre}</span> de {mutua.nombre} en
              otras zonas.
            </h2>
            <ul className="flex flex-wrap gap-2">
              {otrasProvincias.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/cuadro-medico/${mutua.slug}/${p.slug}/${esp.slug}`}
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
            Sobre <span className="font-bold">{esp.nombre.toLowerCase()}</span> de{" "}
            {mutua.nombre} en {provincia.nombre}.
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
            <Link
              href={`/cuadro-medico/${mutua.slug}/${provincia.slug}`}
              className="hover:text-gray-700"
            >
              {provincia.nombre}
            </Link>
            {" · "}
            {esp.nombre}
          </>
        }
      />
    </main>
  );
}
