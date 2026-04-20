import type { Doctor } from "@/lib/types";
import ReviewsSection from "@/components/ReviewsSection";

type Props = {
  doctor: Doctor;
  searchCp?: string;
};

function ratingStyle(rating: number): string {
  if (rating >= 4.5) return "bg-green-50 text-green-700 border-green-200";
  if (rating >= 3.5) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-600 border-red-200";
}

function formatPhone(tel: string): string {
  if (tel.length === 9) return `${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}`;
  return tel;
}

export default function DoctorCard({ doctor, searchCp }: Props) {
  const distance =
    searchCp && doctor.distanceKm != null
      ? doctor.distanceKm === 0
        ? "< 1 km"
        : `${doctor.distanceKm} km`
      : null;

  return (
    <article className="group py-5 border-b border-gray-200 last:border-b-0">
      <div className="flex items-start justify-between gap-6">

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {doctor.nombre}
            </h2>
            {doctor.especialidad && (
              <span className="text-xs text-gray-400 truncate">{doctor.especialidad}</span>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-400 flex flex-wrap items-center gap-x-2">
            {doctor.ciudad && <span>{doctor.ciudad}</span>}
            {doctor.cp && <span className="tabular-nums">{doctor.cp}</span>}
            {doctor.direccion && (
              <span className="hidden sm:inline truncate max-w-[220px]">{doctor.direccion}</span>
            )}
            {distance && (
              <span className="text-blue-600 font-medium">{distance}</span>
            )}
          </p>

          {doctor.telefono && (
            <p className="mt-1">
              <a
                href={`tel:${doctor.telefono}`}
                className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >
                {formatPhone(doctor.telefono)}
              </a>
            </p>
          )}

          {doctor.mutuas.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {doctor.mutuas.map((m) => (
                <span
                  key={m}
                  className="text-[10px] text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Rating */}
        <div className="flex-shrink-0 text-right">
          {doctor.rating > 0 ? (
            doctor.doctoraliaUrl ? (
              <a
                href={doctor.doctoraliaUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver perfil en Doctoralia"
                className="group/rating inline-block"
              >
                <div
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-sm font-semibold tabular-nums transition-colors ${ratingStyle(doctor.rating)} group-hover/rating:border-gray-400`}
                >
                  {doctor.rating.toFixed(1)}
                  <span aria-hidden="true">★</span>
                </div>
                {doctor.numReviews > 0 && (
                  <p className="tabular-nums text-[11px] text-gray-400 mt-1 group-hover/rating:text-gray-600 transition-colors">
                    {doctor.numReviews.toLocaleString("es-ES")} reseñas
                  </p>
                )}
              </a>
            ) : (
              <>
                <div
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-sm font-semibold tabular-nums ${ratingStyle(doctor.rating)}`}
                >
                  {doctor.rating.toFixed(1)}
                  <span aria-hidden="true">★</span>
                </div>
                {doctor.numReviews > 0 && (
                  <p className="tabular-nums text-[11px] text-gray-400 mt-1">
                    {doctor.numReviews.toLocaleString("es-ES")} reseñas
                  </p>
                )}
              </>
            )
          ) : (
            <div
              title="Sin valoraciones disponibles"
              className="inline-flex items-center px-2 py-0.5 rounded-full border text-sm text-gray-300 border-gray-100 bg-gray-50 tabular-nums"
            >
              —
            </div>
          )}
        </div>
      </div>

      {doctor.doctoraliaUrl && (
        <ReviewsSection
          url={doctor.doctoraliaUrl}
          initialReviews={doctor.doctoraliaReviews}
        />
      )}
    </article>
  );
}
