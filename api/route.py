"""Vercel Python Function for POST /api/route."""

import json
import logging
from http.server import BaseHTTPRequestHandler

from routing_api import (
    ApiRequestError,
    GraphCache,
    GraphUnavailableError,
    RoutingApi,
    route_payload,
)

LOGGER = logging.getLogger("vercel.routing")
MAX_REQUEST_BODY_SIZE = 16 * 1024
ROUTING_API = RoutingApi(GraphCache())


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Invalid Content-Length header."})
            return
        if content_length <= 0:
            self._send_json(400, {"error": "Missing JSON request body."})
            return
        if content_length > MAX_REQUEST_BODY_SIZE:
            self._send_json(413, {"error": "Request body is too large."})
            return
        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            result = route_payload(ROUTING_API, payload)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request body must contain valid JSON."})
            return
        except ApiRequestError as error:
            body = {"error": str(error)}
            if error.missing:
                body["missing"] = error.missing
            self._send_json(400, body)
            return
        except GraphUnavailableError as error:
            self._send_json(502, {"error": str(error)})
            return
        except Exception:
            LOGGER.exception("Unexpected error while computing a route")
            self._send_json(500, {"error": "Routing request failed."})
            return
        self._send_json(200, result)

    def do_GET(self):
        self._send_json(405, {"error": "Use POST for routing requests."})

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
