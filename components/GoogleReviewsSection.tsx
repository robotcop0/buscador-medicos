"use client";

import { useRef, useState } from "react";
import type { GoogleReview } from "@/lib/types";

type Props = {
  placeId: string;
  initialReviews?: GoogleReview[];
};

const VISIBLE_STEP = 3;

type Status = "idle" | "loading" | "loaded" | "error";

type PageResponse = {
  reviews: GoogleReview[];
  page: number;
  total: number;
  hasMore: boolean;
};

function ReviewItem({ review }: { review: GoogleReview }) {
  return (
    <li className="py-2 border-t border-gray-100 first:border-t-0">
      <div className="flex items-center gap-2 text-[11px] text-gray-500">
        <span className="font-medium text-gray-700 truncate">{review.author || "Usuario"}</span>
        {review.rating > 0 && (
          <span className="tabular-nums text-amber-600">
            {review.rating.toFixed(1)} ★
          </span>
        )}
        {review.date && <span className="text-gray-400">· {review.date}</span>}
      </div>
      {review.comment && (
        <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">{review.comment}</p>
      )}
      {review.reply?.text && (
        <div className="mt-1 pl-3 border-l-2 border-gray-200">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">
            Respuesta del centro {review.reply.date ? `· ${review.reply.date}` : ""}
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">{review.reply.text}</p>
        </div>
      )}
    </li>
  );
}

export default function GoogleReviewsSection({ placeId, initialReviews }: Props) {
  const hasInitial = !!(initialReviews && initialReviews.length > 0);
  const [reviews, setReviews] = useState<GoogleReview[] | null>(
    hasInitial ? initialReviews! : null
  );
  const [status, setStatus] = useState<Status>(hasInitial ? "loaded" : "idle");
  const [visible, setVisible] = useState<number>(VISIBLE_STEP);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedPages, setLoadedPages] = useState<number>(hasInitial ? 1 : 0);
  const [hasMorePages, setHasMorePages] = useState<boolean>(true);
  const firstOpenRef = useRef(false);

  async function fetchPage(page: number): Promise<PageResponse | null> {
    const qs = `placeId=${encodeURIComponent(placeId)}&page=${page}`;
    const res = await fetch(`/api/google-reviews?${qs}`);
    if (!res.ok) return null;
    return (await res.json()) as PageResponse;
  }

  async function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = e.currentTarget.open;
    if (!isOpen || firstOpenRef.current) return;
    firstOpenRef.current = true;
    if (reviews !== null) return;
    setStatus("loading");
    const data = await fetchPage(1);
    if (!data) {
      setReviews([]);
      setHasMorePages(false);
      setStatus("error");
      return;
    }
    setReviews(data.reviews);
    setLoadedPages(1);
    setHasMorePages(data.hasMore);
    setStatus("loaded");
  }

  async function handleVerMas() {
    if (!reviews) return;
    if (visible < reviews.length) {
      setVisible(Math.min(visible + VISIBLE_STEP, reviews.length));
      return;
    }
    if (!hasMorePages) return;
    const nextPage = loadedPages + 1;
    setLoadingMore(true);
    const data = await fetchPage(nextPage);
    setLoadingMore(false);
    if (!data) {
      setHasMorePages(false);
      return;
    }
    const merged = [...reviews, ...data.reviews];
    setReviews(merged);
    setLoadedPages(nextPage);
    setHasMorePages(data.hasMore);
    setVisible(Math.min(visible + VISIBLE_STEP, merged.length));
  }

  const shown = reviews ? reviews.slice(0, visible) : [];
  const canShowMore =
    status === "loaded" &&
    reviews !== null &&
    (visible < reviews.length || hasMorePages);

  const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

  return (
    <details className="mt-3 group/details" onToggle={handleToggle}>
      <summary className="list-none cursor-pointer text-[11px] inline-flex items-center gap-3 select-none">
        <span className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors">
          <span
            className="inline-block transition-transform group-open/details:rotate-90"
            aria-hidden="true"
          >
            ▶
          </span>
          Ver reseñas Google
        </span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
        >
          Google Maps
          <span aria-hidden="true">→</span>
        </a>
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

      {canShowMore && (
        <div className="mt-3 pl-4">
          <button
            type="button"
            onClick={handleVerMas}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3.5 py-1.5 text-[11px] font-medium text-white shadow-sm ring-1 ring-black/5 hover:bg-black hover:shadow transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
          >
            {loadingMore ? (
              <>
                <span
                  className="inline-block h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin"
                  aria-hidden="true"
                />
                Cargando…
              </>
            ) : (
              <>
                Ver más
                <span aria-hidden="true">↓</span>
              </>
            )}
          </button>
        </div>
      )}
    </details>
  );
}
