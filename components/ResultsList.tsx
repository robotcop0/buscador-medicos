"use client";

/**
 * Lista de resultados con enriquecimiento on-demand de ratings de Google Maps
 * para centros.
 *
 * El SSR (`lib/search.ts`) ya ordenó el listado usando solo lo cacheado en
 * `data/google-ratings.json`. Aquí, en cliente, para cada centro que aún no
 * tiene rating disparamos `/api/google-rating` (que a su vez consulta el
 * sidecar Python y persiste el hit en la cache). Mientras la petición está en
 * vuelo, la card muestra un pill esqueleto (`loading`). Cuando llega un hit,
 * mergeamos el rating de Google con el que hubiera (Doctoralia) vía
 * `mergeRatings`. Cuando TODAS las peticiones han resuelto, reordenamos las
 * cards visibles una sola vez con `sortByRating`.
 *
 * Limitaciones conocidas (ver el spec): el reorden solo baraja las 20 cards de
 * la página actual (la paginación es server-side), y `sortByRating` recalcula
 * el prior bayesiano sobre esas 20 → el color de algún pill puede variar de
 * forma casi imperceptible. En la segunda visita todo está cacheado y el SSR
 * lo coloca/colorea bien a nivel global.
 *
 * El listado vive en `useState` (lo necesita para ir rellenando ratings), así
 * que el padre (`app/resultados/page.tsx`) DEBE pasar un `key` que cambie con
 * la búsqueda/página; si no, tras navegar (cambiar radio, paginar…) este
 * componente seguiría mostrando los doctores anteriores.
 */
import { useEffect, useState } from "react";
import type { Doctor } from "@/lib/types";
import DoctorCard from "@/components/DoctorCard";
import { isCenter } from "@/lib/center";
import { sortByRating } from "@/lib/ratings-sort";
import { mergeRatings } from "@/lib/ratings-merge";

type DoctorWithStatus = Doctor & { googleStatus?: "loading" | "done" };

type Props = {
  doctors: Doctor[];
  searchCp?: string;
};

type GoogleRatingResponse = {
  rating: number;
  numReviews: number;
  placeId: string;
  source: "cache" | "live" | "miss";
};

// Red de seguridad sobre el timeout interno de /api/google-rating (15 s al
// sidecar): si la ruta se cuelga, no dejamos la card con el esqueleto eterno.
const FETCH_TIMEOUT_MS = 16_000;

async function fetchGoogleRating(
  d: Doctor,
  signal: AbortSignal
): Promise<GoogleRatingResponse | null> {
  const qs = new URLSearchParams({
    nombre: d.nombre,
    cp: d.cp,
    ciudad: d.ciudad ?? "",
  }).toString();
  try {
    const res = await fetch(`/api/google-rating?${qs}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as GoogleRatingResponse;
  } catch {
    // abort / red / json inválido
    return null;
  }
}

export default function ResultsList({ doctors, searchCp }: Props) {
  const [list, setList] = useState<DoctorWithStatus[]>(() =>
    doctors.map((d) =>
      isCenter(d.nombre) && d.rating === 0
        ? { ...d, googleStatus: "loading" as const }
        : d
    )
  );

  useEffect(() => {
    const pending = doctors.filter((d) => isCenter(d.nombre) && d.rating === 0);
    if (pending.length === 0) return;

    let cancelled = false;
    const controllers: AbortController[] = [];

    async function run() {
      await Promise.allSettled(
        pending.map(async (d) => {
          const controller = new AbortController();
          controllers.push(controller);
          const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          const resp = await fetchGoogleRating(d, controller.signal);
          clearTimeout(timer);
          if (cancelled) return;
          setList((prev) =>
            prev.map((item) => {
              if (item.id !== d.id) return item;
              if (resp && resp.rating > 0) {
                const merged = mergeRatings({
                  ...item,
                  googleRating: resp.rating,
                  googleNumReviews: resp.numReviews,
                  googlePlaceId: resp.placeId,
                });
                return { ...merged, googleStatus: "done" as const };
              }
              return { ...item, googleStatus: "done" as const };
            })
          );
        })
      );
      if (cancelled) return;
      // Todas resueltas → una sola reordenación de las cards visibles.
      setList((prev) => sortByRating(prev) as DoctorWithStatus[]);
    }

    run();

    return () => {
      cancelled = true;
      for (const c of controllers) c.abort();
    };
    // Solo al montar: `doctors` es la prop del SSR y no cambia sin navegación
    // (que remonta el componente).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-label="Médicos encontrados"
      className="bg-white rounded-2xl border border-gray-200 px-4 sm:px-6 animate-fade-up"
    >
      {list.map((d) => (
        <DoctorCard
          key={d.id}
          doctor={d}
          searchCp={searchCp}
          loading={d.googleStatus === "loading"}
        />
      ))}
    </section>
  );
}
