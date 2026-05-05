import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Doctor } from "@/lib/types";
import { normalize } from "@/lib/slugs";

let cached: Doctor[] | null = null;

function getAllDoctors(): Doctor[] {
  if (cached) return cached;
  const raw = readFileSync(join(process.cwd(), "data", "doctors.json"), "utf8");
  cached = JSON.parse(raw) as Doctor[];
  return cached;
}

function topN<T extends string>(
  counts: Map<T, number>,
  n: number,
): { name: T; count: number }[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

export type MutuaStats = {
  total: number;
  topCiudades: { name: string; count: number }[];
  topEspecialidades: { name: string; count: number }[];
  provinciasCubiertas: number;
};

export function getMutuaStats(mutuaNombre: string): MutuaStats | null {
  const all = getAllDoctors();
  const matches = all.filter((d) => d.mutuas.includes(mutuaNombre));
  if (matches.length === 0) return null;

  const ciudades = new Map<string, number>();
  const especialidades = new Map<string, number>();
  const provincias = new Set<string>();

  for (const d of matches) {
    if (d.ciudad) ciudades.set(d.ciudad, (ciudades.get(d.ciudad) ?? 0) + 1);
    if (d.especialidad)
      especialidades.set(d.especialidad, (especialidades.get(d.especialidad) ?? 0) + 1);
    if (d.cp) provincias.add(d.cp.slice(0, 2));
  }

  return {
    total: matches.length,
    topCiudades: topN(ciudades, 10),
    topEspecialidades: topN(especialidades, 10),
    provinciasCubiertas: provincias.size,
  };
}

export type EspecialidadStats = {
  total: number;
  topCiudades: { name: string; count: number }[];
  provinciasCubiertas: number;
};

function matchesEspecialidad(docEsp: string | undefined, query: string): boolean {
  if (!docEsp) return false;
  const e = normalize(docEsp);
  const q = normalize(query);
  return e.includes(q) || q.includes(e);
}

export function getEspecialidadStats(especialidadNombre: string): EspecialidadStats {
  const all = getAllDoctors();
  const matches = all.filter((d) => matchesEspecialidad(d.especialidad, especialidadNombre));

  const ciudades = new Map<string, number>();
  const provincias = new Set<string>();

  for (const d of matches) {
    if (d.ciudad) ciudades.set(d.ciudad, (ciudades.get(d.ciudad) ?? 0) + 1);
    if (d.cp) provincias.add(d.cp.slice(0, 2));
  }

  return {
    total: matches.length,
    topCiudades: topN(ciudades, 10),
    provinciasCubiertas: provincias.size,
  };
}

/* ─── Nivel 2: combinaciones con provincia ────────────────────────── */

export type MutuaProvinciaStats = {
  total: number;
  topCiudades: { name: string; count: number }[];
  topEspecialidades: { name: string; count: number }[];
  topCentros: {
    nombre: string;
    ciudad: string;
    especialidad: string;
    rating: number;
    numReviews: number;
  }[];
};

export function getMutuaProvinciaStats(
  mutuaNombre: string,
  provCodigo: string,
): MutuaProvinciaStats | null {
  const all = getAllDoctors();
  const matches = all.filter(
    (d) =>
      d.mutuas.includes(mutuaNombre) &&
      d.cp &&
      d.cp.slice(0, 2) === provCodigo,
  );
  if (matches.length === 0) return null;

  const ciudades = new Map<string, number>();
  const especialidades = new Map<string, number>();

  for (const d of matches) {
    if (d.ciudad) ciudades.set(d.ciudad, (ciudades.get(d.ciudad) ?? 0) + 1);
    if (d.especialidad)
      especialidades.set(d.especialidad, (especialidades.get(d.especialidad) ?? 0) + 1);
  }

  const topCentros = matches
    .filter((d) => d.rating > 0)
    .sort(
      (a, b) =>
        b.rating - a.rating || (b.numReviews ?? 0) - (a.numReviews ?? 0),
    )
    .slice(0, 10)
    .map((d) => ({
      nombre: d.nombre,
      ciudad: d.ciudad ?? "",
      especialidad: d.especialidad ?? "",
      rating: d.rating,
      numReviews: d.numReviews ?? 0,
    }));

  return {
    total: matches.length,
    topCiudades: topN(ciudades, 10),
    topEspecialidades: topN(especialidades, 10),
    topCentros,
  };
}

export type EspecialidadProvinciaStats = {
  total: number;
  topCiudades: { name: string; count: number }[];
  topMutuas: { name: string; count: number }[];
};

export function getEspecialidadProvinciaStats(
  especialidadNombre: string,
  provCodigo: string,
): EspecialidadProvinciaStats | null {
  const all = getAllDoctors();
  const matches = all.filter(
    (d) =>
      matchesEspecialidad(d.especialidad, especialidadNombre) &&
      d.cp &&
      d.cp.slice(0, 2) === provCodigo,
  );
  if (matches.length === 0) return null;

  const ciudades = new Map<string, number>();
  const mutuas = new Map<string, number>();

  for (const d of matches) {
    if (d.ciudad) ciudades.set(d.ciudad, (ciudades.get(d.ciudad) ?? 0) + 1);
    for (const m of d.mutuas) {
      mutuas.set(m, (mutuas.get(m) ?? 0) + 1);
    }
  }

  return {
    total: matches.length,
    topCiudades: topN(ciudades, 10),
    topMutuas: topN(mutuas, 10),
  };
}

export function provinciasConMutua(
  mutuaNombre: string,
  minN = 10,
): string[] {
  const all = getAllDoctors();
  const counts = new Map<string, number>();
  for (const d of all) {
    if (!d.mutuas.includes(mutuaNombre)) continue;
    if (!d.cp) continue;
    const p = d.cp.slice(0, 2);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, n]) => n >= minN)
    .map(([p]) => p);
}

export function provinciasConEspecialidad(
  especialidadNombre: string,
  minN = 5,
): string[] {
  const all = getAllDoctors();
  const counts = new Map<string, number>();
  for (const d of all) {
    if (!matchesEspecialidad(d.especialidad, especialidadNombre)) continue;
    if (!d.cp) continue;
    const p = d.cp.slice(0, 2);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, n]) => n >= minN)
    .map(([p]) => p);
}
