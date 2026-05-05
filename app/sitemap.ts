import type { MetadataRoute } from "next";
import { MUTUAS, ESPECIALIDADES } from "@/lib/slugs";
import { PROVINCIAS } from "@/lib/provincias";
import {
  provinciasConMutua,
  provinciasConEspecialidad,
} from "@/lib/programmatic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const home = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 1,
    },
  ];

  const hubsMutua = MUTUAS.map((m) => ({
    url: `${SITE_URL}/cuadro-medico/${m.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const hubsEspecialidad = ESPECIALIDADES.map((e) => ({
    url: `${SITE_URL}/medicos/${e.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Nivel 2: mutua × provincia (solo mutuas con dataset offline + N≥10)
  const mutuaProvincia = MUTUAS.filter((m) => m.hasOfflineData).flatMap((m) =>
    provinciasConMutua(m.nombre, 10).flatMap((code) => {
      const p = PROVINCIAS.find((x) => x.codigo === code);
      if (!p) return [];
      return [
        {
          url: `${SITE_URL}/cuadro-medico/${m.slug}/${p.slug}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        },
      ];
    }),
  );

  // Nivel 2: especialidad × provincia (N≥5)
  const espProvincia = ESPECIALIDADES.flatMap((e) =>
    provinciasConEspecialidad(e.nombre, 5).flatMap((code) => {
      const p = PROVINCIAS.find((x) => x.codigo === code);
      if (!p) return [];
      return [
        {
          url: `${SITE_URL}/medicos/${e.slug}/${p.slug}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        },
      ];
    }),
  );

  return [...home, ...hubsMutua, ...hubsEspecialidad, ...mutuaProvincia, ...espProvincia];
}
