/**
 * Scraper del cuadro médico de Adeslas.
 *
 * Fuente: Elastic App Search público (`cm-pre` engine) reverseado desde el
 * buscador oficial `segurcaixaadeslas.es/cuadromedico`. El token Bearer está
 * expuesto en `/libraries/sca-cm-cuadromedico/assets/config/env-conf/pro-env.config.json`
 * y en el bundle JS: cualquier visitante de la web lo ve.
 *
 * Paginación con `search_after` sobre `id_doc` (keyword única).
 */
import axios from "axios";
import type { RawDoctor } from "../types";

const ENDPOINT =
  "https://sca-cm-prod.ent.westeurope.azure.elastic-cloud.com/api/as/v1/engines/cm-pre/elasticsearch/_search";
const TOKEN = "Bearer private-r4ffymb39xyg4jixdzcnxpxi";

const PAGE_SIZE = 1000;
const THROTTLE_MS = 250;

// md_id → nombre de cuadro. 1 = General (el más grande, el que casi todos tienen).
// Otros: 2 = ISFAS/MUGEJU, 4 = MUFACE, 27 = Senior.
const DEFAULT_MD_IDS = [1];

type AdeslasHit = {
  _source: {
    provider: string;
    center_or_professional?: "Centro" | "Profesional";
    type_provider?: string;
    special_name_calc?: string;
    address_name?: string;
    address_municipality?: string;
    address_postalcode?: string;
    address_province?: string;
    phones?: string;
    location?: { lat: number; lon: number };
    md_id: number;
    md_name?: string;
    id_doc: string;
    online_dating?: boolean;
  };
  sort: [string];
};

type AdeslasResponse = {
  hits: { total: { value: number }; hits: AdeslasHit[] };
};

async function search(body: Record<string, unknown>): Promise<AdeslasResponse> {
  const res = await axios.post<AdeslasResponse>(ENDPOINT, body, {
    headers: {
      authorization: TOKEN,
      "content-type": "application/json",
    },
    timeout: 30000,
  });
  return res.data;
}

function normalizeName(raw: string): string {
  // Adeslas devuelve nombres en mayúsculas: "DOLORES MARIBEL QUEZADA FEIJOO".
  // Para centros/hospitales conservamos tal cual.
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

function toRawDoctor(h: AdeslasHit): RawDoctor | null {
  const s = h._source;
  if (!s.provider || !s.address_municipality) return null;
  return {
    nombre: normalizeName(s.provider),
    especialidad: s.special_name_calc ?? "",
    mutuas: ["Adeslas"],
    direccion: s.address_name ?? "",
    cp: s.address_postalcode ?? "",
    ciudad: s.address_municipality,
    telefono: firstPhone(s.phones),
    rating: 0,
    numReviews: 0,
    source: "adeslas",
  };
}

export type ScrapeOptions = {
  mdIds?: number[];
  limit?: number;
  logger?: (msg: string) => void;
};

export async function scrapeAdeslas(opts: ScrapeOptions = {}): Promise<RawDoctor[]> {
  const mdIds = opts.mdIds ?? DEFAULT_MD_IDS;
  const log = opts.logger ?? (() => {});
  const collected: RawDoctor[] = [];
  const seen = new Set<string>();

  for (const mdId of mdIds) {
    log(`[adeslas] md_id=${mdId} — contando…`);
    const head = await search({
      size: 0,
      track_total_hits: true,
      query: {
        bool: {
          filter: [
            { term: { md_id: mdId } },
            { term: { "publication.keyword": "Si" } },
          ],
        },
      },
    });
    const total = head.hits.total.value;
    log(`[adeslas] md_id=${mdId} → ${total} docs publicados`);

    let searchAfter: [string] | undefined;
    let fetched = 0;
    let batches = 0;

    while (fetched < total) {
      const body: Record<string, unknown> = {
        size: PAGE_SIZE,
        _source: [
          "provider",
          "center_or_professional",
          "type_provider",
          "special_name_calc",
          "address_name",
          "address_municipality",
          "address_postalcode",
          "address_province",
          "phones",
          "location",
          "md_id",
          "md_name",
          "id_doc",
          "online_dating",
        ],
        sort: [{ id_doc: "asc" }],
        query: {
          bool: {
            filter: [
              { term: { md_id: mdId } },
              { term: { "publication.keyword": "Si" } },
            ],
          },
        },
      };
      if (searchAfter) body.search_after = searchAfter;

      const page = await search(body);
      const hits = page.hits.hits;
      if (hits.length === 0) break;

      for (const h of hits) {
        const doc = toRawDoctor(h);
        if (!doc) continue;
        // Dedup por nombre+cp (un mismo médico aparece varias veces por múltiples
        // especialidades/subepígrafes del índice).
        const key = `${doc.nombre}::${doc.cp}::${doc.especialidad}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(doc);
      }

      fetched += hits.length;
      batches++;
      searchAfter = hits[hits.length - 1].sort;

      if (batches % 10 === 0) {
        log(`[adeslas]   ${fetched}/${total} (${collected.length} únicos tras dedup)`);
      }
      if (opts.limit && collected.length >= opts.limit) {
        log(`[adeslas] límite ${opts.limit} alcanzado`);
        return collected.slice(0, opts.limit);
      }

      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }

    log(`[adeslas] md_id=${mdId} completado: ${fetched} docs, ${collected.length} únicos acumulados`);
  }

  return collected;
}
