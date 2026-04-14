export type RawDoctor = {
  nombre: string;
  especialidad: string;
  mutuas: string[];
  direccion: string;
  cp: string;
  ciudad: string;
  rating: number;
  numReviews: number;
  source: "doctoralia" | "google" | "adeslas" | "occident";
  telefono?: string;
  profileUrl?: string;
};
