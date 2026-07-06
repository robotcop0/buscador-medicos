/**
 * URL canónica del sitio — fuente única de verdad.
 *
 * En producción `NEXT_PUBLIC_SITE_URL` se hornea desde `.env.production`
 * (`https://buscatumedico.es`). Si por lo que fuera no estuviera definida en un
 * build de producción, caemos al dominio real — NUNCA a `localhost` — para no
 * emitir jamás canonical/OpenGraph/sitemap rotos (un canonical a `localhost`
 * desindexaría la página). En `next dev` la variable no se carga y el fallback
 * al dominio de producción es igualmente correcto: los canonical deben apuntar
 * siempre a producción.
 *
 * NOTA: `app/robots.ts` se queda leyendo `process.env.NEXT_PUBLIC_SITE_URL` en
 * crudo a propósito — ahí el valor ausente ES la señal de "no rastrear" (dev /
 * previews / staging), así que no debe usar este fallback.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buscatumedico.es"
).replace(/\/+$/, "");
