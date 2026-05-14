import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Contacto — Buscador de Médicos",
  description:
    "Erratas, sugerencias, retirada de datos o cualquier otra duda sobre el Buscador de Médicos. Escríbenos.",
  alternates: { canonical: `${SITE_URL}/contacto` },
  robots: { index: true, follow: true },
};

export default function ContactoPage() {
  return (
    <main>
      <section className="px-4 sm:px-6 pt-12 sm:pt-16 pb-8">
        <div className="w-full max-w-2xl mx-auto">
          <nav aria-label="Breadcrumb" className="mb-8 text-[11px] text-gray-400">
            <Link href="/" className="hover:text-gray-700">
              Buscador de Médicos
            </Link>{" "}
            · <span className="text-gray-500">Contacto</span>
          </nav>

          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Contacto
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
            <span className="font-light">Escríbenos. </span>
            <span className="font-bold">Te leemos.</span>
          </h1>
          <p className="mt-5 text-sm text-gray-600 leading-relaxed">
            Erratas en el directorio, retirada de datos como profesional o
            centro, sugerencias, prensa o cualquier otra duda. Solemos
            responder en 1–3 días laborables.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-16">
        <div className="w-full max-w-2xl mx-auto">
          <ContactForm />
        </div>
      </section>

      <section className="px-4 sm:px-6 py-12 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
            Antes de escribir
          </p>
          <ul className="text-sm text-gray-600 leading-relaxed list-disc pl-5 space-y-2">
            <li>
              Si eres profesional o centro y quieres corregir o retirar tu
              ficha, indícanos el nombre exacto, la mutua y la ciudad — así
              acertamos a la primera.
            </li>
            <li>
              Si nos escribes por un error en los datos, recuerda que las
              fuentes oficiales son los cuadros médicos de cada aseguradora;
              cuando ellos actualicen, nosotros también.
            </li>
            <li>
              No reservamos citas ni damos consejo médico. Para eso, contacta
              directamente con tu mutua o profesional.
            </li>
          </ul>
          <p className="mt-6 text-[11px] text-gray-400">
            ¿Buscas algo concreto? Quizá te ayude la página{" "}
            <Link href="/sobre" className="text-gray-500 hover:text-gray-700 underline underline-offset-2">
              sobre el proyecto
            </Link>
            .
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
