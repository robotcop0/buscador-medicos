// Generado por scraper/build-doctors.ts — no editar a mano.
// Total: 68473 médicos (Adeslas cuadro general).
import raw from "./doctors.json";
import type { Doctor } from "@/lib/types";

export const doctors: Array<Omit<Doctor, "distanceKm">> = raw as Array<Omit<Doctor, "distanceKm">>;
