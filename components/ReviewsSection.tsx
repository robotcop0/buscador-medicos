"use client";

import { useRef, useState } from "react";
import type { DoctoraliaReview } from "@/lib/types";

type Props = {
  url: string;
  initialReviews?: DoctoraliaReview[];
};

const PAGE_SIZE = 3;

function ReviewItem({ review }: { review: DoctoraliaReview }) {
  return (
    <li className="py-2 border-t border-gray-100 first:border-t-0">
      <div className="flex items-center gap-2 text-[11px] text-gray-500">
        <span className="font-medium text-gray-700 truncate">{review.author}</span>
        {review.rating > 0 && (
          <span className="tabular-nums text-amber-600">
            {review.rating.toFixed(1)} ★
          </span>
        )}
        {review.date && <span className="text-gray-400">· {review.date}</span>}
      </div>
      <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">{review.comment}</p>
    </li>
  );
}

type Status = "idle" | "loading" | "loaded" | "error";

export default function ReviewsSection({ url, initialReviews }: Props) {
  const hasInitial = !!(initialReviews && initialReviews.length > 0);
  const [reviews, setReviews] = useState<DoctoraliaReview[] | null>(
    hasInitial ? initialReviews! : null
  );
  const [status, setStatus] = useState<Status>(hasInitial ? "loaded" : "idle");
  const [visible, setVisible] = useState<number>(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  // Si el SSR nos dio reseñas del snapshot batch (max 3), aún no hemos
  // preguntado a Doctoralia por más. Al pulsar "Ver más" sin reseñas extra
  // cacheadas, refetcheamos con `?refresh=1` para subir a 10.
  const refreshedRef = useRef(false);
  const firstOpenRef = useRef(false);

  async function fetchReviews(refresh: boolean): Promise<DoctoraliaReview[]> {
    const qs = `url=${encodeURIComponent(url)}${refresh ? "&refresh=1" : ""}`;
    const res = await fetch(`/api/doctoralia-reviews?${qs}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { reviews: DoctoraliaReview[] };
    return data.reviews || [];
  }

  async function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = e.currentTarget.open;
    if (!isOpen || firstOpenRef.current) return;
    firstOpenRef.current = true;
    if (reviews !== null) return; // ya teníamos initialReviews
    setStatus("loading");
    try {
      const revs = await fetchReviews(false);
      setReviews(revs);
      setStatus("loaded");
    } catch {
      setReviews([]);
      setStatus("error");
    }
  }

  async function handleVerMas() {
    if (!reviews) return;
    if (visible < reviews.length) {
      setVisible(Math.min(visible + PAGE_SIZE, reviews.length));
      return;
    }
    // Ya enseñamos todo lo que teníamos. Si aún no hemos hecho refresh,
    // pedimos a la API una pasada fresca (hasta 10 reseñas).
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    setLoadingMore(true);
    try {
      const revs = await fetchReviews(true);
      setReviews(revs);
      setVisible(Math.min(visible + PAGE_SIZE, revs.length));
    } catch {
      /* noop */
    } finally {
      setLoadingMore(false);
    }
  }

  const shown = reviews ? reviews.slice(0, visible) : [];
  const canShowMore =
    status === "loaded" &&
    reviews !== null &&
    (visible < reviews.length || !refreshedRef.current);

  return (
    <details className="mt-3 group/details" onToggle={handleToggle}>
      <summary className="list-none cursor-pointer text-[11px] text-gray-500 hover:text-gray-900 transition-colors inline-flex items-center gap-1 select-none">
        <span
          className="inline-block transition-transform group-open/details:rotate-90"
          aria-hidden="true"
        >
          ▶
        </span>
        Ver reseñas
      </summary>

      {status === "loading" && (
        <p className="mt-2 pl-4 text-[11px] text-gray-400 italic">Cargando reseñas…</p>
      )}

      {status === "loaded" && shown.length > 0 && (
        <ul className="mt-2 pl-4">
          {shown.map((r, i) => (
            <ReviewItem key={i} review={r} />
          ))}
        </ul>
      )}

      {status === "loaded" && shown.length === 0 && (
        <p className="mt-2 pl-4 text-[11px] text-gray-400 italic">
          Sin reseñas disponibles
        </p>
      )}

      {status === "error" && (
        <p className="mt-2 pl-4 text-[11px] text-gray-400 italic">
          No se han podido cargar las reseñas.
        </p>
      )}

      <div className="mt-2 pl-4 flex items-center gap-3">
        {canShowMore && (
          <button
            type="button"
            onClick={handleVerMas}
            disabled={loadingMore}
            className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 disabled:cursor-wait"
          >
            {loadingMore ? "Cargando…" : "Ver más"}
          </button>
        )}

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
        >
          Doctoralia
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </details>
  );
}
