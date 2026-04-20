export type DoctoraliaReview = {
  author: string;
  rating: number;
  date: string;
  comment: string;
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
  distanceKm?: number | null;
};

export type SearchResponse = {
  doctors: Doctor[];
};
