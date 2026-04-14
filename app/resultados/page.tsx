import Link from "next/link";
import { searchDoctors } from "@/lib/claudeSearch";
import DoctorCard from "@/components/DoctorCard";

export const maxDuration = 60;

type SearchParams = {
  mutua?: string;
  especialidad?: string;
  cp?: string;
  radio?: string;
};

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const mutua = params.mutua ?? "";
  const especialidad = params.especialidad ?? "";
  const cp = params.cp ?? "";
  const radio = params.radio ?? "";
  const maxKm = radio ? parseInt(radio, 10) : undefined;

  let results: Awaited<ReturnType<typeof searchDoctors>> = [];
  let error: string | null = null;

  try {
    results = await searchDoctors(mutua, especialidad, cp, maxKm);
  } catch (err) {
    error = err instanceof Error ? err.message : "Error en la búsqueda";
  }

  // Chips de filtros activos
  const activeFilters = [
    mutua && mutua,
    especialidad && especialidad,
    cp && (radio ? `${cp} · ${radio} km` : cp),
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="w-full max-w-2xl mx-auto">

        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors focus:outline-none focus:underline"
          >
            ← Nueva búsqueda
          </Link>
          <span className="text-xs tracking-widest text-gray-300 uppercase">
            Buscador de Médicos
          </span>
        </div>

        {error ? (
          <div className="py-20 text-center">
            <p className="text-sm text-gray-400 mb-1">No se pudo completar la búsqueda.</p>
            <p className="text-xs text-gray-300 mb-8">{error}</p>
            <Link href="/" className="text-xs text-gray-900 underline underline-offset-4">
              Volver a buscar
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="mb-8">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl font-bold text-gray-900 tabular-nums">
                  {results.length}
                </span>
                <span className="text-lg font-light text-gray-900">
                  {results.length === 1 ? "médico encontrado" : "médicos encontrados"}
                </span>
              </div>

              {/* Active filter chips */}
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {activeFilters.map((f) => (
                    <span
                      key={f}
                      className="text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}

              {results.length > 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  Tiempo real · Ordenados por valoración
                </p>
              )}
            </header>

            {/* Results */}
            {results.length > 0 ? (
              <section
                aria-label="Médicos encontrados"
                className="bg-white rounded-2xl border border-gray-200 px-6 animate-fade-up"
              >
                {results.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} searchCp={cp} />
                ))}
              </section>
            ) : (
              <div className="py-20 text-center">
                <p className="text-sm text-gray-400 mb-1">Sin resultados para estos filtros.</p>
                <p className="text-xs text-gray-300 mb-8">
                  {radio ? "Prueba a ampliar el radio." : "Prueba con otros criterios."}
                </p>
                <Link href="/" className="text-xs text-gray-900 underline underline-offset-4">
                  Nueva búsqueda
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
