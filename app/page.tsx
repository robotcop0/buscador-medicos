import Link from "next/link";
import ChatWidget from "@/components/ChatWidget";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import FAQItem from "@/components/FAQItem";
import { MUTUAS, ESPECIALIDADES } from "@/lib/slugs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "¿Es gratis?",
    a: "Sí. Sin registro, sin coste y sin recogida de datos personales. Sólo introduces tu código postal para filtrar por cercanía.",
  },
  {
    q: "¿De dónde salen los datos de los médicos?",
    a: "De los cuadros médicos públicos que cada mutua expone en su propia web oficial. Solo agregamos información que ya es pública en las páginas de las aseguradoras.",
  },
  {
    q: "¿Las valoraciones son reales?",
    a: "Sí. Las puntuaciones de profesionales individuales vienen de Doctoralia y las de clínicas, hospitales y policlínicos vienen de Google Maps. Cuando un centro tiene rating en ambas fuentes, calculamos la media ponderada por número de reseñas.",
  },
  {
    q: "¿Cobráis a las clínicas o profesionales por aparecer arriba?",
    a: "No. El orden es 100 % por valoración real y cercanía al código postal indicado. En el futuro podría existir un sistema de perfiles destacados de pago, pero estarían claramente etiquetados como tales.",
  },
  {
    q: "¿Puedo reservar cita desde aquí?",
    a: "No. Sólo te facilitamos la información: especialidad, dirección, rating y teléfono directo del centro. La cita la concretas tú llamando al teléfono que mostramos.",
  },
  {
    q: "¿Cómo funciona con MUFACE o ISFAS?",
    a: "El régimen funcionarial puede atenderse en Adeslas o en Asisa. Si seleccionas MUFACE, consultamos las dos mutuas simultáneamente y devolvemos los resultados unificados sin duplicados.",
  },
  {
    q: "¿Qué mutuas están incluidas?",
    a: "Adeslas, Allianz, Asisa, AXA Salud, Caser Salud, Cigna, DKV, Divina Pastora, Fiatc, Generali, IMQ, Mapfre, MUFACE, Occidente y Sanitas. IMQ solo opera en Euskadi, Cantabria y Burgos.",
  },
  {
    q: "¿Con qué frecuencia se actualizan los datos?",
    a: "Adeslas se reindexa de forma periódica. El resto de mutuas se consultan en directo contra sus APIs públicas en cada búsqueda, por lo que reflejan el estado actual del cuadro médico.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Buscador de Médicos",
      inLanguage: "es-ES",
      description:
        "Buscador unificado de médicos por mutua, especialidad y código postal en España. Cubre 15 aseguradoras con ratings reales de Doctoralia y Google Maps.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/resultados?especialidad={search_term_string}&cp={cp}`,
        },
        "query-input": [
          "required name=search_term_string",
          "required name=cp",
        ],
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Buscador de Médicos",
      url: SITE_URL,
      areaServed: { "@type": "Country", name: "España" },
    },
    {
      "@type": "WebApplication",
      name: "Buscador de Médicos",
      applicationCategory: "HealthApplication",
      operatingSystem: "Any",
      url: SITE_URL,
      inLanguage: "es-ES",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      featureList: [
        "Búsqueda por mutua, especialidad y código postal",
        "Filtro geográfico con radio en km",
        "Ratings reales agregados de Doctoralia y Google Maps",
        "15 mutuas españolas integradas",
        "33 especialidades médicas",
        "Sin login, sin registro, sin paywall",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero + chat (primer fold) ── */}
      <section className="px-4 sm:px-6 pt-8 sm:pt-12 pb-16 sm:pb-24">
        <div className="w-full max-w-4xl mx-auto animate-fade-up">
          <div className="flex items-baseline justify-between mb-6 sm:mb-8">
            <p className="text-xs tracking-widest text-gray-400 uppercase">
              Buscador de Médicos
            </p>
            <nav className="flex gap-4 text-xs tracking-widest text-gray-400 uppercase">
              <Link href="/blog" className="hover:text-gray-600 transition-colors">
                Blog
              </Link>
            </nav>
          </div>

          <header className="mb-5 sm:mb-7">
            <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
              <span className="font-light">Encuentra </span>
              <span className="font-bold">tu mejor médico.</span>
            </h1>
            <p className="mt-3 text-sm text-gray-400 font-light">
              Búsqueda en tiempo real en toda España.
            </p>
          </header>

          <ChatWidget />
        </div>
      </section>

      {/* ── Qué es ── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 border-t border-gray-100">
        <div className="w-full max-w-4xl mx-auto">
          <Reveal>
            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
              Qué es
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900 leading-snug">
              Un único formulario para los cuadros médicos de{" "}
              <span className="font-bold">15 mutuas</span> privadas españolas.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-5 text-sm text-gray-600 leading-relaxed">
              Cruzamos los buscadores oficiales de cada aseguradora y enriquecemos
              cada resultado con valoraciones reales de Doctoralia y Google Maps.
              Indica tu mutua, la especialidad y el código postal, y obtén una
              lista ordenada por valoración y cercanía. Sin registro, sin login,
              sin paywall.
            </p>
          </Reveal>

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {[
              { n: "15", l: "mutuas integradas" },
              { n: "446k+", l: "profesionales indexados" },
              { n: "33", l: "especialidades" },
              { n: "2–100 km", l: "radio de búsqueda" },
            ].map(({ n, l }, i) => (
              <Reveal key={l} delay={240 + i * 80}>
                <div>
                  <dt className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                    {n}
                  </dt>
                  <dd className="mt-1 text-xs text-gray-400 leading-relaxed">
                    {l}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Mutuas cubiertas ── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 border-t border-gray-100">
        <Reveal>
        <div className="w-full max-w-4xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Mutuas cubiertas
          </p>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900 leading-snug">
            Las grandes aseguradoras privadas, en{" "}
            <span className="font-bold">una sola búsqueda</span>.
          </h2>
          <p className="mt-5 text-sm text-gray-600 leading-relaxed">
            Datos oficiales de cada cuadro médico, fusionados con dedup cruzado
            por nombre, especialidad y código postal.
          </p>

          <ul className="mt-8 flex flex-wrap gap-2">
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

          <p className="mt-6 text-[11px] text-gray-400 leading-relaxed">
            IMQ solo opera en Euskadi, Cantabria y Burgos. MUFACE compone
            simultáneamente Adeslas y Asisa.
          </p>
        </div>
        </Reveal>
      </section>

      {/* ── Especialidades ── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 border-t border-gray-100">
        <Reveal>
        <div className="w-full max-w-4xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Especialidades médicas
          </p>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900 leading-snug">
            Las <span className="font-bold">33 especialidades</span> más buscadas.
          </h2>
          <p className="mt-5 text-sm text-gray-600 leading-relaxed">
            Explora cada especialidad y compara la cobertura entre mutuas.
          </p>

          <ul className="mt-8 flex flex-wrap gap-2">
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
        </Reveal>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 border-t border-gray-100">
        <Reveal>
        <div className="w-full max-w-4xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Cómo funciona
          </p>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900 leading-snug">
            En <span className="font-bold">tres pasos</span>.
          </h2>

          <ol className="mt-8 space-y-6">
            {[
              {
                t: "Selecciona mutua y especialidad",
                d: "Elige una de las 15 aseguradoras integradas y la especialidad que necesitas.",
              },
              {
                t: "Introduce tu código postal y radio",
                d: "Cinco dígitos y, opcionalmente, un radio entre 2 y 100 km para acotar geográficamente.",
              },
              {
                t: "Llama directamente al centro",
                d: "Recibes profesionales y centros cubiertos por tu mutua, ordenados por valoración real y cercanía. Pulsas el teléfono y reservas con la clínica.",
              },
            ].map(({ t, d }, i) => (
              <li key={t} className="flex gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-medium tabular-nums flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t}</h3>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                    {d}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        </Reveal>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 border-t border-gray-100">
        <Reveal>
        <div className="w-full max-w-4xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Preguntas frecuentes
          </p>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900 leading-snug mb-10">
            Lo que <span className="font-bold">la gente pregunta</span>.
          </h2>

          <ul className="divide-y divide-gray-200 border-y border-gray-200">
            {FAQ_ITEMS.map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} />
            ))}
          </ul>
        </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  );
}
