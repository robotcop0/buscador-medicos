"""
Sidecar HTTP local que envuelve el GoogleMapsScraper de jinef-john.

El proceso Next.js lo consume desde `app/api/google-rating/route.ts` y
`app/api/google-reviews/route.ts` via localhost:8765.

Arranque (una vez clonado el scraper al lado del repo):

    git clone https://github.com/jinef-john/google-maps-scraper.git \\
        ../google-maps-scraper
    pip install -r scripts/requirements.txt
    python scripts/gmaps-sidecar.py          # o `npm run dev:gmaps`

Endpoints:
    GET /search?q=<texto>                -> top result (place_id, name, rating, ...)
    GET /reviews?place_id=<id>&cursor=&limit=10   -> reseñas + next_cursor

Si el sidecar no está arriba, las API routes devuelven source:"miss" y
la UI simplemente no muestra ratings de Google: todo el resto funciona.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger("gmaps-sidecar")


def _find_scraper_path() -> str:
    """Busca el scraper de jinef-john en rutas sensatas o usa GMAPS_SCRAPER_PATH."""
    env = os.environ.get("GMAPS_SCRAPER_PATH")
    if env:
        return env
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "..", "..", "google-maps-scraper"),  # repo-hermano
        os.path.join(here, "..", "google-maps-scraper"),
        os.path.join(os.environ.get("TEMP", "/tmp"), "gmaps-scraper-test"),  # del test
    ]
    for c in candidates:
        if os.path.isdir(c) and os.path.isfile(os.path.join(c, "scraper.py")):
            return os.path.abspath(c)
    raise SystemExit(
        "No encuentro el scraper de jinef-john. Clona el repo al lado de "
        "buscador-medicos o exporta GMAPS_SCRAPER_PATH:\n"
        "  git clone https://github.com/jinef-john/google-maps-scraper.git "
        "../google-maps-scraper"
    )


_SCRAPER = None  # singleton — warmup-once


def _get_scraper():
    global _SCRAPER
    if _SCRAPER is not None:
        return _SCRAPER
    scraper_dir = _find_scraper_path()
    if scraper_dir not in sys.path:
        sys.path.insert(0, scraper_dir)
    from scraper import GoogleMapsScraper  # type: ignore

    _SCRAPER = GoogleMapsScraper(lang="es", gl="es")
    logger.info("Scraper inicializado (lang=es, gl=es, path=%s)", scraper_dir)
    return _SCRAPER


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


def _handle_search(handler: BaseHTTPRequestHandler, params: dict) -> None:
    q_list = params.get("q", [])
    q = q_list[0] if q_list else ""
    if not q.strip():
        _json_response(handler, 400, {"error": "missing q"})
        return

    try:
        s = _get_scraper()
        results = s.search(q, max_results=1)
    except Exception as e:
        logger.exception("search failed: %s", e)
        _json_response(handler, 500, {"error": str(e)})
        return

    if not results:
        _json_response(handler, 200, None)
        return

    top = results[0]
    rating = float(top.get("rating", 0) or 0)
    review_count = int(top.get("review_count", 0) or 0)

    # La vista de lista de Google a veces devuelve rating pero review_count=0.
    # Cuando pasa, tiramos de get_place_details para rellenar. Cuesta +1
    # request (~0.5 s) y solo se paga en el miss.
    if rating > 0 and review_count == 0 and top.get("place_id"):
        try:
            details = _get_scraper().get_place_details(top["place_id"])
            if details and getattr(details, "review_count", 0):
                review_count = int(details.review_count)
                if not rating and getattr(details, "rating", 0):
                    rating = float(details.rating)
        except Exception as e:
            logger.warning("place_details fallback failed: %s", e)

    _json_response(
        handler,
        200,
        {
            "place_id": top.get("place_id", ""),
            "name": top.get("name", ""),
            "rating": rating,
            "review_count": review_count,
            "address": top.get("address", ""),
            "categories": top.get("categories", []) or [],
            "lat": top.get("lat", 0.0),
            "lng": top.get("lng", 0.0),
        },
    )


def _serialize_review(review) -> dict:
    reviewer = getattr(review, "reviewer", None)
    author = getattr(reviewer, "name", "") if reviewer else ""
    return {
        "author": author or "",
        "rating": int(getattr(review, "rating", 0) or 0),
        "date": getattr(review, "date", "") or "",
        "text": getattr(review, "text", "") or "",
        "reply_text": getattr(review, "owner_reply", "") or "",
        "reply_date": getattr(review, "owner_reply_date", "") or "",
        "language": getattr(review, "language", "") or "",
    }


def _handle_reviews(handler: BaseHTTPRequestHandler, params: dict) -> None:
    place_id = (params.get("place_id", [""])[0] or "").strip()
    cursor = (params.get("cursor", [""])[0] or "").strip()
    try:
        limit = int(params.get("limit", ["10"])[0])
    except ValueError:
        limit = 10
    if not place_id:
        _json_response(handler, 400, {"error": "missing place_id"})
        return

    try:
        s = _get_scraper()
        reviews, next_cursor = s.get_reviews(place_id, cursor=cursor, page_size=limit)
    except Exception as e:
        logger.exception("reviews failed: %s", e)
        _json_response(handler, 500, {"error": str(e)})
        return

    _json_response(
        handler,
        200,
        {
            "reviews": [_serialize_review(r) for r in reviews],
            "next_cursor": next_cursor or "",
        },
    )


class SidecarHandler(BaseHTTPRequestHandler):
    server_version = "gmaps-sidecar/1.0"

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        logger.info("%s - %s", self.address_string(), fmt % args)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        if parsed.path == "/search":
            _handle_search(self, params)
        elif parsed.path == "/reviews":
            _handle_reviews(self, params)
        elif parsed.path == "/health":
            _json_response(self, 200, {"ok": True})
        else:
            _json_response(self, 404, {"error": "unknown route"})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    )

    # Warmup: inicializamos el scraper antes de abrir el puerto, para que
    # la primera petición real no pague el coste del primer handshake.
    _get_scraper()

    server = ThreadingHTTPServer((args.host, args.port), SidecarHandler)
    logger.info("gmaps-sidecar escuchando en http://%s:%d", args.host, args.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("shutting down")
        server.server_close()


if __name__ == "__main__":
    main()
