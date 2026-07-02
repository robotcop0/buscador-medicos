/**
 * Ledger de "sin match genuino" de Google Maps.
 *
 * Complementa a `google-ratings-index.ts`: mientras ese archivo cachea los
 * HITS (rating+numReviews), este cachea los MISSES — consultas al sidecar
 * que respondieron correctamente pero sin un resultado relevante (ver
 * `lib/google-resolve.ts` para la distinción con errores transitorios, que
 * NUNCA deben cachearse aquí).
 *
 * Sin este ledger, un batch offline (`scraper/enrich-google-batch.ts`) que se
 * reinicia (--resume) re-consulta cada persona sin match — que es la mayoría
 * del dataset — en cada corrida. Con TTL de 90 días, un reinicio salta lo ya
 * intentado y el batch avanza aunque se corte a medias.
 *
 * Clave: `"${nameKey}::${cpPrefix}"` — misma convención que `ratings-index.ts`
 * y `google-ratings-index.ts` (normNameKey(nombre) + cp.slice(0,2)).
 */
import * as fs from "fs";
import * as path from "path";

export type MissRecord = {
  nameKey: string;
  cpPrefix: string;
  at: number;
};

const MISSES_FILE = path.join(process.cwd(), "data", "google-misses.json");

/** 90 días — mismo horizonte que el --resume del batch offline. */
export const MISS_TTL_MS = 90 * 24 * 3600 * 1000;

let missesCache: Map<string, number> | null = null;
let missesMtime = 0;

function readMissesFile(): MissRecord[] {
  try {
    const raw = fs.readFileSync(MISSES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as MissRecord[];
  } catch {
    // archivo ausente o corrupto — ledger vacío
  }
  return [];
}

/**
 * Devuelve un Map `"${nameKey}::${cpPrefix}"` → `at` (timestamp del miss).
 * Cache en memoria invalidada por mtime, igual que `google-ratings-index.ts`.
 */
export function readMisses(): Map<string, number> {
  let currentMtime = 0;
  try {
    currentMtime = fs.statSync(MISSES_FILE).mtimeMs;
  } catch {
    currentMtime = 0;
  }
  if (missesCache && currentMtime === missesMtime) return missesCache;

  const m = new Map<string, number>();
  for (const rec of readMissesFile()) {
    if (!rec.nameKey || !rec.cpPrefix) continue;
    const key = `${rec.nameKey}::${rec.cpPrefix}`;
    const prev = m.get(key);
    if (prev === undefined || rec.at > prev) m.set(key, rec.at);
  }
  missesCache = m;
  missesMtime = currentMtime;
  return m;
}

/**
 * Registra un no-match genuino. Upsert por `nameKey::cpPrefix`.
 *
 * Guardado en try/catch: en serverless (FS de solo lectura) simplemente no
 * persiste y seguimos operando desde memoria/JSON commiteado, igual que
 * `persistGoogleRating`.
 */
export function persistMiss(nameKey: string, cpPrefix: string): void {
  if (!nameKey || !cpPrefix) return;

  const existing = readMissesFile();
  const key = `${nameKey}::${cpPrefix}`;
  const idx = existing.findIndex((r) => `${r.nameKey}::${r.cpPrefix}` === key);
  const rec: MissRecord = { nameKey, cpPrefix, at: Date.now() };
  if (idx >= 0) existing[idx] = rec;
  else existing.push(rec);

  try {
    fs.mkdirSync(path.dirname(MISSES_FILE), { recursive: true });
    fs.writeFileSync(MISSES_FILE, JSON.stringify(existing, null, 2), "utf-8");
  } catch {
    // FS de solo lectura (serverless): seguimos sirviendo desde memoria.
  }
  missesCache = null; // forzamos relectura a la próxima
  missesMtime = 0;
}
