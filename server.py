#!/usr/bin/env python3
"""Threaded local development server for the static app and routing API."""

import http.server
import json
import logging
import mimetypes
import os
from urllib.parse import urlparse

from routing_api import (
    ApiRequestError,
    GraphCache,
    GraphUnavailableError,
    RoutingApi,
    route_payload,
)

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", 8000))
MAX_REQUEST_BODY_SIZE = 16 * 1024
ROUTING_API = RoutingApi(GraphCache())

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
LOGGER = logging.getLogger("map_route_server")

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/json", ".json")


class LocalhostRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Service-Worker-Allowed", "/")
        if self.path.endswith((".html", ".js", ".webmanifest")):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def do_GET(self):
        clean_path = urlparse(self.path).path
        if clean_path in ("/", "/map", "/map.html"):
            self.path = "/map.html"
        elif clean_path in ("/responder", "/dispatch", "/responder.html", "/responder-dispatch"):
            self.path = "/responder.html"
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/route":
            self.send_json(404, {"error": "Endpoint not found."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Invalid Content-Length header."})
            return
        if content_length <= 0:
            self.send_json(400, {"error": "Missing JSON request body."})
            return
        if content_length > MAX_REQUEST_BODY_SIZE:
            self.send_json(413, {"error": "Request body is too large."})
            return
        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "Request body must contain valid JSON."})
            return
        try:
            response = route_payload(ROUTING_API, payload)
        except ApiRequestError as error:
            body = {"error": str(error)}
            if error.missing:
                body["missing"] = error.missing
            self.send_json(400, body)
            return
        except GraphUnavailableError as error:
            self.send_json(502, {"error": str(error)})
            return
        except Exception:
            LOGGER.exception("Unexpected error while computing a route")
            self.send_json(500, {"error": "Routing request failed."})
            return
        self.send_json(200, response)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run_server(port=PORT):
    server_class = http.server.ThreadingHTTPServer
    server_class.allow_reuse_address = True
    for candidate_port in range(port, port + 10):
        try:
            with server_class((HOST, candidate_port), LocalhostRequestHandler) as server:
                LOGGER.info("Map app: http://%s:%s/map", HOST, candidate_port)
                LOGGER.info("Responder console: http://%s:%s/responder", HOST, candidate_port)
                LOGGER.info("Press Ctrl+C to stop the server.")
                server.serve_forever()
        except OSError as error:
            if error.errno in (48, 98, 10048):
                continue
            raise


if __name__ == "__main__":
    run_server()
