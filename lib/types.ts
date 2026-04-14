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
  distanceKm?: number | null;
};

export type SearchResponse = {
  doctors: Doctor[];
};
