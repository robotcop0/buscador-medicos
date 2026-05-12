import type { Metadata } from "next";
import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Buscador manual de médicos por mutua, especialidad y código postal",
  description:
    "Busca médicos del cuadro médico de 15 mutuas privadas por especialidad y código postal, con valoraciones reales de Doctoralia y Google Maps y filtro por cercanía. Sin registro, sin coste.",
  alternates: { canonical: `${SITE_URL}/manual` },
};

export default function ManualPage() {
  return (
    <main>
      <section className="min-h-screen flex flex-col justify-center px-4 sm:px-6 py-12 sm:py-20 md:py-24">
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex items-baseline justify-between mb-8 sm:mb-12">
            <p className="text-xs tracking-widest text-gray-400 uppercase">
              Buscador de Médicos · Manual
            </p>
            <Link
              href="/"
              className="text-xs tracking-widest text-gray-400 uppercase hover:text-gray-600 transition-colors"
            >
              Inicio
            </Link>
          </div>

          <header className="mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
              <span className="font-light">Buscador </span>
              <span className="font-bold">manual.</span>
            </h1>
            <p className="mt-3 text-sm text-gray-400 font-light">
              Selecciona mutua, especialidad y código postal.{" "}
              <Link href="/" className="underline hover:text-gray-600">
                ¿Prefieres preguntarle al asistente?
              </Link>
            </p>
          </header>

          <SearchForm />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
