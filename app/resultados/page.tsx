import Link from "next/link";
import { findDoctors } from "@/lib/doctorSearch";
import DoctorCard from "@/components/DoctorCard";
import { imqCoversCp, IMQ_COVERAGE_LABEL } from "@/lib/sources/imq";
import type { Doctor } from "@/lib/types";

type SearchParams = {
  mutua?: string;
  especialidad?: string;
  cp?: string;
  radio?: string;
  page?: string;
};

const PAGE_SIZE = 20;

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
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  let pageResults: Doctor[] = [];
  let totalFound = 0;
  let totalPages = 0;
  let error: string | null = null;

  try {
    const response = await findDoctors(mutua, especialidad, cp, maxKm);
    totalFound = response.doctors.length;
    totalPages = Math.max(1, Math.ceil(totalFound / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const start = (clampedPage - 1) * PAGE_SIZE;
    pageResults = response.doctors.slice(start, start + PAGE_SIZE);
  } catch (err) {
    error = err instanceof Error ? err.message : "Error en la búsqueda";
  }

  const activeFilters = [
    mutua && mutua,
    especialidad && especialidad,
    cp && (radio ? `${cp} · ${radio} km` : cp),
  ].filter(Boolean) as string[];

  // Build pagination links preserving filters.
  function pageHref(p: number): string {
    const qs = new URLSearchParams();
    if (mutua) qs.set("mutua", mutua);
    if (especialidad) qs.set("especialidad", especialidad);
    if (cp) qs.set("cp", cp);
    if (radio) qs.set("radio", radio);
    if (p > 1) qs.set("page", String(p));
    const q = qs.toString();
    return q ? `/resultados?${q}` : "/resultados";
  }

  const currentPage = Math.min(page, totalPages || 1);
  const startItem = totalFound === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, totalFound);

  // Aviso de cobertura: IMQ sólo opera en 5 provincias. Si el usuario filtra
  // IMQ con un CP fuera de esa zona, mostramos el porqué en vez de un empty
  // state genérico.
  const imqOutOfCoverage =
    mutua === "IMQ" && !!cp && !imqCoversCp(cp);

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
                  {totalFound}
                </span>
                <span className="text-lg font-light text-gray-900">
                  {totalFound === 1 ? "médico encontrado" : "médicos encontrados"}
                </span>
              </div>

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

              {totalFound > 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  Mostrando {startItem}–{endItem} · ordenados por valoración
                </p>
              )}
            </header>

            {/* Results */}
            {pageResults.length > 0 ? (
              <>
                <section
                  aria-label="Médicos encontrados"
                  className="bg-white rounded-2xl border border-gray-200 px-6 animate-fade-up"
                >
                  {pageResults.map((doctor) => (
                    <DoctorCard key={doctor.id} doctor={doctor} searchCp={cp} />
                  ))}
                </section>

                {totalPages > 1 && (
                  <Pagination
                    current={currentPage}
                    total={totalPages}
                    hrefFor={pageHref}
                  />
                )}
              </>
            ) : imqOutOfCoverage ? (
              <div className="py-20 text-center">
                <p className="text-sm text-gray-400 mb-1">
                  IMQ solo opera en {IMQ_COVERAGE_LABEL}.
                </p>
                <p className="text-xs text-gray-300 mb-8">
                  El código postal {cp} está fuera de su red. Prueba con otra mutua o con un CP de esa zona.
                </p>
                <Link href="/" className="text-xs text-gray-900 underline underline-offset-4">
                  Nueva búsqueda
                </Link>
              </div>
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

/* --------------- Pagination --------------- */

function Pagination({
  current,
  total,
  hrefFor,
}: {
  current: number;
  total: number;
  hrefFor: (p: number) => string;
}) {
  const pages = buildPageList(current, total);

  return (
    <nav
      aria-label="Paginación"
      className="mt-8 flex items-center justify-center gap-1.5 flex-wrap"
    >
      <PageLink
        href={current > 1 ? hrefFor(current - 1) : undefined}
        label="← Anterior"
        disabled={current === 1}
      />
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-300 text-sm">
            …
          </span>
        ) : (
          <PageLink
            key={p}
            href={hrefFor(p)}
            label={String(p)}
            active={p === current}
          />
        )
      )}
      <PageLink
        href={current < total ? hrefFor(current + 1) : undefined}
        label="Siguiente →"
        disabled={current === total}
      />
    </nav>
  );
}

function PageLink({
  href,
  label,
  active,
  disabled,
}: {
  href?: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const base =
    "min-w-[2.25rem] px-3 h-9 text-xs rounded-lg border transition-all flex items-center justify-center";
  if (disabled || !href) {
    return (
      <span className={`${base} text-gray-300 border-gray-100 bg-white cursor-not-allowed`}>
        {label}
      </span>
    );
  }
  if (active) {
    return (
      <span
        aria-current="page"
        className={`${base} bg-gray-900 text-white border-gray-900 font-medium`}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} text-gray-600 border-gray-200 bg-white hover:border-gray-400 hover:text-gray-900`}
    >
      {label}
    </Link>
  );
}

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) out.push("…");
  for (let p = left; p <= right; p++) out.push(p);
  if (right < total - 1) out.push("…");
  out.push(total);
  return out;
}
