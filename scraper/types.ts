export type RawDoctor = {
  nombre: string;
  especialidad: string;
  mutuas: string[];
  direccion: string;
  cp: string;
  ciudad: string;
  rating: number;
  numReviews: number;
  source: "doctoralia" | "google" | "adeslas" | "occident" | "sanitas";
  telefono?: string;
  profileUrl?: string;
};
