import { RawDoctor } from "./types";

// Deduplicar por nombre normalizado + ciudad
// Fusionar mutuas de duplicados, conservar mejor rating

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr\.?a?\.?\s+)/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeAndDeduplicate(doctors: RawDoctor[]): RawDoctor[] {
  const map = new Map<string, RawDoctor>();

  for (const doc of doctors) {
    const key = `${normalizeName(doc.nombre)}::${doc.ciudad.toLowerCase()}`;
    const existing = map.get(key);

    if (existing) {
      for (const mutua of doc.mutuas) {
        if (!existing.mutuas.includes(mutua)) {
          existing.mutuas.push(mutua);
        }
      }
      if (doc.rating > existing.rating) existing.rating = doc.rating;
      if (doc.numReviews > existing.numReviews) existing.numReviews = doc.numReviews;
      // Preferir datos de Doctoralia (más completos)
      if (doc.source === "doctoralia" && existing.source === "google") {
        existing.direccion = doc.direccion || existing.direccion;
        existing.cp = doc.cp || existing.cp;
        existing.source = "doctoralia";
      }
    } else {
      map.set(key, { ...doc, mutuas: [...doc.mutuas] });
    }
  }

  // Ordenar por rating desc
  return Array.from(map.values()).sort((a, b) => b.rating - a.rating || b.numReviews - a.numReviews);
}

export function toTypeScriptFile(doctors: RawDoctor[]): string {
  const withIds = doctors.map((doc, i) => ({ id: i + 1, ...doc }));

  const lines = withIds.map((doc) => {
    const mutuas = JSON.stringify(doc.mutuas);
    return `  {
    id: ${doc.id},
    nombre: ${JSON.stringify(doc.nombre)},
    especialidad: ${JSON.stringify(doc.especialidad)},
    mutuas: ${mutuas},
    direccion: ${JSON.stringify(doc.direccion)},
    cp: ${JSON.stringify(doc.cp)},
    ciudad: ${JSON.stringify(doc.ciudad)},
    rating: ${doc.rating.toFixed(1)},
    numReviews: ${doc.numReviews},
  }`;
  });

  return `// Generado automáticamente por el scraper — no editar a mano
// Última actualización: ${new Date().toISOString()}
// Total médicos: ${withIds.length}

import type { Doctor } from "@/lib/types";

export const doctors: Omit<Doctor, "distanceKm" | "telefono">[] = [
${lines.join(",\n")}
];
`;
}
