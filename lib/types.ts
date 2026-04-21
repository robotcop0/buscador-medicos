export type DoctoraliaReview = {
  author: string;
  rating: number;
  date: string;
  comment: string;
};

export type GoogleReview = {
  author: string;
  rating: number;
  date: string;
  comment: string;
  reply?: { text: string; date: string };
};

export type Doctor = {
  id: number;
  nombre: string;
  especialidad: string;
  mutuas: string[];
  direccion: string;
  cp: string;
  ciudad: string;
  telefono?: string;
  rating: number;
  numReviews: number;
  doctoraliaUrl?: string;
  doctoraliaReviews?: DoctoraliaReview[];
  // Raw Google (antes del merge) — los dejamos para trazabilidad de fuentes.
  // `rating`/`numReviews` del Doctor son los ya mergeados (Doctoralia+Google).
  googleRating?: number;
  googleNumReviews?: number;
  googlePlaceId?: string;
  googleReviews?: GoogleReview[];
  distanceKm?: number | null;
};

export type SearchResponse = {
  doctors: Doctor[];
};
