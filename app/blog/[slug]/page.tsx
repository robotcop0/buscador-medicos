import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { BLOG_POSTS, getPost, formatBlogDate } from "@/lib/blog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} — Buscador de Médicos`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      locale: "es_ES",
      url,
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const { Body } = post;
  const url = `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: "es-ES",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: "Buscador de Médicos", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Buscador de Médicos", url: SITE_URL },
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>
        <section className="px-4 sm:px-6 pt-12 sm:pt-16 pb-12">
          <div className="w-full max-w-2xl mx-auto">
            <nav
              aria-label="Breadcrumb"
              className="mb-8 text-[11px] text-gray-400"
            >
              <Link href="/" className="hover:text-gray-700">
                Buscador de Médicos
              </Link>{" "}
              ·{" "}
              <Link href="/blog" className="hover:text-gray-700">
                Blog
              </Link>{" "}
              · <span className="text-gray-500">{post.title}</span>
            </nav>

            <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
              Blog
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900 font-bold">
              {post.title}
            </h1>
            <p className="mt-4 text-[11px] text-gray-400 tabular-nums">
              {formatBlogDate(post.date)} · {post.readingMinutes} min de lectura
            </p>
            <p className="mt-5 text-sm text-gray-600 leading-relaxed">
              {post.description}
            </p>
          </div>
        </section>

        <Body />
      </article>

      <section className="px-4 sm:px-6 py-10 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <Link href="/blog" className="text-sm text-gray-500 hover:text-gray-900">
            ← Volver al blog
          </Link>
        </div>
      </section>

      <SiteFooter
        breadcrumb={
          <>
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            ·{" "}
            <Link href="/blog" className="hover:text-gray-700">
              Blog
            </Link>{" "}
            · {post.title}
          </>
        }
      />
    </main>
  );
}
