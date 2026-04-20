// Generado por scraper/enrich-ratings.ts — no editar a mano.
// Total: 68473 médicos. Última actualización: 2026-04-16T23:10:46.645Z
import raw from "./doctors.json";
import type { Doctor } from "@/lib/types";

export const doctors: Array<Omit<Doctor, "distanceKm">> = raw as Array<Omit<Doctor, "distanceKm">>;
