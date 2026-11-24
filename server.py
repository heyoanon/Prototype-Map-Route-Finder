#!/usr/bin/env python3
"""
Zero-dependency local development and offline PWA server for Prototype Map Route Finder.
Runs out of the box on Windows, macOS, and Linux with standard Python 3.

Features:
- Serves both online & offline on http://localhost:8000 and http://127.0.0.1:8000
- Sends "Service-Worker-Allowed: /" so Service Workers control all pages
- Sets proper MIME types for .webmanifest, .js, .css, .svg, .json
- Automatically routes / and /map to map.html
- Automatically routes /responder and /dispatch to responder.html
- Works whether started from repo root or Open Street Map folder
"""

import http.server
import socketserver
import os
import sys
import mimetypes
import json
from urllib.parse import urlparse

from routing_api import ApiRequestError, GraphCache, GraphUnavailableError, RoutingApi

PORT = int(os.environ.get('PORT', 8000))
ROUTING_API = RoutingApi(GraphCache())

# Ensure correct MIME types
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('application/json', '.json')

class LocalhostRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow service worker to control entire scope on localhost
        self.send_header('Service-Worker-Allowed', '/')
        self.send_header('Access-Control-Allow-Origin', '*')
        # Avoid aggressive caching during local development
        if self.path.endswith(('.html', '.js', '.webmanifest')):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        clean_path = self.path.split('?')[0].split('#')[0]

        # Locate base directory for map and responder files
        base_dir = os.getcwd()
        has_local_map = os.path.exists(os.path.join(base_dir, 'map.html'))
        sub_dir = os.path.join(base_dir, 'Open Street Map (Bellmans - Ford)')
        has_sub_map = os.path.exists(os.path.join(sub_dir, 'map.html'))

        # Rewrites for clean URLs
        if clean_path in ('/', '/map', '/map.html'):
            if has_local_map:
                self.path = '/map.html'
            elif has_sub_map:
                self.path = '/Open Street Map (Bellmans - Ford)/map.html'

        elif clean_path in ('/responder', '/dispatch', '/responder.html', '/responder-dispatch'):
            if has_local_map and os.path.exists(os.path.join(base_dir, 'responder.html')):
                self.path = '/responder.html'
            elif has_sub_map:
                self.path = '/Open Street Map (Bellmans - Ford)/responder.html'

        elif clean_path == '/service-worker.js':
            if os.path.exists(os.path.join(base_dir, 'service-worker.js')):
                self.path = '/service-worker.js'
            elif has_sub_map:
                self.path = '/Open Street Map (Bellmans - Ford)/service-worker.js'

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/route':
            self.send_json(404, {'error': 'Endpoint not found.'})
            return

        content_length = int(self.headers.get('Content-Length', '0'))
        if content_length <= 0:
            self.send_json(400, {'error': 'Missing JSON request body.'})
            return
        try:
            payload = json.loads(self.rfile.read(content_length).decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {'error': 'Request body must contain valid JSON.'})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {'error': 'Request body must be a JSON object.'})
            return

        required = (
            'origin_lat',
            'origin_lon',
            'destination_lat',
            'destination_lon',
            'algorithm',
        )
        missing = [name for name in required if name not in payload]
        if missing:
            self.send_json(400, {'error': 'Missing parameters.', 'missing': missing})
            return

        try:
            response = ROUTING_API.route(
                payload['origin_lat'],
                payload['origin_lon'],
                payload['destination_lat'],
                payload['destination_lon'],
                payload['algorithm'],
            )
        except ApiRequestError as error:
            self.send_json(400, {'error': str(error)})
            return
        except GraphUnavailableError as error:
            self.send_json(502, {'error': str(error)})
            return
        except Exception as error:
            self.send_json(500, {'error': 'Routing request failed.'})
            return
        self.send_json(200, response)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def run_server(port=PORT):
    handler = LocalhostRequestHandler
    # Allow port reuse immediately
    socketserver.TCPServer.allow_reuse_address = True
    
    server_started = False
    for p in range(port, port + 10):
        try:
            with socketserver.TCPServer(('0.0.0.0', p), handler) as httpd:
                print("=" * 60)
                print(" Prototype Map Route Finder - Local Server (Online & Offline)")
                print("=" * 60)
                print(f" Localhost URL:      http://localhost:{p}")
                print(f" Loopback IP URL:    http://127.0.0.1:{p}")
                print(f" Map Interface:      http://localhost:{p}/map.html")
                print(f" Responder Console:  http://localhost:{p}/responder.html")
                print("=" * 60)
                print(" [Ctrl+C] to stop server.\n")
                server_started = True
                httpd.serve_forever()
        except OSError as e:
            if 'Address already in use' in str(e) or '10048' in str(e):
                continue
            else:
                raise e

if __name__ == '__main__':
    run_server()
