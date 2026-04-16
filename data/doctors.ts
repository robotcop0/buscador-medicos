// Generado por scraper/build-doctors.ts — no editar a mano.
// Total: 103288 médicos. Última actualización: 2026-04-16T14:43:37.070Z
import raw from "./doctors.json";
import type { Doctor } from "@/lib/types";

export const doctors: Array<Omit<Doctor, "distanceKm">> = raw as Array<Omit<Doctor, "distanceKm">>;
