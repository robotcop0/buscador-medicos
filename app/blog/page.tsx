import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { BLOG_POSTS, formatBlogDate } from "@/lib/blog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Blog — Buscador de Médicos",
  description:
    "Guías prácticas para elegir bien a tu especialista privado: mutuas, valoraciones reales, cercanía y cómo aprovechar el cuadro médico.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Blog — Buscador de Médicos",
    description:
      "Guías prácticas para elegir bien a tu especialista privado.",
    type: "website",
    locale: "es_ES",
  },
};

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main>
      <section className="px-4 sm:px-6 pt-12 sm:pt-16 pb-12">
        <div className="w-full max-w-2xl mx-auto">
          <nav aria-label="Breadcrumb" className="mb-8 text-[11px] text-gray-400">
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            · <span className="text-gray-500">Blog</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Blog
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
            <span className="font-light">Elegir médico, </span>
            <span className="font-bold">sin perder la tarde</span>
            <span className="font-light">.</span>
          </h1>
          <p className="mt-5 text-sm text-gray-600 leading-relaxed">
            Guías cortas y prácticas para sacar partido a tu mutua: qué mirar
            antes de pedir cita, cómo leer las valoraciones reales y por qué la
            cercanía importa más de lo que parece.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <ul className="divide-y divide-gray-200 border-y border-gray-200">
            {posts.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/blog/${p.slug}`}
                  className="group block py-6 sm:py-7"
                >
                  <p className="text-[11px] text-gray-400 tabular-nums">
                    {formatBlogDate(p.date)} · {p.readingMinutes} min de lectura
                  </p>
                  <h2 className="mt-2 text-lg sm:text-xl font-semibold text-gray-900 leading-snug group-hover:underline">
                    {p.title}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    {p.excerpt}
                  </p>
                  <span className="mt-3 inline-block text-sm font-medium text-blue-600 group-hover:underline">
                    Leer →
                  </span>
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
            · Blog
          </>
        }
      />
    </main>
  );
}
