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
  distanceKm?: number | null;
};

export type SearchResponse = {
  doctors: Doctor[];
};
