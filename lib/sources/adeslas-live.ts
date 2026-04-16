/**
 * Cliente *live* de Adeslas (Elastic App Search `cm-pre`).
 *
 * Se usa para los cuadros concertados que NO están en el dataset offline
 * (`data/doctors.json` solo contiene `md_id=1` = General). Actualmente lo
 * consume el cliente MUFACE con `md_id=4`. Token Bearer expuesto por el
 * propio buscador público de `segurcaixaadeslas.es`.
 */
import { coordsFromCP } from "@/lib/coordinates";
import type { Doctor } from "@/lib/types";

const ENDPOINT =
  "https://sca-cm-prod.ent.westeurope.azure.elastic-cloud.com/api/as/v1/engines/cm-pre/elasticsearch/_search";
const TOKEN = "Bearer private-r4ffymb39xyg4jixdzcnxpxi";

type Hit = {
  _source: {
    provider: string;
    special_name_calc?: string;
    address_name?: string;
    address_municipality?: string;
    address_postalcode?: string;
    phones?: string;
    location?: { lat: number; lon: number };
    md_id: number;
    id_doc: string;
  };
  sort?: [number];
};

type EsResponse = {
  hits: { total: { value: number }; hits: Hit[] };
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bY\b/g, "y");
}

function firstPhone(phones?: string): string | undefined {
  if (!phones) return undefined;
  const match = phones.match(/\d{9}/);
  return match ? match[0] : undefined;
}

export type AdeslasLiveOptions = {
  mdId: number;
  mutuaLabel: string;
  idOffset: number;
  radiusKm?: number;
  maxResults?: number;
};

export async function searchAdeslasLive(
  cp: string,
  especialidad: string,
  opts: AdeslasLiveOptions
): Promise<Doctor[]> {
  if (!cp || !/^\d{5}$/.test(cp) || !especialidad) return [];

  const coords = coordsFromCP(cp);
  if (!coords) return [];

  const radius = opts.radiusKm ?? 25;
  const size = Math.min(opts.maxResults ?? 100, 100);

  const body = {
    size,
    query: {
      bool: {
        must: [
          { term: { md_id: opts.mdId } },
          { match: { special_name_calc: especialidad } },
        ],
        filter: {
          geo_distance: {
            distance: `${radius}km`,
            location: { lat: coords.lat, lon: coords.lng },
          },
        },
      },
    },
    sort: [
      {
        _geo_distance: {
          location: { lat: coords.lat, lon: coords.lng },
          order: "asc",
          unit: "km",
        },
      },
    ],
  };

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!r.ok) return [];
    const j = (await r.json()) as EsResponse;
    const hits = j.hits?.hits ?? [];

    // Accent-insensitive post-filter por si el `match` de Elastic es demasiado permisivo.
    const target = norm(especialidad);
    const out: Doctor[] = [];
    for (const [i, h] of hits.entries()) {
      const s = h._source;
      if (!s.provider || !s.address_municipality) continue;
      const esp = s.special_name_calc ?? "";
      if (target && !norm(esp).includes(target) && !target.includes(norm(esp))) continue;
      out.push({
        id: opts.idOffset + i,
        nombre: normalizeName(s.provider),
        especialidad: esp,
        mutuas: [opts.mutuaLabel],
        direccion: s.address_name ?? "",
        cp: s.address_postalcode ?? "",
        ciudad: s.address_municipality,
        telefono: firstPhone(s.phones),
        rating: 0,
        numReviews: 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}
